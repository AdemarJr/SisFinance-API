import pg from 'pg';
import { config, isPostgresConfigured } from './config.js';

const { Pool, types } = pg;

// NUMERIC / DECIMAL → number (node-pg devolve string por padrão)
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));
types.setTypeParser(types.builtins.INT8, (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : value;
});

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL (ou PGHOST/PGDATABASE/PGUSER) não configurada');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
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
