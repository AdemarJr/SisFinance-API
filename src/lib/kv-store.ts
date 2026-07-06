import { getAdminClient } from '../supabase-admin.js';

export const set = async (key: string, value: unknown): Promise<void> => {
  const supabase = getAdminClient();
  const { error } = await supabase.from('kv_store_b1600651').upsert({ key, value });
  if (error) throw new Error(error.message);
};

export const get = async (key: string): Promise<unknown> => {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('kv_store_b1600651')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value;
};

export const del = async (key: string): Promise<void> => {
  const supabase = getAdminClient();
  const { error } = await supabase.from('kv_store_b1600651').delete().eq('key', key);
  if (error) throw new Error(error.message);
};

export const getByPrefix = async (prefix: string): Promise<unknown[]> => {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('kv_store_b1600651')
    .select('value')
    .like('key', `${prefix}%`);
  if (error) throw new Error(error.message);
  return data?.map((d) => d.value) ?? [];
};
