import { isPostgresConfigured } from '../config.js';
import * as kvPg from './kv-store-pg.js';
import * as kvSupabase from './kv-store-supabase.js';

export const set = (key: string, value: unknown) =>
  isPostgresConfigured() ? kvPg.set(key, value) : kvSupabase.set(key, value);

export const get = (key: string) =>
  isPostgresConfigured() ? kvPg.get(key) : kvSupabase.get(key);

export const del = (key: string) =>
  isPostgresConfigured() ? kvPg.del(key) : kvSupabase.del(key);

export const getByPrefix = (prefix: string) =>
  isPostgresConfigured() ? kvPg.getByPrefix(prefix) : kvSupabase.getByPrefix(prefix);
