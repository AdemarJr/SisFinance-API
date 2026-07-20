function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function env(name: string): string {
  return stripQuotes(process.env[name] || '');
}

function buildDatabaseUrl(): string {
  // Preferir variáveis separadas: senha com @ * ! não precisa de encode na URL
  const host = env('PGHOST');
  const database = env('PGDATABASE');
  const user = env('PGUSER');
  const password = env('PGPASSWORD');
  const port = env('PGPORT') || '5432';
  if (host && database && user) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);
    const sslmode = env('PGSSLMODE') || 'disable';
    return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}?sslmode=${sslmode}`;
  }

  return env('DATABASE_URL');
}

export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: env('JWT_SECRET') || 'sisfinance-dev-secret-change-me',
  databaseUrl: buildDatabaseUrl(),
  supabaseUrl: env('SUPABASE_URL'),
  // Suporta chaves legadas (JWT) e novas (sb_publishable_ / sb_secret_)
  supabaseAnonKey: env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY'),
  supabaseServiceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY'),
};

export function isPostgresConfigured(): boolean {
  return Boolean(config.databaseUrl);
}

export function envPresence() {
  return {
    JWT_SECRET: Boolean(env('JWT_SECRET')),
    DATABASE_URL: Boolean(config.databaseUrl),
    SUPABASE_URL: Boolean(env('SUPABASE_URL')),
    SUPABASE_PUBLISHABLE_KEY: Boolean(env('SUPABASE_PUBLISHABLE_KEY')),
    SUPABASE_ANON_KEY: Boolean(env('SUPABASE_ANON_KEY')),
    SUPABASE_SECRET_KEY: Boolean(env('SUPABASE_SECRET_KEY')),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env('SUPABASE_SERVICE_ROLE_KEY')),
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseUrl.startsWith('http'));
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(config.supabaseServiceRoleKey);
}

export function isAnonConfigured(): boolean {
  return Boolean(config.supabaseAnonKey);
}
