// Phase 0 spike listener: signs in as a staging user, subscribes to the private
// channel trip:<code> and prints every broadcast exactly as the client gets it.
//
//   npx tsx --env-file=docs/plans/spike/.env.spike.local docs/plans/spike/listen.ts
//
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (staging),
// SPIKE_EMAIL, SPIKE_PASSWORD, SPIKE_ROOM, optional SPIKE_REFRESH_SECONDS to
// force a session refresh on an interval. Never prints tokens.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SPIKE_EMAIL;
const password = process.env.SPIKE_PASSWORD;
const room = process.env.SPIKE_ROOM?.toUpperCase();
const refreshSeconds = Number(process.env.SPIKE_REFRESH_SECONDS ?? 0);

if (!url || !anonKey || !email || !password || !room) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SPIKE_EMAIL, SPIKE_PASSWORD, SPIKE_ROOM");
  process.exit(1);
}

const log = (label: string, data?: unknown) =>
  console.log(`[${new Date().toISOString()}] ${label}`, data === undefined ? "" : JSON.stringify(data, null, 2));

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError || !signIn.session) {
  console.error("Sign-in failed:", signInError?.message);
  process.exit(1);
}
log("signed in", { userId: signIn.user.id, expiresAt: signIn.session.expires_at });

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event !== "TOKEN_REFRESHED" || !session) return;
  await supabase.realtime.setAuth(session.access_token);
  log("token refreshed, setAuth called", { expiresAt: session.expires_at });
});

await supabase.realtime.setAuth(signIn.session.access_token);

supabase
  .channel(`trip:${room}`, { config: { private: true } })
  .on("broadcast", { event: "*" }, (message) => {
    log(`broadcast ${message.event} (${Buffer.byteLength(JSON.stringify(message))} bytes)`, message);
  })
  .subscribe((status, err) => log(`channel status ${status}`, err ? { error: err.message } : undefined));

if (refreshSeconds > 0) {
  setInterval(async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) log("refresh failed", { error: error.message });
  }, refreshSeconds * 1000);
}
