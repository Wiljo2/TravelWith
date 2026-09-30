# Plan: relational trip data + Realtime Broadcast

Status: proposal · Base: `remediation/phase-6` (security fixes) · Date: 2026-09-29

## Why

Today a whole trip is one JSONB value (`rooms.payload`). Every autosave uploads the full trip, every member receives the full trip over Realtime, any two edits to the same trip conflict (one gets a 409 and loses its change), there is no history, and nothing can be permissioned per item. Realtime uses `postgres_changes`, which re-checks RLS for every subscriber on every change and which Supabase does not recommend at scale.

Goal: store each kind of item in its own table, write one change at a time through the server domain layer, and fan changes out on **one private Broadcast channel per trip**.

Non-goals: offline editing/CRDTs, per-item permissions (enabled by this work, built later), changing the UI.

## Target architecture

```
browser ── POST /api/rooms/[code]/ops {op, args, expectedVersion} ──► requireMember
                                                                       │
                                                             domain op (validate)
                                                                       │
                                               repository → one SQL statement or SQL function
                                                                       │
                                     trip tables (row-level version, updated_by) ── audit trigger ─► trip_changes
                                                                       │
                                            broadcast trigger → realtime.broadcast_changes('trip:<code>')
                                                                       │
browser ◄── private channel trip:<code> (RLS on realtime.messages: members only) ◄──┘
```

- **Reads:** `GET /api/rooms/[code]` returns the trip assembled from rows, in the same `RoomPayload` shape the client uses today, so components don't change.
  Implemented in step 3.2: `public.get_trip(code)` (`014_get_trip.sql`, service role only) returns `{code, payload, members, updated_at}`; every item in `payload` carries `version` (optional `version?: number` on the item types). `trip` comes from the `rooms` header columns and is omitted when the dates are missing; `exchangeRate` is omitted when null and `getTrip` (`src/server/repo/trip.ts`) applies `DEFAULT_RATE`. The frozen `rooms.payload` is never read.
- **Writes:** small commands (`event.move`, `expense.update`, …) instead of full-payload `PATCH`. The agent tools call the same commands.
- **Realtime:** one subscription per open trip; every table's trigger publishes to `trip:<code>`; the client applies the changed row by id.

## Data model

Decisions:
- Keep `rooms` as the trip header (PK `code`) and `user_rooms` as membership. No renames (golden rule).
- Every child table carries `room_code` and uses composite PK `(room_code, id)`. Existing ids are strings that are only unique within a trip (`d0`, `d1`…), so they migrate unchanged; `room_code` also makes RLS and the Broadcast topic a direct column read.
- Every row gets `version int not null default 1`, `updated_at timestamptz`, `updated_by uuid` for per-row optimistic concurrency and attribution.
- Hours stay decimal (`numeric(5,2)`), money `numeric(14,2)`.
- Order within a list uses `position int`.

| Table | Columns (besides `room_code`, `id`, `version`, `updated_at`, `updated_by`) | Keys and references | Comes from |
|---|---|---|---|
| `rooms` (existing) | + `destination text`, `start_date date`, `end_date date`, `exchange_rate numeric` (nullable, additive) | PK `code` | `payload.trip`, `payload.exchangeRate` |
| `trip_days` | `position`, `label`, `sub`, `flexible` | FK `room_code → rooms on delete cascade` | `payload.days[]` |
| `trip_events` | `day_id`, `start_hour`, `end_hour`, `title`, `cat`, `note` | FK `(room_code, day_id) → trip_days on delete cascade` | `days[].events[]` |
| `trip_day_spans` | `day_id`, `label`, `start_event_id`, `end_event_id`, `start_hour`, `end_hour`, `bg`, `border`, `z_index` | FK day (cascade); event FKs `on delete set null (col)` | `days[].spans[]` |
| `trip_spans` | `label`, `start_event_id`, `end_event_id`, `bg`, `border`, `z_index` | event FKs `on delete cascade` | `payload.tripSpans[]` |
| `trip_expenses` | `position`, `label`, `amount`, `currency`, `split_mode`, `linked_event_id`, `start_day_id`, `end_day_id` | event FK `on delete set null (linked_event_id)`; day FKs `on delete set null (…)` | `payload.extras[]` |
| `trip_tasks` | `position`, `title`, `done`, `note`, `day_id`, `start_hour`, `end_hour`, `cat`, `priority` | day FK `on delete set null (day_id)` (hours are ignored while `day_id` is null) | `payload.tasks[]` |
| `trip_task_options` | `task_id`, `position`, `label`, `note`, `amount`, `currency`, `split_mode` | FK task `on delete cascade` | `tasks[].options[]` |
| `trip_travelers` | `name` | | `payload.mockPeople[]` |
| `trip_changes` | `table_name`, `row_id`, `op`, `before jsonb`, `after jsonb`, `user_id`, `created_at` (bigint identity PK) | append-only, server-written | audit trigger |

