function env(name: string): string {
  return (process.env[name] || '').trim();
}

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: env('JWT_SECRET') || 'sisfinance-dev-secret-change-me',
  supabaseUrl: env('SUPABASE_URL'),
  // Suporta chaves legadas (JWT) e novas (sb_publishable_ / sb_secret_)
  supabaseAnonKey: env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY'),
  supabaseServiceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY'),
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
