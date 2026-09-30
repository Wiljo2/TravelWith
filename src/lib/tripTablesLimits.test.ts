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
