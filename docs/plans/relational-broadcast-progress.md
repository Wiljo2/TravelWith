# Relational + Broadcast progress
- Iteration: 1
- Last commit: (iteration 1 commit; the next iteration records its sha in the log)
- Next step: 1.1
- Human actions pending: 0.1 run the spike on staging (`docs/plans/spike/README.md`) and record the `broadcast_changes` payload shape and token-refresh behavior here; 3.10 waits for it.

## Steps
- [H] 0.1 Spike kit (HUMAN: run on staging, record payload shape and token refresh)
- [ ] 1.1 Migration: `rooms` header columns and trip tables
- [ ] 1.2 Migration: RLS and grants on trip tables
- [ ] 1.3 Migration: `private` schema, audit + broadcast triggers, `realtime.messages` policy
- [ ] 1.4 `src/types/database.ts` by hand
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
| 1 | 2026-09-29 | 0.1 | (this commit) | Prepared `[H]` | `docs/plans/spike/`: `spike.sql` (`spike_events`, RLS, `private.spike_broadcast_change()`, `realtime.messages` select policy), `writes.sql`, `listen.ts`, `teardown.sql`, README. Spike-specific names avoid clashing with 1.3. SQL parsed with libpg-query (incl. PL/pgSQL body); tsc, lint (0 errors), 87 tests green. No unit tests: throwaway staging tooling, no app logic. HUMAN: run on staging and paste results here. |
