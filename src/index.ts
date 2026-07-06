import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isSupabaseConfigured, isServiceRoleConfigured, isAnonConfigured, envPresence } from './config.js';
import { authRoutes } from './routes/auth.js';
import { dbRoutes } from './routes/db.js';
import { legacyRoutes } from './routes/legacy.js';

const app = new Hono();

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[\w-]+\.hostingersite\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function resolveCorsOrigin(origin: string | undefined): string {
  if (!origin) return '*';
  if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return origin;
  return origin;
}

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: resolveCorsOrigin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    maxAge: 86400,
  })
);

app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    supabase: isSupabaseConfigured(),
    anonKey: isAnonConfigured(),
    serviceRole: isServiceRoleConfigured(),
    jwt: Boolean(config.jwtSecret && config.jwtSecret !== 'sisfinance-dev-secret-change-me'),
    env: envPresence(),
  })
);

app.route('/api/auth', authRoutes);
app.route('/api/db', dbRoutes);
app.route('/api/make-server-b1600651', legacyRoutes);

/** Opcional: servir frontend estático (não usar no Railway — só API). */
const shouldServeStatic = process.env.SERVE_STATIC === 'true';

function resolveDistDir(): string {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const candidates = [join(process.cwd(), 'dist'), join(here, '../dist')];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  return candidates[0];
}

const distDir = resolveDistDir();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

if (shouldServeStatic && existsSync(distDir)) {
  app.get('*', async (c) => {
    const urlPath = c.req.path;
    if (urlPath.startsWith('/api')) {
      return c.json({ error: 'Not found' }, 404);
    }

    const safePath = urlPath.split('?')[0];
    const filePath = join(distDir, safePath === '/' ? 'index.html' : safePath);

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const body = readFileSync(filePath);
      const type = MIME[extname(filePath)] ?? 'application/octet-stream';
      return c.body(body, 200, { 'Content-Type': type });
    }

    const indexHtml = join(distDir, 'index.html');
    if (existsSync(indexHtml)) {
      return c.html(readFileSync(indexHtml, 'utf8'));
    }

    return c.text('Frontend não encontrado. Execute npm run build.', 404);
  });
}

serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: '0.0.0.0',
  },
  () => {
    console.log(`🚀 SisFinance API na porta ${config.port} (0.0.0.0)`);
    if (shouldServeStatic) {
      const distOk = existsSync(join(distDir, 'index.html'));
      console.log(`📦 Frontend estático: ${distDir} (${distOk ? 'ok' : 'NÃO ENCONTRADO'})`);
    }
    if (!isSupabaseConfigured()) {
      console.warn('⚠️  SUPABASE_URL não configurada');
    } else {
      if (!isAnonConfigured()) {
        console.warn('⚠️  SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY ausente — login falhará');
      }
      if (!isServiceRoleConfigured()) {
        console.warn('⚠️  Chave secret/service_role ausente — CRUD pode falhar');
      }
    }
  }
);
