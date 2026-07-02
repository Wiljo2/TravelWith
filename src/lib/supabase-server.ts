import { createClient } from "@supabase/supabase-js";

// Server-only client — uses service role key, never sent to the browser.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Verifies a user JWT and returns the user (or null if invalid).
export async function getUserFromToken(token: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: { user } } = await client.auth.getUser(token);
  return user;
}
