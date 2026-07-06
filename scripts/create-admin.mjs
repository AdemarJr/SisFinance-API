/**
 * Cria usuário admin no Supabase Auth + clientes_sistema.
 * Uso: node scripts/create-admin.mjs
 * Env: carrega ../.env via --env-file (Node 20+) ou variáveis do ambiente.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sisfinance.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou SERVICE_ROLE) em server/.env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensurePlanos() {
  const { data: existing } = await supabase.from('planos_assinatura').select('id').limit(1);
  if (existing?.length) return;

  const { error } = await supabase.from('planos_assinatura').insert([
    { nome: 'Gratuito', limite_empresas: 1, preco_mensal: 0, descricao: '1 empresa' },
    { nome: 'Iniciante', limite_empresas: 3, preco_mensal: 97, descricao: 'Até 3 empresas' },
    { nome: 'Profissional', limite_empresas: 10, preco_mensal: 297, descricao: 'Até 10 empresas' },
    {
      nome: 'Enterprise',
      limite_empresas: 999999,
      preco_mensal: 997,
      descricao: 'Empresas ilimitadas',
    },
  ]);
  if (error) throw new Error(`Planos: ${error.message}`);
  console.log('✓ Planos criados');
}

async function findOrCreateAuthUser() {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw new Error(`List users: ${listError.message}`);

  const found = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (found) {
    console.log(`✓ Usuário Auth já existe: ${found.id}`);
    return found;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { nome_completo: ADMIN_NAME },
  });
  if (error || !data.user) throw new Error(`Create user: ${error?.message}`);
  console.log(`✓ Usuário Auth criado: ${data.user.id}`);
  return data.user;
}

async function ensureClienteSistema(authUserId) {
  const { data: existing } = await supabase
    .from('clientes_sistema')
    .select('id, email, is_super_admin')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('clientes_sistema')
      .update({
        auth_user_id: authUserId,
        is_super_admin: true,
        status: 'Ativo',
        nome_completo: ADMIN_NAME,
      })
      .eq('id', existing.id);
    if (error) throw new Error(`Update clientes_sistema: ${error.message}`);
    console.log('✓ clientes_sistema atualizado (super admin)');
    return existing.id;
  }

  const { data: plano } = await supabase
    .from('planos_assinatura')
    .select('id')
    .eq('nome', 'Enterprise')
    .single();

  if (!plano) throw new Error('Plano Enterprise não encontrado');

  const { data, error } = await supabase
    .from('clientes_sistema')
    .insert({
      auth_user_id: authUserId,
      nome_completo: ADMIN_NAME,
      email: ADMIN_EMAIL,
      plano_id: plano.id,
      limite_empresas: 999999,
      is_super_admin: true,
      status: 'Ativo',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Insert clientes_sistema: ${error.message}`);
  console.log('✓ clientes_sistema criado');
  return data.id;
}

async function linkEmpresas(clienteSistemaId) {
  const { data: empresas, error: selectError } = await supabase
    .from('empresas')
    .select('id')
    .is('cliente_sistema_id', null);

  if (selectError) {
    if (selectError.code === '42703') {
      console.log('⚠ Coluna empresas.cliente_sistema_id ausente — rode supabase-auth-incremental.sql');
      return;
    }
    throw new Error(`Empresas: ${selectError.message}`);
  }

  if (!empresas?.length) {
    console.log('✓ Nenhuma empresa sem vínculo');
    return;
  }

  const { error } = await supabase
    .from('empresas')
    .update({ cliente_sistema_id: clienteSistemaId })
    .is('cliente_sistema_id', null);

  if (error) throw new Error(`Vincular empresas: ${error.message}`);
  console.log(`✓ ${empresas.length} empresa(s) vinculada(s) ao admin`);
}

async function main() {
  console.log(`Criando admin: ${ADMIN_EMAIL}\n`);

  await ensurePlanos();
  const authUser = await findOrCreateAuthUser();
  const clienteId = await ensureClienteSistema(authUser.id);
  await linkEmpresas(clienteId);

  console.log('\n✅ Admin pronto para login.');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Senha: ${ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error('\n❌', err.message);
  if (err.message.includes('clientes_sistema')) {
    console.error('\n→ Execute primeiro: supabase-auth-incremental.sql no SQL Editor do Supabase');
  }
  process.exit(1);
});
