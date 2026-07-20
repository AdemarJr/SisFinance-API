/**
 * Define senha bcrypt do admin em clientes_sistema (modo Postgres direto).
 * Uso: npm run set-admin-password
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = stripQuotes(trimmed.slice(eq + 1));
    if (!process.env[key]) process.env[key] = value;
  }
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return stripQuotes(process.env.DATABASE_URL);
  const host = process.env.PGHOST;
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD ?? '';
  const port = process.env.PGPORT || '5432';
  if (!host || !database || !user) return '';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=${process.env.PGSSLMODE || 'disable'}`;
}

loadEnvFile();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sisfinance.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const databaseUrl = buildDatabaseUrl();

if (!databaseUrl) {
  console.error('❌ Defina DATABASE_URL (ou PGHOST/PGDATABASE/PGUSER) em .env');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function main() {
  await pool.query(`
    ALTER TABLE public.clientes_sistema
    ADD COLUMN IF NOT EXISTS senha_hash text
  `);

  const senhaHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const result = await pool.query(
    `UPDATE public.clientes_sistema
     SET senha_hash = $1, updated_at = now()
     WHERE lower(email) = lower($2)
     RETURNING id, email`,
    [senhaHash, ADMIN_EMAIL],
  );

  if (!result.rows[0]) {
    throw new Error(`Usuário ${ADMIN_EMAIL} não encontrado em clientes_sistema`);
  }

  console.log(`✅ Senha definida para ${result.rows[0].email} (${result.rows[0].id})`);
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