Implementation notes (step 1.1, `008_trip_tables.sql`):
- Every list table (days, events, day spans, trip spans, expenses, tasks, options, travelers) has `position`, so `get_trip` and `rebuild_payload` return arrays in their original order.
- `on delete set null (cols)` may only name columns of that foreign key, so the task day FK nulls `day_id` only, not the hours.
- Columns are nullable wherever `src/lib/schemas.ts` accepts `null`/missing today, and hour checks use the schema's `0–48` range, so every legacy payload that passes validation can be migrated. The stricter `6 <= start < end <= 26` stays in the domain layer for new writes. `end_hour > start_hour` is enforced on events only (tasks and day spans may carry partial hours).
- Every table also references `rooms (code) on delete cascade` directly, and `updated_by` references `auth.users on delete set null`; each foreign key has an index.

Foreign keys replace today's dangling-id handling (deleting an event unlinks its expenses in the database, not in two copies of the logic). Check constraints mirror `src/lib/schemas.ts` limits (text lengths, `currency in ('USD','COP')`, hour range, `end_hour > start_hour`).

`rooms.payload` is never dropped: it is frozen as a backup after the cut-over.

## Access control

- **Table RLS** (defense in depth; the API uses the service role): restrictive `for all to authenticated` policy on every trip table, `using/with check (exists (select 1 from user_rooms ur where ur.room_code = <table>.room_code and ur.user_id = (select auth.uid())))`. No `anon` access. Index `user_rooms (room_code, user_id)` if the PK order `(user_id, room_code)` isn't enough.
- Implemented in `009_trip_tables_rls.sql`: the restrictive policy applies to `anon, authenticated`; there is no permissive policy, so clients read nothing directly (add a permissive `select` later if direct reads are ever needed). `anon` has no grants; `authenticated` keeps only `select`. `trip_changes` has RLS, no policies and no client grants.
- **Routes:** unchanged pattern, `requireMember` on every endpoint; the ops endpoint also enforces role (future viewer role can't write).
- **Realtime:** private channels only, authorized by a `select` policy on `realtime.messages` (see below). "Allow public access" in Realtime Settings is turned off at the cut-over (this also stops the legacy public `room-<code>` channel, so not earlier).

## Write path

`POST /api/rooms/[code]/ops` with `{ op, args, expectedVersion? }`:

1. `requireMember(req, code)`.
2. Validate `args` with the existing domain checks (`checkArgs`, `DomainError`).
3. Execute through a repository (`src/server/repo/*`, typed with generated Supabase types):
   - Single-row ops are one statement with a version guard: `update trip_events set …, version = version + 1 where room_code = $1 and id = $2 and version = $3 returning *`. Zero rows → 409 with the current row.
   - Multi-row ops run as SQL functions (same pattern as `join_room`), so they are atomic: `choose_task_option` (insert event + insert expense + delete task), `swap_days`, `reset_itinerary`, `reorder`.
4. Return the new row(s) and versions. The client applies them optimistically and reconciles with the response.

Implemented in step 3.1 (`src/server/repo/*`, `013_trip_row_writes.sql`):
- `tableRepo(table)` gives each table `list/get/insert/update/remove/nextPosition`; per-table modules (`eventsRepo`, `expensesRepo`, …) bind it. Updates set `version = expected + 1` guarded by `version = expected`; without an expected version the repo reads the current one and retries once. 0 rows → `RowConflictError` (409, carries the current row) or `RowNotFoundError` (404). Constraint errors map to 400/409 with Spanish messages; anything else stays a generic 500.
- Deletes go through `public.delete_trip_row(table, code, id, expected_version, user)` (service role only, table whitelist), which sets `app.user_id` for the audit trigger and returns the deleted row, or the current row on a version mismatch. Deleting a row that is already gone succeeds with `null`.
- A `before update` trigger (`private.bump_trip_row_version`) bumps `version` and `updated_at` on every effective update the writer didn't bump itself. Without it, foreign-key `on delete set null` cascades (delete an event → its expenses are unlinked) changed rows without changing their version, and clients that ignore known versions would have missed them.

Ops (first set, mapping today's hooks and agent tools):

| Area | Ops |
|---|---|
| Events | `event.create`, `event.update`, `event.move`, `event.delete` |
| Days | `day.swap`, `day.update`, `itinerary.reset` (owner) |
| Spans | `daySpan.create/update/delete`, `tripSpan.create/update/delete` |
| Expenses | `expense.create/update/delete`, `trip.setExchangeRate` |
| Tasks | `task.create/update/toggle/delete`, `task.chooseOption`, `taskOption.create/update/delete` |
| Travelers | `traveler.add/remove` |
| Trip | `trip.update` (name, destination, dates) |

Conflicts become per row: two members editing different items never conflict. Same item: the second write gets a 409 with the current row, the client shows it and a notice.

## Realtime (Broadcast from the database)

Trigger function in a non-exposed schema (the `realtime` schema is locked for new objects since 2026-07; only policies on `realtime.messages` are allowed):

```sql
create schema if not exists private;

create or replace function private.broadcast_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'trip:' || coalesce(new.room_code, old.room_code),
    tg_op,              -- event name: INSERT / UPDATE / DELETE
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function private.broadcast_trip_change() from public, anon, authenticated;

create trigger trip_events_broadcast
  after insert or update or delete on public.trip_events
  for each row execute function private.broadcast_trip_change();
-- same trigger on every trip table
```

Who may receive:

```sql
create policy "members receive trip broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.user_rooms ur
      where ur.user_id = (select auth.uid())
        and 'trip:' || ur.room_code = (select realtime.topic())
    )
  );
```

No `insert` policy: clients never send on the channel; only database triggers do.

Client (`useTripChannel`, replacing the `postgres_changes` block in `useRoom`):

```ts
await supabase.realtime.setAuth();
supabase
  .channel(`trip:${code}`, { config: { private: true } })
  .on("broadcast", { event: "*" }, ({ payload }) => applyRowChange(payload))
  .subscribe((status) => { if (status === "SUBSCRIBED") refetchTrip(); });
```

- `applyRowChange` switches on table and operation and updates one item by id; it ignores rows whose `version` it already has (own echo).
- Broadcast is not a durable log: after any (re)subscribe the client refetches the trip once, so missed messages are recovered.
- Call `setAuth()` again when the Supabase session refreshes (`onAuthStateChange`), since policies are re-evaluated on new JWTs.
- Message size is one row (hundreds of bytes) instead of the whole trip.

## History

A generic `private.record_trip_change()` trigger on every trip table writes `before`/`after` JSON and `updated_by` into `trip_changes`. This enables an activity panel, per-change undo (apply the inverse op), and restore after mistakes. Retention: keep 90 days or last 5,000 changes per trip (scheduled cleanup).

Implemented in `010_trip_triggers.sql`:
- Acting user = `current_setting('app.user_id')` if set, else the row's `updated_by` (insert/update), else `auth.uid()`. Deletes carry no `updated_by`, so delete ops must run in a SQL function (or transaction) that does `set_config('app.user_id', <uid>, true)` first; the repository layer (step 3.1) owns this.
- No-op updates (`new is not distinct from old`) are neither audited nor broadcast.
- Rows deleted by the cascade from a deleted room are not audited (the room and its history go together; inserting would also violate the `trip_changes → rooms` FK).
- Retention: `private.prune_trip_changes()` exists but is not scheduled; the `cron.schedule` call is in the migration comment.

## Migration: direct cut-over from JSON to tables

The data moves from `rooms.payload` to the tables **once**, in a single maintenance window. There is no period where the app writes to both: the new code is built and tested against the tables on staging, then production switches in one step. `rooms.payload` is not modified by the migration, so it remains an untouched backup.

| # | Phase | Main work | Exit criteria | Effort |
|---|---|---|---|---|
| 0 | Spike | Staging project: `trip_events` + broadcast trigger + `realtime.messages` policy + private channel in a throwaway page | Two accounts see each other's changes; a non-member receives nothing; confirm the exact client payload shape of `broadcast_changes` and behavior on token refresh | S |
| 1 | Schema | Migration: `rooms` header columns, trip tables, FKs, checks, indexes, RLS, audit + broadcast triggers; `supabase gen types typescript` into `src/types/database.ts` | Advisors clean; RLS tests: non-member sees 0 rows via anon/authenticated keys | M |
| 2 | Migration function | SQL function `private.migrate_room(code)` that reads `rooms.payload` and inserts all rows for that trip in one transaction (`jsonb_to_recordset`, idempotent: deletes the trip's rows first); `private.migrate_all_rooms()`; `private.verify_room(code)` comparing counts and totals (events per day, expense sum, tasks) between payload and rows | Run on a copy of production in staging: every room migrates, `verify_room` reports 0 differences, legacy payloads (missing optional fields, nulls, legacy categories) load | M |
| 3 | New code (on staging only) | Ops endpoint, op registry, repository, domain on rows, agent tools on ops, `get_trip(code)` SQL function for reads, hooks applying row changes, `useTripChannel`; full-payload `PATCH`, `mutateRoom`, `persistRoom` and the `postgres_changes` subscription removed | All tests green; two-account manual test per area; conflict test (same item → 409 + notice; different items → both saved) | L |
| 4 | Cut-over (maintenance window) | 1) set `MAINTENANCE_MODE=on` (saves and agent answer 503, UI shows a banner) and wait for in-flight saves; 2) run `private.migrate_all_rooms()`; 3) run `verify_room` for every room, abort on any difference; 4) deploy the new code; 5) disable "Allow public access" in Realtime Settings; 6) smoke test, turn maintenance off | Every room verified; smoke test passes (open, edit, second account sees it, agent works) | S |
| 5 | Cleanup | Remove maintenance flag code, legacy payload validation for writes (keep it for reading the backup), docs update; `rooms.payload` stays (frozen backup, never dropped) | No code path reads or writes `rooms.payload` except rollback tools | S |
| 6 | History UI | "Actividad" panel from `trip_changes`, per-change undo, owner restore | Undo works for create/update/delete of each item type | M |

