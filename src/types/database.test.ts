import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  Database,
  TripChangeRow,
  TripDayRow,
  TripDocumentRow,
  TripEventPlaceRow,
  TripIdeaRow,
  TripDaySpanRow,
  TripEventRow,
  TripExpenseRow,
  TripSpanRow,
  TripTaskOptionRow,
  TripTaskRow,
  TripTravelerRow,
} from "@/types/database";

const sql = ["008_trip_tables.sql", "018_main_features_tables.sql"]
  .map((f) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8"))
  .join("\n");

function sqlColumns(table: string): string[] {
  const match = new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!match) throw new Error(`table ${table} not found`);
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+\s/.test(line) && !/^(primary|foreign|constraint)\b/.test(line))
    .map((line) => line.split(/\s+/)[0])
    .concat([...sql.matchAll(new RegExp(`alter table public\\.${table} add column if not exists ([a-z_]+)`, "g"))].map((m) => m[1]))
    .sort();
}

type Columns<Row> = Record<keyof Row, true>;
const meta = { room_code: true, id: true, version: true, updated_at: true, updated_by: true } as const;

const typed: Record<string, string[]> = {
  trip_days: Object.keys({ ...meta, position: true, label: true, sub: true, flexible: true } satisfies Columns<TripDayRow>),
  trip_events: Object.keys({
    ...meta, day_id: true, position: true, start_hour: true, end_hour: true, title: true, cat: true, note: true,
    maps_url: true, document_id: true,
  } satisfies Columns<TripEventRow>),
  trip_day_spans: Object.keys({
    ...meta, day_id: true, position: true, label: true, start_event_id: true, end_event_id: true,
    start_hour: true, end_hour: true, bg: true, border: true, z_index: true,
  } satisfies Columns<TripDaySpanRow>),
  trip_spans: Object.keys({
    ...meta, position: true, label: true, start_event_id: true, end_event_id: true, bg: true, border: true, z_index: true,
  } satisfies Columns<TripSpanRow>),
  trip_expenses: Object.keys({
    ...meta, position: true, label: true, amount: true, currency: true, split_mode: true,
    linked_event_id: true, start_day_id: true, end_day_id: true, document_id: true,
  } satisfies Columns<TripExpenseRow>),
  trip_tasks: Object.keys({
    ...meta, position: true, title: true, done: true, note: true, day_id: true,
    start_hour: true, end_hour: true, cat: true, priority: true,
  } satisfies Columns<TripTaskRow>),
  trip_task_options: Object.keys({
    ...meta, task_id: true, position: true, label: true, note: true, amount: true, currency: true, split_mode: true,
  } satisfies Columns<TripTaskOptionRow>),
  trip_travelers: Object.keys({ ...meta, position: true, name: true } satisfies Columns<TripTravelerRow>),
  trip_documents: Object.keys({
    ...meta, position: true, drive_file_id: true, title: true, kind: true,
  } satisfies Columns<TripDocumentRow>),
  trip_ideas: Object.keys({ ...meta, position: true, data: true } satisfies Columns<TripIdeaRow>),
  trip_event_places: Object.keys({ ...meta, data: true } satisfies Columns<TripEventPlaceRow>),
  trip_changes: Object.keys({
    id: true, room_code: true, table_name: true, row_id: true, op: true, before: true, after: true, user_id: true, created_at: true,
  } satisfies Columns<TripChangeRow>),
};

describe("database types match 008_trip_tables and 018_main_features_tables", () => {
  it.each(Object.keys(typed))("%s columns", (table) => {
    expect([...typed[table]].sort()).toEqual(sqlColumns(table));
  });

  it("types supabase-js queries on the trip tables", () => {
    const client = createClient<Database>("http://localhost:54321", "anon-key", { auth: { persistSession: false } });
    const query = client.from("trip_events").select("*").eq("room_code", "ABCD1234").single();
    expectTypeOf<Awaited<typeof query>["data"]>().toEqualTypeOf<TripEventRow | null>();

    client.from("trip_expenses").insert({ room_code: "ABCD1234", id: "x1", label: "Hotel", amount: 100 });
    // @ts-expect-error amount is required on insert
    client.from("trip_expenses").insert({ room_code: "ABCD1234", id: "x1", label: "Hotel" });
  });
});
