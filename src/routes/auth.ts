import { Hono } from 'hono';
import { getAdminClient, getAnonClient } from '../supabase-admin.js';
import { isServiceRoleConfigured } from '../config.js';
import { signAuthToken, verifyAuthToken, getBearerToken } from '../auth-jwt.js';
import type { AuthTokenPayload } from '../auth-jwt.js';

export const authRoutes = new Hono();

async function loadClienteSistema(authUserId: string) {
  if (!isServiceRoleConfigured()) return null;

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('clientes_sistema')
    .select('*, plano:planos_assinatura(*)')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao carregar cliente:', error.message);
  }
  return data;
}

authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    if (!email || !password) {
      return c.json({ error: 'Email e senha são obrigatórios' }, 400);
    }

    const anon = getAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return c.json({ error: error?.message || 'Credenciais inválidas' }, 401);
    }

    const clienteSistema = await loadClienteSistema(data.user.id);
    const token = await signAuthToken({
      sub: data.user.id,
      email: data.user.email ?? email,
      authUserId: data.user.id,
      isSuperAdmin: clienteSistema?.is_super_admin ?? false,
    });

    return c.json({
      token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      clienteSistema,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return c.json({ error: 'Erro ao fazer login' }, 500);
  }
});

authRoutes.get('/me', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: 'Não autenticado' }, 401);

  const payload = await verifyAuthToken(token);
  if (!payload) return c.json({ error: 'Token inválido' }, 401);

  const clienteSistema = await loadClienteSistema(payload.authUserId);
  return c.json({
    user: { id: payload.authUserId, email: payload.email },
    clienteSistema,
    isSuperAdmin: payload.isSuperAdmin,
  });
});

authRoutes.post('/logout', async (c) => {
  return c.json({ success: true });
});

authRoutes.post('/admin/users', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: 'Não autenticado' }, 401);

  const payload = await verifyAuthToken(token);
  if (!payload?.isSuperAdmin) return c.json({ error: 'Acesso negado' }, 403);

  try {
    const body = await c.req.json<{
      email: string;
      password: string;
      nome_completo: string;
      telefone?: string;
      documento?: string;
      plano_id: string;
      limite_empresas: number;
      status: string;
    }>();

    const admin = getAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { nome_completo: body.nome_completo },
    });

    if (authError || !authData.user) {
      return c.json({ error: authError?.message || 'Erro ao criar usuário' }, 400);
    }

    const { error: clienteError } = await admin.from('clientes_sistema').insert({
      auth_user_id: authData.user.id,
      nome_completo: body.nome_completo,
      email: body.email,
      telefone: body.telefone,
      documento: body.documento,
      plano_id: body.plano_id,
      limite_empresas: body.limite_empresas,
      status: body.status,
      is_super_admin: false,
    });

    if (clienteError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return c.json({ error: clienteError.message }, 400);
    }

    return c.json({ success: true, authUserId: authData.user.id });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao criar usuário' }, 500);
  }
});

authRoutes.put('/admin/users/:authUserId/password', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: 'Não autenticado' }, 401);

  const payload = await verifyAuthToken(token);
  if (!payload?.isSuperAdmin) return c.json({ error: 'Acesso negado' }, 403);

  try {
    const authUserId = c.req.param('authUserId');
    const { password } = await c.req.json<{ password: string }>();
    const admin = getAdminClient();
    const { error } = await admin.auth.admin.updateUserById(authUserId, { password });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar senha' }, 500);
  }
});

export async function requireAuth(c: any, next: () => Promise<void>) {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: 'Não autenticado' }, 401);

  const payload = await verifyAuthToken(token);
  if (!payload) return c.json({ error: 'Token inválido' }, 401);

  c.set('auth', payload as AuthTokenPayload);
  await next();
}
