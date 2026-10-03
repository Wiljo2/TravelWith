#!/usr/bin/env node
// MapLibre loads its web worker from a URL next to its own module, which the
// Next.js bundle doesn't provide. This publishes the worker (and the code it
// imports) as static files under a versioned path; TripMap points MapLibre at
// them with setWorkerUrl. Runs after every install (package.json "postinstall").
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "maplibre-gl", "dist");
const { version } = JSON.parse(readFileSync(join(root, "node_modules", "maplibre-gl", "package.json"), "utf8"));
const out = join(root, "public", "vendor", `maplibre-${version}`);
mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, file), join(out, file));
console.log(`maplibre worker ${version} → public/vendor/maplibre-${version}`);
