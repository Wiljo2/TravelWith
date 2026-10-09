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

describe("013_trip_row_writes", () => {
  const writes = readFileSync(join(process.cwd(), "supabase/migrations/013_trip_row_writes.sql"), "utf8");
  const tripTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)]
    .map((m) => m[1])
    .filter((t) => t !== "trip_changes");

  it.each(tripTables)("%s bumps version on every effective update", (table) => {
    expect(writes).toMatch(
      new RegExp(`before update on public\\.${table}\\s+for each row execute function private\\.bump_trip_row_version\\(\\);`),
    );
  });

  it("delete_trip_row only touches trip tables and is server-only", () => {
    for (const table of tripTables) expect(writes).toContain(`'${table}'`);
    expect(writes).not.toContain("security definer");
    expect(writes).toContain("revoke all on function public.delete_trip_row(text, text, text, int, uuid) from public, anon, authenticated;");
    expect(writes).toContain("grant execute on function public.delete_trip_row(text, text, text, int, uuid) to service_role;");
  });
});

describe("014_get_trip", () => {
  const getTrip = readFileSync(join(process.cwd(), "supabase/migrations/014_get_trip.sql"), "utf8");

  it("is a server-only, invoker-rights read", () => {
    expect(getTrip).toContain("stable");
    expect(getTrip).toContain("set search_path = ''");
    expect(getTrip).not.toContain("security definer");
    expect(getTrip).toContain("revoke all on function public.get_trip(text) from public, anon, authenticated;");
    expect(getTrip).toContain("grant execute on function public.get_trip(text) to service_role;");
  });

  it("reads the tables, never the frozen payload, and returns versions", () => {
    expect(getTrip).not.toMatch(/r\.payload/);
    for (const alias of ["d", "e", "s", "x", "t", "o", "m"]) expect(getTrip).toContain(`'version', ${alias}.version`);
  });
});

describe("015_day_ops", () => {
  const dayOps = readFileSync(join(process.cwd(), "supabase/migrations/015_day_ops.sql"), "utf8");

  it("defines server-only invoker functions with a pinned search_path", () => {
    expect(dayOps).not.toContain("security definer");
    expect(dayOps.match(/set search_path = ''/g)).toHaveLength(2);
    for (const sig of ["swap_days(text, text, text, uuid)", "reset_itinerary(text, jsonb, uuid)"]) {
      expect(dayOps).toContain(`revoke all on function public.${sig} from public, anon, authenticated;`);
      expect(dayOps).toContain(`grant execute on function public.${sig} to service_role;`);
    }
  });

  it("attributes reset deletes to the acting user", () => {
    expect(dayOps).toContain("perform set_config('app.user_id', coalesce(p_user::text, ''), true);");
  });
});

describe("016_room_broadcast", () => {
  const room = readFileSync(join(process.cwd(), "supabase/migrations/016_room_broadcast.sql"), "utf8");

  it("sends header and roster only, never the frozen payload", () => {
    expect(room).not.toMatch(/'payload'|new\.payload|old\.payload/);
    expect(room).not.toContain("realtime.broadcast_changes(");
    expect(room.match(/perform realtime\.send\(/g)).toHaveLength(2);
  });

  it("skips bulk loads and runs from a locked-down private function", () => {
    expect(room).toContain("if current_setting('app.bulk_load', true) = 'on' then");
    expect(room).toContain("set search_path = ''");
    expect(room).toContain("revoke all on function private.broadcast_room_change() from public, anon, authenticated;");
  });
});

describe("017_task_ops", () => {
  const taskOps = readFileSync(join(process.cwd(), "supabase/migrations/017_task_ops.sql"), "utf8");

  it("swap_days also moves scheduled tasks", () => {
    expect(taskOps).toMatch(/update public\.trip_tasks\s+set day_id = case when day_id = p_a then p_b else p_a end/);
  });

  it("choose_task_option is server-only, guarded and attributed", () => {
    expect(taskOps).not.toContain("security definer");
    expect(taskOps).toContain("for update;");
    expect(taskOps).toContain("perform set_config('app.user_id', coalesce(p_user::text, ''), true);");
    expect(taskOps).toContain("revoke all on function public.choose_task_option(text, text, int, jsonb, jsonb, uuid) from public, anon, authenticated;");
    expect(taskOps).toContain("grant execute on function public.choose_task_option(text, text, int, jsonb, jsonb, uuid) to service_role;");
  });
});

describe("012_verify_rebuild", () => {
  const verify = readFileSync(join(process.cwd(), "supabase/migrations/012_verify_rebuild.sql"), "utf8");
  const fns = [...verify.matchAll(/create or replace function ([\w.]+)\(([^)]*)\)[\s\S]*?as \$\$/g)];

  it("defines private functions with a pinned search_path and no client access", () => {
    expect(fns.map((m) => m[1])).toEqual([
      "private.trip_payload",
      "private.verify_room",
      "private.verify_all_rooms",
      "private.rebuild_payload",
    ]);
    for (const [whole, name, params] of fns) {
      expect(whole).toContain("set search_path = ''");
      const types = params.split(",").map((p) => p.trim().split(/\s+/)[1]).filter(Boolean).join(", ");
      expect(verify).toContain(`revoke all on function ${name}(${types}) from public, anon, authenticated;`);
    }
  });

  it("assembles every RoomPayload collection", () => {
    for (const key of ["'days'", "'events'", "'spans'", "'extras'", "'tripSpans'", "'tasks'", "'options'", "'mockPeople'", "'exchangeRate'", "'trip'"]) {
      expect(verify).toContain(key);
    }
  });

  it("only rebuild_payload writes rooms.payload", () => {
    expect(verify.match(/set payload = /g)).toHaveLength(1);
    expect(verify).toMatch(/function private\.rebuild_payload[\s\S]*set payload = v_payload/);
  });
});

