#!/usr/bin/env node
// Runs TravelWith locally. Works on macOS, Linux and Windows.
//
//   node scripts/dev.mjs                  against real Supabase data (needs .env.local)
//   node scripts/dev.mjs --local          mock data (or public/local-snapshot.json, see snapshot-room.mjs), no login, no database
//   node scripts/dev.mjs --port 3001 --open

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

const color = (code) => (msg) => console.log(`\x1b[${code}m${msg}\x1b[0m`);
const info = color(36);
const warn = color(33);
const ok = color(32);
const fail = (msg) => {
  console.error(`\x1b[31mx ${msg}\x1b[0m`);
  process.exit(1);
};

const { values: args } = parseArgs({
  options: {
    port: { type: "string", short: "p", default: "3000" },
    local: { type: "boolean", short: "l", default: false },
    open: { type: "boolean", short: "o", default: false },
  },
});

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  fail(`Node ${process.versions.node} is too old; Next.js 16 needs 20.9+.`);
}

const lock = join(root, "package-lock.json");
const installedLock = join(root, "node_modules", ".package-lock.json");
if (!existsSync(installedLock) || statSync(lock).mtimeMs > statSync(installedLock).mtimeMs) {
  info("> Installing dependencies...");
  const result = spawnSync("npm", ["install"], { cwd: root, stdio: "inherit", shell: isWindows });
  if (result.status !== 0) fail("npm install failed.");
}

if (!args.local) {
  const envFile = join(root, ".env.local");
  if (!existsSync(envFile)) {
    copyFileSync(join(root, ".env.example"), envFile);
    fail(".env.local was missing; created it from .env.example. Fill in the keys and run again (or use --local).");
  }
  const env = Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([\w.]+)\s*=\s*(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.trim()]),
  );
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
  ];
  const missing = required.filter((key) => !env[key] || /(xxxx|\.\.\.)$/.test(env[key]));
  if (missing.length) warn(`! Missing or placeholder values in .env.local: ${missing.join(", ")}`);
  warn("! Local dev shares the production database. Use a test room.");
}

const url = `http://localhost:${args.port}/${args.local ? "?local=1" : ""}`;

function openBrowser(target) {
  const [cmd, cmdArgs] = isWindows
    ? ["cmd", ["/c", "start", '""', target]]
    : [process.platform === "darwin" ? "open" : "xdg-open", [target]];
  spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
}

async function openWhenReady(target) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(target);
      return openBrowser(target);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

ok(`> Starting dev server at ${url}`);
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const server = spawn(process.execPath, [nextBin, "dev", "-p", args.port], { cwd: root, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));

if (args.open) openWhenReady(url);
