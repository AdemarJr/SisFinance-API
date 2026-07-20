import { pgQuery } from './db-pool.js';
import type { DbFilter, DbQueryPayload } from './query-executor.js';

function assertIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Identificador inválido: ${name}`);
  }
  return name;
}

function normalizeSelect(select?: string): string {
  if (!select || select.includes(':')) return '*';
  return select;
}

function buildWhere(filters: DbFilter[], startIdx = 1) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let idx = startIdx;

  for (const filter of filters) {
    const column = assertIdentifier(filter.column);

    if (filter.op === 'eq') {
      clauses.push(`${column} = $${idx++}`);
      values.push(filter.value);
      continue;
    }

    if (filter.op === 'gte') {
      clauses.push(`${column} >= $${idx++}`);
      values.push(filter.value);
      continue;
    }

    if (filter.op === 'lte') {
      clauses.push(`${column} <= $${idx++}`);
      values.push(filter.value);
      continue;
    }

    if (filter.op === 'in') {
      clauses.push(`${column} = ANY($${idx++})`);
      values.push(filter.value);
      continue;
    }

    if (filter.op === 'not') {
      const [operator, value] = Array.isArray(filter.value)
        ? (filter.value as [string, unknown])
        : ['is', filter.value];

      if (operator === 'is' && value === null) {
        clauses.push(`${column} IS NOT NULL`);
      } else if (operator === 'eq') {
        clauses.push(`${column} IS DISTINCT FROM $${idx++}`);
        values.push(value);
      } else {
        clauses.push(`NOT (${column} ${operator} $${idx++})`);
        values.push(value);
      }
    }
  }

  return {
    sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
    values,
    nextIdx: idx,
  };
}

export async function executeDbQueryPg(payload: DbQueryPayload) {
  const table = assertIdentifier(payload.table);
  const filters = payload.filters ?? [];

  try {
    if (payload.type === 'select') {
      const select = normalizeSelect(payload.select);
      const { sql: where, values } = buildWhere(filters);
      let sql = `SELECT ${select} FROM public.${table}${where}`;

      if (payload.order) {
        const orderCol = assertIdentifier(payload.order.column);
        sql += ` ORDER BY ${orderCol} ${payload.order.ascending === false ? 'DESC' : 'ASC'}`;
      }
      if (payload.single) sql += ' LIMIT 1';

      const result = await pgQuery(sql, values);
      if (payload.single) {
        if (!result.rows[0]) {
          return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
        }
        return { data: result.rows[0], error: null };
      }
      return { data: result.rows, error: null };
    }

    if (payload.type === 'insert') {
      const rows = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (!rows.length || !rows[0]) {
        return { data: null, error: { message: 'Dados vazios' } };
      }

      const keys = Object.keys(rows[0] as object);
      keys.forEach(assertIdentifier);
      const values: unknown[] = [];
      const placeholders = rows.map((row, rowIndex) => {
        const ph = keys.map((key, keyIndex) => {
          values.push((row as Record<string, unknown>)[key]);
          return `$${rowIndex * keys.length + keyIndex + 1}`;
        });
        return `(${ph.join(', ')})`;
      });

      const sql = `INSERT INTO public.${table} (${keys.join(', ')}) VALUES ${placeholders.join(', ')} RETURNING *`;
      const result = await pgQuery(sql, values);
      return {
        data: Array.isArray(payload.data) ? result.rows : result.rows[0] ?? null,
        error: null,
      };
    }

    if (payload.type === 'update') {
      const data = payload.data as Record<string, unknown>;
      const setKeys = Object.keys(data);
      setKeys.forEach(assertIdentifier);

      const setParts = setKeys.map((key, index) => `${key} = $${index + 1}`);
      const setValues = setKeys.map((key) => data[key]);
      const { sql: where, values: whereValues } = buildWhere(filters, setKeys.length + 1);

      const sql = `UPDATE public.${table} SET ${setParts.join(', ')}${where} RETURNING *`;
      const result = await pgQuery(sql, [...setValues, ...whereValues]);
      return { data: result.rows, error: null };
    }

    if (payload.type === 'delete') {
      const { sql: where, values } = buildWhere(filters);
      const sql = `DELETE FROM public.${table}${where} RETURNING *`;
      const result = await pgQuery(sql, values);
      return { data: result.rows, error: null };
    }

    return { data: null, error: { message: 'Operação inválida' } };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export async function executeRpcPg(functionName: string, params: Record<string, unknown> = {}) {
  try {
    const fn = assertIdentifier(functionName);
    const keys = Object.keys(params);
    keys.forEach(assertIdentifier);
    const values = keys.map((key) => params[key]);
    const placeholders = keys.map((_, index) => `$${index + 1}`);

    const sql =
      keys.length > 0
        ? `SELECT * FROM public.${fn}(${placeholders.join(', ')})`
        : `SELECT * FROM public.${fn}()`;

    const result = await pgQuery(sql, values);
    return { data: result.rows, error: null };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}