describe("011_migrate_rooms", () => {
  const migrate = readFileSync(join(process.cwd(), "supabase/migrations/011_migrate_rooms.sql"), "utf8");
  const fns = [...migrate.matchAll(/create or replace function ([\w.]+)\(([^)]*)\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/g)];

  it("defines only private functions with a pinned search_path and no client access", () => {
    expect(fns.length).toBeGreaterThan(0);
    for (const [whole, name, params] of fns) {
      expect(name.startsWith("private.")).toBe(true);
      expect(whole).toContain("set search_path = ''");
      const types = params.split(",").map((p) => p.trim().split(/\s+/)[1]).filter(Boolean).join(", ");
      expect(migrate).toContain(`revoke all on function ${name}(${types}) from public, anon, authenticated;`);
    }
  });

  it("keeps bulk loads out of history and Broadcast", () => {
    for (const name of ["private.record_trip_change", "private.broadcast_trip_change"]) {
      const body = fns.find((m) => m[1] === name)?.[3] ?? "";
      expect(body).toContain("if current_setting('app.bulk_load', true) = 'on' then");
    }
    const migrateRoom = fns.find((m) => m[1] === "private.migrate_room")?.[3] ?? "";
    expect(migrateRoom).toContain("perform set_config('app.bulk_load', 'on', true);");
    expect(migrateRoom).not.toMatch(/update public\.rooms\s+set payload/);
  });

  it("loads every trip table", () => {
    const tripTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    for (const table of tripTables.filter((t) => t !== "trip_changes")) {
      expect(migrate).toContain(`insert into public.${table} (`);
      expect(migrate).toContain(`delete from public.${table} where room_code = p_code;`);
    }
  });
});

