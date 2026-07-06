export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'sisfinance-dev-secret-change-me',
  supabaseUrl: process.env.SUPABASE_URL || '',
  // Suporta chaves legadas (JWT) e novas (sb_publishable_ / sb_secret_)
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseUrl.startsWith('http'));
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(config.supabaseServiceRoleKey);
}

export function isAnonConfigured(): boolean {
  return Boolean(config.supabaseAnonKey);
}
