import pg from 'pg';
import dns from 'node:dns';
import { config, isPostgresConfigured } from './config.js';

// Prefere IPv4 (Railway às vezes falha em hosts só-IPv6 / ordem AAAA)
dns.setDefaultResultOrder('ipv4first');

const { Pool, types } = pg;

// NUMERIC / DECIMAL → number (node-pg devolve string por padrão)
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : value;
});
// DATE → 'YYYY-MM-DD' (evita Date → ISO UTC que quebra formatadores locais)
types.setTypeParser(types.builtins.DATE, (value) => value);

let pool: pg.Pool | null = null;

function poolOptions(): pg.PoolConfig {
  return {
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: false,
  };
}

export function getPool(): pg.Pool {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL (ou PGHOST/PGDATABASE/PGUSER) não configurada');
  }
  if (!pool) {
    pool = new Pool(poolOptions());
    pool.on('error', (err) => {
      console.error('Erro no pool Postgres:', err.message);
    });
  }
  return pool;
}

export async function pgQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/** Ping real ao banco (para /api/health). */
export async function pingDatabase(): Promise<{
  ok: boolean;
  latencyMs?: number;
  database?: string;
  error?: string;
}> {
  if (!isPostgresConfigured()) {
    return { ok: false, error: 'DATABASE_URL / PGHOST não configurado' };
  }
  const started = Date.now();
  try {
    const result = await getPool().query<{ db: string }>('SELECT current_database() AS db');
    return {
      ok: true,
      latencyMs: Date.now() - started,
      database: result.rows[0]?.db,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, latencyMs: Date.now() - started, error: message };
  }
}
