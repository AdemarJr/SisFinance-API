import bcrypt from 'bcryptjs';
import { pgQuery } from '../db-pool.js';

export async function loadClienteSistemaPg(authUserId: string) {
  const byAuth = await pgQuery(
    `SELECT c.*,
            row_to_json(p.*) AS plano
     FROM public.clientes_sistema c
     JOIN public.planos_assinatura p ON p.id = c.plano_id
     WHERE c.auth_user_id = $1
     LIMIT 1`,
    [authUserId],
  );

  if (byAuth.rows[0]) return byAuth.rows[0];

  const byId = await pgQuery(
    `SELECT c.*,
            row_to_json(p.*) AS plano
     FROM public.clientes_sistema c
     JOIN public.planos_assinatura p ON p.id = c.plano_id
     WHERE c.id = $1
     LIMIT 1`,
    [authUserId],
  );

  return byId.rows[0] ?? null;
}

export async function loginWithPostgres(email: string, password: string) {
  const result = await pgQuery<{
    id: string;
    auth_user_id: string | null;
    email: string;
    senha_hash: string | null;
    is_super_admin: boolean;
  }>(
    `SELECT id, auth_user_id, email, senha_hash, is_super_admin
     FROM public.clientes_sistema
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email],
  );

  const user = result.rows[0];
  if (!user?.senha_hash) {
    return { ok: false as const, error: 'Credenciais inválidas' };
  }

  const valid = await bcrypt.compare(password, user.senha_hash);
  if (!valid) {
    return { ok: false as const, error: 'Credenciais inválidas' };
  }

  const authUserId = user.auth_user_id ?? user.id;
  const clienteSistema = await loadClienteSistemaPg(authUserId);

  return {
    ok: true as const,
    authUserId,
    email: user.email,
    isSuperAdmin: user.is_super_admin,
    clienteSistema,
  };
}

export async function createAdminUserPg(input: {
  email: string;
  password: string;
  nome_completo: string;
  telefone?: string;
  documento?: string;
  plano_id: string;
  limite_empresas: number;
  status: string;
}) {
  const senhaHash = await bcrypt.hash(input.password, 10);
  const result = await pgQuery(
    `INSERT INTO public.clientes_sistema (
       nome_completo, email, telefone, documento, plano_id,
       limite_empresas, status, is_super_admin, senha_hash
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
     RETURNING id`,
    [
      input.nome_completo,
      input.email,
      input.telefone ?? null,
      input.documento ?? null,
      input.plano_id,
      input.limite_empresas,
      input.status,
      senhaHash,
    ],
  );

  return result.rows[0]?.id as string;
}

export async function updateUserPasswordPg(authUserId: string, password: string) {
  const senhaHash = await bcrypt.hash(password, 10);
  const result = await pgQuery(
    `UPDATE public.clientes_sistema
     SET senha_hash = $1, updated_at = now()
     WHERE auth_user_id = $2 OR id = $2
     RETURNING id`,
    [senhaHash, authUserId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('Usuário não encontrado');
  }
}
