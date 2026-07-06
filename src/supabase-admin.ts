import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured, isAnonConfigured, isServiceRoleConfigured } from './config.js';

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada em server/.env — veja Supabase Dashboard → Settings → API'
    );
  }
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function getAnonClient(): SupabaseClient {
  if (!isSupabaseConfigured() || !isAnonConfigured()) {
    throw new Error('SUPABASE_ANON_KEY não configurada em server/.env');
  }
  if (!anonClient) {
    anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}
