// Minimal chainable fake of the supabase-js query builder for route and store
// tests. Every awaited query is recorded and answered by the test's handler.

export type QueryOp = "select" | "insert" | "update" | "delete" | "upsert" | "rpc";

export interface RecordedQuery {
  table: string;
  op: QueryOp;
  values?: unknown;
  columns?: string;
  filters: { column: string; op: string; value: unknown }[];
  single: boolean;
  args?: unknown;
}

export interface QueryResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type QueryHandler = (q: RecordedQuery) => QueryResult | undefined;

function builder(table: string, handler: QueryHandler, log: RecordedQuery[]) {
  const q: RecordedQuery = { table, op: "select", filters: [], single: false };
  const run = () => {
    log.push(q);
    const r = handler(q) ?? {};
    return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
  };
  const chain = {
    select(columns?: string) {
      if (q.op === "select") q.columns = columns;
      return chain;
    },
    insert(values: unknown) { q.op = "insert"; q.values = values; return chain; },
    update(values: unknown) { q.op = "update"; q.values = values; return chain; },
    upsert(values: unknown) { q.op = "upsert"; q.values = values; return chain; },
    delete() { q.op = "delete"; return chain; },
    eq(column: string, value: unknown) { q.filters.push({ column, op: "eq", value }); return chain; },
    in(column: string, value: unknown) { q.filters.push({ column, op: "in", value }); return chain; },
    gte(column: string, value: unknown) { q.filters.push({ column, op: "gte", value }); return chain; },
    order() { return chain; },
    limit() { return chain; },
    maybeSingle() { q.single = true; return Promise.resolve(run()); },
    single() { q.single = true; return Promise.resolve(run()); },
    then<T>(resolve: (v: ReturnType<typeof run>) => T, reject?: (e: unknown) => T) {
      return Promise.resolve(run()).then(resolve, reject);
    },
  };
  return chain;
}

export function createSupabaseMock(handler: QueryHandler) {
  const log: RecordedQuery[] = [];
  const client = {
    from: (table: string) => builder(table, handler, log),
    rpc: (fn: string, args: unknown) => {
      const q: RecordedQuery = { table: fn, op: "rpc", filters: [], single: false, args };
      log.push(q);
      const r = handler(q) ?? {};
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
  };
  return { client, log };
}

export function filterValue(q: RecordedQuery, column: string): unknown {
  return q.filters.find((f) => f.column === column)?.value;
}
