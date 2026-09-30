# Relational + Broadcast progress
- Iteration: 5
- Last commit: (iteration 5 commit; the next iteration records its sha in the log)
- Next step: 2.1
- Human actions pending: 0.1 run the spike on staging (`docs/plans/spike/README.md`) and record the `broadcast_changes` payload shape and token-refresh behavior here; 3.10 waits for it.

## Steps
- [H] 0.1 Spike kit (HUMAN: run on staging, record payload shape and token refresh)
- [x] 1.1 Migration: `rooms` header columns and trip tables
- [x] 1.2 Migration: RLS and grants on trip tables
- [x] 1.3 Migration: `private` schema, audit + broadcast triggers, `realtime.messages` policy
- [x] 1.4 `src/types/database.ts` by hand
- [ ] 2.1 Migration: `private.migrate_room` / `private.migrate_all_rooms`
- [ ] 2.2 Migration: `private.verify_room` / `private.rebuild_payload`
- [ ] 2.3 HUMAN runbook `docs/plans/migration-rehearsal.md`
- [ ] 3.1 Repository layer `src/server/repo/*`
- [ ] 3.2 `get_trip(code)` + `GET /api/rooms/[code]` on it
- [ ] 3.3 Op registry + `POST /api/rooms/[code]/ops` + event ops
- [ ] 3.4 Day, itinerary and span ops
- [ ] 3.5 Expense ops + `trip.setExchangeRate`
- [ ] 3.6 Task and task option ops + `task.chooseOption`
- [ ] 3.7 Traveler ops + `trip.update`
- [ ] 3.8 Agent tools on the op registry
- [ ] 3.9 Client hooks send ops; full-payload autosave removed
- [ ] 3.10 `useTripChannel` (private Broadcast channel)
- [ ] 3.11 Maintenance mode
- [ ] 3.12 Remove full-payload write path; update `GUIDELINES.md` and `CLAUDE.md`
- [ ] 4.1 HUMAN cut-over runbook
- [ ] 5.1 Cleanup after cut-over
- [ ] 6.1 Activity panel from `trip_changes`
- [ ] 6.2 Per-change undo and owner restore

## Log
| Iter | Date | Step | Commit | Result | Notes / blockers |
|---|---|---|---|---|---|
| 1 | 2026-09-29 | 0.1 | a0c486e | Prepared `[H]` | `docs/plans/spike/`: `spike.sql` (`spike_events`, RLS, `private.spike_broadcast_change()`, `realtime.messages` select policy), `writes.sql`, `listen.ts`, `teardown.sql`, README. Spike-specific names avoid clashing with 1.3. SQL parsed with libpg-query (incl. PL/pgSQL body); tsc, lint (0 errors), 87 tests green. No unit tests: throwaway staging tooling, no app logic. HUMAN: run on staging and paste results here. |
| 2 | 2026-09-29 | 1.1 | bff48f5 | Done | `008_trip_tables.sql`: `rooms` header columns + checks; `trip_days/events/day_spans/spans/expenses/tasks/task_options/travelers/changes` with `(room_code, id)` PKs, version/updated_at/updated_by, FKs (`set null (col)` where planned), checks from `schemas.ts`/`LIMITS`, FK indexes. Plan updated: `position` on every list table; task day FK nulls `day_id` only (Postgres only allows FK columns in the set-null list); legacy-tolerant nullability and 0–48 hour checks. New test `src/lib/tripTablesLimits.test.ts` keeps SQL length checks in sync with `LIMITS`. libpg-query parse OK; tsc, lint (0 errors), 104 tests green. Vitest reports every file failing when the shell cwd is spelled `c:\` (lowercase); rerun from `C:\` passes. |
| 3 | 2026-09-29 | 1.2 | e3a5555 | Done | `009_trip_tables_rls.sql`: RLS on all 9 tables; restrictive member-only policy (`anon, authenticated`, `(select auth.uid())`) on the 8 trip tables, no permissive policy; all grants revoked from `anon`, writes revoked from `authenticated`; `trip_changes` server-only. Plan access-control section updated. Test renamed to `src/lib/tripTablesMigrations.test.ts` and extended (every 008 table locked down, no permissive policy). libpg-query parse OK; tsc, lint (0 errors), 115 tests green. |
| 4 | 2026-09-29 | 1.3 | 0093b5d | Done | `010_trip_triggers.sql`: schema `private` (no client access); `private.record_trip_change()` (audit into `trip_changes`, attribution via `app.user_id` → `updated_by` → `auth.uid()`, skips no-op updates and room-cascade deletes) and `private.broadcast_trip_change()` (`realtime.broadcast_changes` on `trip:<code>`), both security definer with empty search_path and execute revoked; audit + broadcast triggers on the 8 trip tables; members-only `select` policy on `realtime.messages`, no insert policy; `private.prune_trip_changes()` documented, not scheduled. Plan History section updated (delete attribution needs `app.user_id`, owned by 3.1). Tests extended; libpg-query parse OK; tsc, lint (0 errors), 125 tests green. |
| 5 | 2026-09-29 | 1.4 | (this commit) | Done | `src/types/database.ts`: `Database` in supabase-js generic shape (public tables incl. existing `rooms`/`user_rooms`/`agent_usage`, FK relationships, `join_room`/`leave_room`/`delete_room`), `Tables`/`TablesInsert`/`TablesUpdate`, flat row aliases, `TripTable`; header says how to regenerate. `src/types/database.test.ts` checks every trip table's row keys against the 008 SQL columns (both directions via `satisfies`) and that `createClient<Database>` infers rows / rejects bad inserts. tsc, lint (0 errors), 135 tests green. No app code imports it yet, so no `next build`. |
