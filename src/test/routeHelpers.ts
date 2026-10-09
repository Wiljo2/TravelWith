// Shared state for route-handler tests: tests set `auth.users` (token → user)
// and `db.handler`, then import the route after `vi.mock` of supabase-server.

import { createSupabaseMock, type QueryHandler } from "@/test/supabaseMock";

export const auth: { users: Record<string, { id: string; email?: string; user_metadata?: Record<string, unknown> }> } = {
  users: {},
};

export const db: { handler: QueryHandler; mock: ReturnType<typeof createSupabaseMock> } = {
  handler: () => undefined,
  mock: createSupabaseMock(() => undefined),
};

export function resetDb(handler: QueryHandler) {
  db.handler = handler;
  db.mock = createSupabaseMock((q) => db.handler(q));
  return db.mock;
}

export const supabaseServerMock = {
  createServerClient: () => db.mock.client,
  getUserFromToken: async (token: string) => auth.users[token] ?? null,
  serviceRoleKey: () => "test",
};

export function request(method: string, token?: string, body?: unknown): Request {
  return new Request("http://localhost/api", {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const params = (code: string) => ({ params: Promise.resolve({ code }) });
