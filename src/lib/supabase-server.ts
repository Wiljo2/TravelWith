import { createClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Empty string counts as unset: `??` alone would happily pass "" as the key.
export function serviceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.trim() ? key : null;
}

let warned = false;

// Server-only client — uses service role key, never sent to the browser.
// Falling back to the anon key keeps the public `rooms` table working, but every
// `user_rooms` query silently returns nothing: its RLS policies match on
// auth.uid(), which is null for an anon client. That looks like "my trips
// disappeared" rather than an error, so say it out loud once.
export function createServerClient() {
  const key = serviceRoleKey();
  if (!key && !warned) {
    warned = true;
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key. " +
      "Rooms will load, but the trip list, joining and leaving (user_rooms) will not work.",
    );
  }
  return createClient(url(), key ?? anonKey(), { auth: { persistSession: false } });
}

// Verifies a user JWT and returns the user (or null if invalid).
export async function getUserFromToken(token: string) {
  const client = createClient(url(), anonKey(), { auth: { persistSession: false } });
  const { data: { user } } = await client.auth.getUser(token);
  return user;
}
