import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/constants/limits";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/008_trip_tables.sql"), "utf8");

function tableBody(table: string): string {
  const match = new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!match) throw new Error(`table ${table} not found`);
  return match[1];
}

function lengthLimit(table: string, column: string): number {
  const match = new RegExp(`char_length\\(${column}\\) (?:<= |between 1 and )(\\d+)`).exec(tableBody(table));
  if (!match) throw new Error(`${table}.${column} has no length check`);
  return Number(match[1]);
}

describe("008_trip_tables limits mirror LIMITS", () => {
  const cases: [string, string, number][] = [
    ["trip_days", "id", LIMITS.id],
    ["trip_days", "label", LIMITS.label],
    ["trip_days", "sub", LIMITS.label],
    ["trip_events", "id", LIMITS.id],
    ["trip_events", "title", LIMITS.title],
    ["trip_events", "cat", LIMITS.id],
    ["trip_events", "note", LIMITS.note],
    ["trip_day_spans", "label", LIMITS.label],
    ["trip_spans", "label", LIMITS.label],
    ["trip_expenses", "label", LIMITS.label],
    ["trip_tasks", "title", LIMITS.title],
    ["trip_tasks", "note", LIMITS.note],
    ["trip_tasks", "cat", LIMITS.id],
    ["trip_task_options", "label", LIMITS.label],
    ["trip_task_options", "note", LIMITS.note],
    ["trip_travelers", "name", LIMITS.name],
  ];

  it.each(cases)("%s.%s", (table, column, limit) => {
    expect(lengthLimit(table, column)).toBe(limit);
  });

  it("every trip table carries the concurrency columns", () => {
    for (const table of ["trip_days", "trip_events", "trip_day_spans", "trip_spans", "trip_expenses", "trip_tasks", "trip_task_options", "trip_travelers"]) {
      const body = tableBody(table);
      expect(body).toMatch(/version\s+int not null default 1/);
      expect(body).toMatch(/updated_at\s+timestamptz not null default now\(\)/);
      expect(body).toMatch(/updated_by\s+uuid/);
      expect(body).toMatch(/primary key \(room_code, id\)/);
    }
  });
});

describe("009_trip_tables_rls locks down every trip table", () => {
  const rls = readFileSync(join(process.cwd(), "supabase/migrations/009_trip_tables_rls.sql"), "utf8");
  const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);

  it("covers all tables created in 008", () => {
    expect(tables).toHaveLength(9);
  });

  it.each(tables)("%s has RLS and no client writes", (table) => {
    expect(rls).toContain(`alter table public.${table} enable row level security;`);
    expect(rls).toMatch(new RegExp(`revoke all on table public\.${table} from anon`));
    if (table === "trip_changes") return;
    expect(rls).toMatch(new RegExp(`create policy "members only" on public\\.${table}\\s+as restrictive for all\\s+to anon, authenticated`));
    expect(rls).toContain(`revoke insert, update, delete, truncate, references, trigger on table public.${table} from authenticated;`);
  });

  it("adds no permissive policy", () => {
    expect(rls).not.toMatch(/create policy (?![^;]*as restrictive)/);
  });
});

describe("010_trip_triggers wires history and Broadcast", () => {
  const triggers = readFileSync(join(process.cwd(), "supabase/migrations/010_trip_triggers.sql"), "utf8");
  const tripTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)]
    .map((m) => m[1])
    .filter((t) => t !== "trip_changes");

  it.each(tripTables)("%s has audit and broadcast triggers", (table) => {
    for (const fn of ["record_trip_change", "broadcast_trip_change"]) {
      expect(triggers).toMatch(
        new RegExp(`after insert or update or delete on public\\.${table}\\s+for each row execute function private\\.${fn}\\(\\);`),
      );
    }
  });

  it("keeps functions out of public and realtime, with a pinned search_path", () => {
    const fns = [...triggers.matchAll(/create or replace function ([\w.]+)\(\)[\s\S]*?as \$\$/g)];
    expect(fns.map((m) => m[1])).toEqual([
      "private.record_trip_change",
      "private.broadcast_trip_change",
      "private.prune_trip_changes",
    ]);
    for (const m of fns) expect(m[0]).toContain("set search_path = ''");
    for (const m of fns) expect(triggers).toContain(`revoke all on function ${m[1]}() from public, anon, authenticated;`);
  });

  it("lets members receive but not send on trip channels", () => {
    expect(triggers).toMatch(/on realtime\.messages\s+for select\s+to authenticated/);
    expect(triggers).not.toMatch(/on realtime\.messages\s+for (insert|all)/);
    expect(triggers).toContain("'trip:' || ur.room_code = (select realtime.topic())");
  });
});
