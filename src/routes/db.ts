import { Hono } from 'hono';
import { requireAuth } from './auth.js';
import { executeDbQuery, executeRpc } from '../query-executor.js';
import type { DbQueryPayload } from '../query-executor.js';

export const dbRoutes = new Hono();

dbRoutes.use('*', requireAuth);

dbRoutes.post('/query', async (c) => {
  const payload = await c.req.json<DbQueryPayload>();
  const result = await executeDbQuery(payload);
  if (result.error) {
    return c.json(result, 400);
  }
  return c.json(result);
});

dbRoutes.post('/rpc', async (c) => {
  const payload = await c.req.json<{ function: string; params?: Record<string, unknown> }>();
  const result = await executeRpc(payload);
  if (result.error) {
    return c.json(result, 400);
  }
  return c.json(result);
});
