#!/usr/bin/env node
// Copies one room into public/local-snapshot.json so local mode (`npm run local:mock`)
// shows real trip data instead of the demo, without touching the database.
//
//   npm run snapshot -- <ROOM_CODE>
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. Never
// writes to Supabase. The snapshot is gitignored; delete it to go back to the demo.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const code = process.argv[2]?.trim().toUpperCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!code) {
  console.error("Usage: npm run snapshot -- <ROOM_CODE>");
  process.exit(1);
}
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.from("rooms").select("payload, members").eq("code", code).maybeSingle();
if (error) throw error;
if (!data) {
  console.error(`Room ${code} not found`);
  process.exit(1);
}

// Local mode has no members, so they become mock travelers to keep per-person math right.
const members = (data.members ?? []).map((m, i) => ({ id: `member-${i}`, name: m.name }));
const payload = { ...data.payload, mockPeople: [...members, ...(data.payload.mockPeople ?? [])] };

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "local-snapshot.json");
writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`Saved ${code} (${payload.days?.length ?? 0} days, ${payload.mockPeople.length} travelers) to public/local-snapshot.json`);
