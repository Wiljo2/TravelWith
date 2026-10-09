// Read-only check of every stored room payload against the payload schema.
// Run before the cut-over: rooms with issues may migrate with skipped rows.
//
//   npx tsx --env-file=.env.local scripts/check-payloads.ts
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never writes.

import { createClient } from "@supabase/supabase-js";
import { payloadIssues } from "@/lib/schemas";
import { validateRoomPayload } from "@/lib/validate";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const PAGE = 100;

// Wrapped in a function: tsx runs this file as CommonJS, without top-level await.
async function main(): Promise<number> {
  let checked = 0;
  let failing = 0;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("rooms")
      .select("code, payload")
      .order("code")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;

    for (const room of data) {
      checked++;
      const bytes = Buffer.byteLength(JSON.stringify(room.payload));
      const structural = validateRoomPayload(room.payload) ? [] : ["structural check failed"];
      const issues = [...structural, ...payloadIssues(room.payload)];
      if (issues.length) {
        failing++;
        console.log(`${room.code} (${bytes} bytes)`);
        for (const issue of issues) console.log(`  - ${issue}`);
      }
    }
  }

  console.log(`\n${checked} rooms checked, ${failing} with issues`);
  return failing ? 2 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
