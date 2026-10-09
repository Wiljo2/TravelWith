// Runs the app against the STAGING Supabase project on http://localhost:3001,
// without touching .env.local (which points at production).
//
//   node docs/plans/staging-test/dev.mjs
//
// Needs .env.staging.local with the staging service_role key. Variables set
// here win over the ones Next reads from .env.local.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const env = Object.fromEntries(
  readFileSync(join(root, ".env.staging.local"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([\w.]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.trim()]),
);

if (!env.NEXT_PUBLIC_SUPABASE_URL?.includes("ddxxpcrgudllkgkyqqzw")) {
  console.error("x .env.staging.local does not point at the staging project (ddxxpcrgudllkgkyqqzw). Refusing to start.");
  process.exit(1);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("x SUPABASE_SERVICE_ROLE_KEY is empty in .env.staging.local. Paste the staging service_role key there.");
  process.exit(1);
}

console.log("> Starting the app against STAGING at http://localhost:3001");
const next = join(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [next, "dev", "-p", "3001"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ...env },
});
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