Rough total: 4–6 weeks for one developer. The maintenance window itself is minutes (trips are small; migration runs in the database).

Implemented in `011_migrate_rooms.sql` (step 2.1):
- `migrate_room` sets `app.bulk_load = 'on'` for its transaction; the audit and Broadcast trigger functions (replaced in 011 with this guard) skip those writes, so the migration adds nothing to `trip_changes` and sends no messages.
- Each row is inserted in its own subtransaction. A row that cannot be stored (failed check such as `end <= start`, duplicate id within the trip, missing required value, trip span with a missing event) is skipped and listed under `skipped` with the database error; optional references to missing days/events are set to null and listed under `nulled`. Wrong JSON types become null (`private.json_num/json_text/json_bool/json_date`). An `endDate` before `startDate` keeps only the start date.
- `migrate_all_rooms()` runs each room in its own subtransaction and returns `(room_code, ok, report)`; `ok` is false when anything was skipped or the room failed.

Implemented in `012_verify_rebuild.sql` (step 2.2):
- `private.trip_payload(code)` assembles the tables into the `RoomPayload` shape without writing (step 3.2's `get_trip` can build on it). Optional fields that are null are omitted, `day.spans` and `task.options` only appear when non-empty, unknown top-level payload keys are kept, `trip.name` comes from `rooms.name`.
- `private.verify_room(code)` returns a list of differences (counts per area, events per day, expense total in USD with amounts rounded to cents); `private.verify_all_rooms()` runs it for every room. A payload that fully migrates round-trips exactly through `trip_payload`.
- `private.rebuild_payload(code)` writes `trip_payload` into `rooms.payload` (and `rooms.name`), which bumps `updated_at` for the old clients.

**Rollback.** Before phase 5 cleanup, `private.rebuild_payload(code)` writes the tables back into `rooms.payload`. If the new version has to be rolled back after users made changes: turn maintenance on, run `rebuild_payload` for rooms with `trip_changes` after the cut-over, redeploy the previous version. With no changes after the cut-over, redeploying the previous version is enough because `payload` was never modified.

Relation to the existing remediation plan: phase 3 here replaces the old Phase 14 (command-style writes); phases 5–6 replace the old snapshot-based Phases 7 and 16.

## Code that changes

| Area | Files |
|---|---|
| New | `src/server/repo/*` (one module per table), `src/app/api/rooms/[code]/ops/route.ts`, `src/server/ops/*` (op registry → domain → repo), `src/hooks/useTripChannel.ts`, `src/types/database.ts` (generated), migrations `008_*` onward (tables, RLS, triggers, `migrate_room`, `verify_room`, `rebuild_payload`, `get_trip`) |
| Changed | `src/hooks/useRoom.ts` (load + channel), `useItinerary` / `useBudget` / `App.tsx` task, span and traveler helpers (send ops, apply row changes), `src/server/agent/tools.ts` (call ops), `src/server/domain/*` (operate on rows instead of the whole payload), `GUIDELINES.md` (data model, write path, realtime) |
| Removed in phase 3 | full-payload `PATCH`, `persistRoom`, `mutateRoom`, the `postgres_changes` subscription; `validateRoomPayload`/`payloadIssues` kept only to check the backup before migrating |

## Testing

- Unit: each op (domain + repository with the Supabase mock), version conflicts, FK side effects (delete event → expense unlinked).
- Database: RLS tests per table with anon, non-member and member JWTs; policy test on `realtime.messages`.
- Integration (staging): two browsers, same trip: edit different items concurrently (both saved), same item (409 + notice), disconnect/reconnect (refetch recovers), non-member subscription (receives nothing).
- Load: 20 members, 5 edits/second on one trip; measure Broadcast latency and database CPU.

## Risks

| Risk | Mitigation |
|---|---|
| A legacy payload doesn't map cleanly (missing fields, nulls, legacy categories, dangling ids) | Run `scripts/check-payloads.ts` first; rehearse `migrate_all_rooms` + `verify_room` on a production copy in staging; dangling references become `null` and are listed in the verification report |
| Differences found during the cut-over | `verify_room` gates the deploy: any difference aborts before the new code goes live; `payload` is untouched, so aborting only means turning maintenance off |
| Bug found after the cut-over | `rebuild_payload` + redeploy the previous version (see Rollback) |
| Users open during the maintenance window | Banner + 503 on saves; the window is minutes; the client retries saves after it |
| Missed Broadcast messages (not durable) | Refetch on every `SUBSCRIBED`, on `visibilitychange`, and on version gaps |
| `broadcast_changes` payload shape or limits differ from docs | Phase 0 spike confirms before any schema work |
| Disabling "Allow public access" breaks clients still on the old version | Do it in the same window, right after deploying the new code (phase 4, step 5); old tabs get a reload prompt |
| More queries per load (joins across 8 tables) | One SQL function `get_trip(code)` returns the assembled JSON in a single round trip |
| Multi-row ops partially applied | Implement as SQL functions (transactions) |

## Open questions

1. Should the owner be able to lock trip dates (days) against member edits once the viewer/editor roles exist?
2. Retention for `trip_changes`: is 90 days enough?
3. Keep numeric string ids or move new rows to UUIDs (old ids keep working either way)?
