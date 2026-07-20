import { pgQuery } from '../db-pool.js';

export const set = async (key: string, value: unknown): Promise<void> => {
  const { rowCount } = await pgQuery(
    `INSERT INTO public.kv_store_b1600651 (key, value)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );
  if (rowCount === 0) throw new Error('Falha ao gravar kv_store');
};

export const get = async (key: string): Promise<unknown> => {
  const result = await pgQuery<{ value: unknown }>(
    `SELECT value FROM public.kv_store_b1600651 WHERE key = $1 LIMIT 1`,
    [key],
  );
  return result.rows[0]?.value ?? null;
};

export const del = async (key: string): Promise<void> => {
  await pgQuery(`DELETE FROM public.kv_store_b1600651 WHERE key = $1`, [key]);
};

export const getByPrefix = async (prefix: string): Promise<unknown[]> => {
  const result = await pgQuery<{ value: unknown }>(
    `SELECT value FROM public.kv_store_b1600651 WHERE key LIKE $1`,
    [`${prefix}%`],
  );
  return result.rows.map((row) => row.value);
};
