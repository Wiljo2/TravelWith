// Prepares a browser session for one of the staging test users, because the
// app only offers Google sign-in. It signs in with email + password (the
// accounts created for the 0.1 spike) and writes a snippet that stores the
// session exactly where supabase-js keeps it.
//
//   node docs/plans/staging-test/login.mjs a      -> session-a.js.local
//   node docs/plans/staging-test/login.mjs b      -> session-b.js.local
//
// Open the app (http://localhost:3001) in the browser, paste the snippet in
// the DevTools console, reload. Use two browser profiles (or a normal and a
// private window) to be both users at once. Tokens last about an hour: run
// the script again for a new snippet.

import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const who = process.argv[2];
const file = { a: "docs/plans/spike/.env.spike.local", b: "docs/plans/spike/.env.spike-b.local" }[who];
if (!file) {
  console.error("Usage: node docs/plans/staging-test/login.mjs a|b");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

let stored;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    storage: {
      getItem: () => null,
      setItem: (key, value) => { stored = { key, value }; },
      removeItem: () => {},
    },
  },
});

const { error } = await supabase.auth.signInWithPassword({ email: env.SPIKE_EMAIL, password: env.SPIKE_PASSWORD });
if (error || !stored) {
  console.error("Sign-in failed:", error?.message ?? "no session stored");
  process.exit(1);
}

const out = `docs/plans/staging-test/session-${who}.js.local`;
fs.writeFileSync(out, `localStorage.setItem(${JSON.stringify(stored.key)}, ${JSON.stringify(stored.value)}); location.reload();\n`);
console.log(`User ${who.toUpperCase()}: wrote ${out} (storage key ${stored.key}). Open it, copy everything, paste it in the browser console.`);
