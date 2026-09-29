// fetch() for the app's own API routes, carrying the Supabase session token.
// Room-scoped routes require it: membership is checked server-side.
export function apiFetch(path: string, accessToken: string | undefined, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(path, { ...init, headers });
}
