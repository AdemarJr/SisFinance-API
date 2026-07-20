import { getAdminClient } from './supabase-admin.js';
import { isPostgresConfigured } from './config.js';
import { executeDbQueryPg, executeRpcPg } from './query-executor-pg.js';

export type FilterOp = 'eq' | 'gte' | 'lte' | 'in' | 'not';

export interface DbFilter {
  op: FilterOp;
  column: string;
  /** Para `not`: [operator, value] — ex.: ['is', null] */
  value: unknown;
}

export interface DbQueryPayload {
  table: string;
  type: 'select' | 'insert' | 'update' | 'delete';
  select?: string;
  data?: unknown;
  filters?: DbFilter[];
  order?: { column: string; ascending?: boolean };
  single?: boolean;
}

export interface RpcPayload {
  function: string;
  params?: Record<string, unknown>;
}

function applyFilters(query: any, filters: DbFilter[] = []) {
  let q = query;
  for (const filter of filters) {
    if (filter.op === 'not') {
      const [operator, value] = Array.isArray(filter.value)
        ? (filter.value as [string, unknown])
        : ['is', filter.value];
      q = q.not(filter.column, operator, value);
      continue;
    }
    q = q[filter.op](filter.column, filter.value);
  }
  return q;
}

export async function executeDbQuery(payload: DbQueryPayload) {
  if (isPostgresConfigured()) {
    return executeDbQueryPg(payload);
  }

  const supabase = getAdminClient();
  const filters = payload.filters ?? [];

  try {
    if (payload.type === 'select') {
      let query: any = supabase.from(payload.table).select(payload.select ?? '*');
      query = applyFilters(query, filters);
      if (payload.order) {
        query = query.order(payload.order.column, {
          ascending: payload.order.ascending ?? true,
        });
      }
      if (payload.single) {
        query = query.single();
      }
      const result = await query;
      return { data: result.data, error: result.error };
    }

    if (payload.type === 'insert') {
      const result = await supabase.from(payload.table).insert(payload.data as never);
      return { data: result.data, error: result.error };
    }

    if (payload.type === 'update') {
      let query: any = supabase.from(payload.table).update(payload.data as never);
      query = applyFilters(query, filters);
      const result = await query;
      return { data: result.data, error: result.error };
    }

    if (payload.type === 'delete') {
      let query: any = supabase.from(payload.table).delete();
      query = applyFilters(query, filters);
      const result = await query;
      return { data: result.data, error: result.error };
    }

    return { data: null, error: { message: 'Operação inválida' } };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function executeRpc(payload: RpcPayload) {
  if (isPostgresConfigured()) {
    return executeRpcPg(payload.function, payload.params ?? {});
  }

  const supabase = getAdminClient();
  const result = await supabase.rpc(payload.function, payload.params ?? {});
  return { data: result.data, error: result.error };
}