describe("018_main_features_tables", () => {
  const m018 = readFileSync(join(process.cwd(), "supabase/migrations/018_main_features_tables.sql"), "utf8");
  const tables = [...m018.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);

  it("adds the documents, ideas and map places tables", () => {
    expect(tables).toEqual(["trip_documents", "trip_ideas", "trip_event_places"]);
  });

  it.each(tables)("%s is locked down, audited, broadcast and versioned like the other trip tables", (table) => {
    expect(m018).toContain(`primary key (room_code, id)`);
    expect(m018).toContain(`alter table public.${table} enable row level security;`);
    expect(m018).toMatch(new RegExp(`create policy "members only" on public\\.${table}\\s+as restrictive for all\\s+to anon, authenticated`));
    expect(m018).toContain(`revoke all on table public.${table} from anon;`);
    expect(m018).toContain(`revoke insert, update, delete, truncate, references, trigger on table public.${table} from authenticated;`);
    for (const fn of ["record_trip_change", "broadcast_trip_change"]) {
      expect(m018).toMatch(new RegExp(`after insert or update or delete on public\\.${table}\\s+for each row execute function private\\.${fn}\\(\\);`));
    }
    expect(m018).toMatch(new RegExp(`before update on public\\.${table}\\s+for each row execute function private\\.bump_trip_row_version\\(\\);`));
    expect(m018).toContain(`'${table}'`);
  });

  it("documents mirror LIMITS and the Drive id format", () => {
    expect(m018).toContain(`check (char_length(title) between 1 and ${LIMITS.documentTitle})`);
    expect(m018).toContain("check (drive_file_id ~ '^[A-Za-z0-9_-]{10,100}$')");
  });

  it("unlinks activities and expenses when their document goes, and keeps the event version guard", () => {
    expect(m018.match(/references public\.trip_documents \(room_code, id\)\s+on delete set null \(document_id\)/g)).toHaveLength(2);
    expect(m018).toMatch(/foreign key \(room_code, id\) references public\.trip_events \(room_code, id\) on delete cascade/);
    expect(m018).toContain("check (maps_url is null or (maps_url ~ '^https://'");
  });

  it("broadcasts the idea settings with the header but never the payload", () => {
    const fn = m018.slice(m018.indexOf("create or replace function private.broadcast_room_change"));
    expect(fn).toContain("'idea_places', new.idea_places, 'idea_plan', new.idea_plan");
    expect(fn).not.toMatch(/'payload'|new\.payload|old\.payload/);
    expect(fn).toContain("if current_setting('app.bulk_load', true) = 'on' then");
  });
});

describe("019_main_features_migration", () => {
  const m019 = readFileSync(join(process.cwd(), "supabase/migrations/019_main_features_migration.sql"), "utf8");

  it("wraps migrate_room and verify_room instead of rewriting them", () => {
    expect(m019).toContain("alter function private.migrate_room(text) rename to migrate_room_base;");
    expect(m019).toContain("alter function private.verify_room(text) rename to verify_room_base;");
    expect(m019).toContain("v_base := private.migrate_room_base(p_code);");
    expect(m019).toContain("v_diffs := private.verify_room_base(p_code);");
  });

  it("migrates the new data as a bulk load", () => {
    const extras = m019.slice(m019.indexOf("create or replace function private.migrate_room_extras"), m019.indexOf("create or replace function private.migrate_room(p_code"));
    expect(extras).toContain("perform set_config('app.bulk_load', 'on', true);");
    expect(extras).toContain("perform set_config('app.bulk_load', 'off', true);");
    for (const table of ["trip_documents", "trip_ideas", "trip_event_places"]) expect(extras).toContain(`insert into public.${table}`);
  });

  it("verifies every new area", () => {
    for (const area of ["documents", "ideas", "eventPlaces", "eventMapsUrls", "eventDocuments", "expenseDocuments", "ideaPlaces", "ideaPlan"]) {
      expect(m019).toContain(`'${area}'`);
    }
  });

  it("returns the new fields from trip_payload and get_trip", () => {
    for (const fn of ["private.trip_payload", "public.get_trip"]) {
      const body = m019.slice(m019.indexOf(`create or replace function ${fn}`));
      for (const key of ["'mapsUrl', e.maps_url", "'documentId', e.document_id", "'documentId', x.document_id", "'documents'", "'ideas'", "'eventPlaces'", "r.idea_plan", "r.idea_places"]) {
        expect(body).toContain(key);
      }
    }
  });

  it("keeps the functions locked down", () => {
    for (const fn of ["private.migrate_room_extras(text)", "private.migrate_room(text)", "private.verify_room(text)"]) {
      expect(m019).toContain(`revoke all on function ${fn} from public, anon, authenticated;`);
    }
    expect(m019.match(/set search_path = ''/g)!.length).toBe(5);
  });
});

describe("020_item_icons mirrors LIMITS.icon", () => {
  const icons = readFileSync(join(process.cwd(), "supabase/migrations/020_item_icons.sql"), "utf8");

  it.each(["trip_events", "trip_tasks"])("%s.icon is nullable text with a code point length check", (table) => {
    expect(icons).toContain(`alter table public.${table} add column if not exists icon text;`);
    const match = new RegExp(String.raw`add constraint ${table}_icon_length\s+check \(icon is null or char_length\(icon\) between 1 and (\d+)\)`).exec(icons);
    expect(Number(match?.[1])).toBe(LIMITS.icon);
  });

  it("get_trip returns the icon of events and tasks", () => {
    expect(icons).toContain("'icon', e.icon");
    expect(icons).toContain("'icon', t.icon");
  });
});
