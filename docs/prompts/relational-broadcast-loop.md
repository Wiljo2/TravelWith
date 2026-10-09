# TravelWith: relational data + Realtime Broadcast (loop prompt)

> Usage (Claude Code, repo root, on branch `feature/relational-broadcast`):
> `/loop Follow docs/prompts/relational-broadcast-loop.md and run the next iteration`
> Each run completes ONE step from section 4, commits it, updates the progress file, and stops. The loop ends per section 7.

---

## 0. Goal

Implement `docs/plans/relational-broadcast.md`: move trip data from `rooms.payload` (one JSONB per trip) to one table per item type, replace full-payload saves with small commands, and replace `postgres_changes` with a private Realtime Broadcast channel per trip. The migration is a **direct cut-over** in one maintenance window; `rooms.payload` is never modified and stays as a backup.

The plan is the source of truth for design decisions. If a step reveals the plan is wrong or incomplete, update the plan in the same commit and say why in the progress log.

## 1. Ground rules

- **Read first, every iteration:** `CLAUDE.md`, `GUIDELINES.md`, `docs/plans/relational-broadcast.md`, and the progress file (section 2).
- **Branch:** work only on `feature/relational-broadcast`. If the current branch is different, stop and say so. Never push, never open PRs, never merge.
- **Nothing is deployed from this branch until the cut-over.** Code may switch fully to the new model (no dual paths, no feature flags for reads/writes), except the maintenance flag in step 3.11.
- **No remote writes.** Never apply migrations, run SQL, or call Supabase/Vercel/Anthropic APIs that change state. Migrations are written as files only. Steps that need a real database are marked `HUMAN` and are prepared, not executed.
- **Never print secrets** from `.env.local` or anywhere else.
- **Repo rules still apply:** SQL migrations are new files only (next number after the highest in `supabase/migrations/`); English code and docs, Spanish UI copy; `@/` imports; no file over ~400 lines; server writes go through the domain layer; the agent system prompt stays byte-stable (change it only in a step that says so, as static text); new persisted fields optional with read-time defaults.
- **Supabase specifics (verified 2026-09-29):**
  - The `realtime` schema is locked: never create functions or tables in it; only policies on `realtime.messages` are allowed. Put trigger functions in schema `private`, with `set search_path = ''` and execute revoked from `public, anon, authenticated`.
  - Broadcast from the database: `realtime.broadcast_changes(topic, event, operation, table, schema, new, old)` in an `after insert or update or delete ... for each row` trigger. Topic is `'trip:' || room_code`.
  - Private channels: client uses `supabase.channel('trip:' + code, { config: { private: true } })` after `supabase.realtime.setAuth()`; receiving is authorized by a `select` policy on `realtime.messages` using `(select realtime.topic())` and `realtime.messages.extension = 'broadcast'`.
  - RLS policies: `to authenticated`, `(select auth.uid())`, UPDATE policies need both `using` and `with check`; never `security definer` to dodge a permission error.
  - If a detail is uncertain, fetch the current docs (append `.md` to a supabase.com/docs URL) before writing it.
- **Checks before every commit:** `npx tsc --noEmit`, `npm test`, `npm run lint` (0 errors), and `npx next build` for steps that touch app code. New SQL must parse: use `libpg-query` from a scratch directory (never add it to `package.json`) to parse every new migration, including PL/pgSQL bodies.
- **Tests:** every step that adds server or client logic adds tests (Vitest, `src/test/supabaseMock.ts` + `src/test/routeHelpers.ts` for routes and repositories).
- **Commit** once per step, message `<type>(<area>): <summary>` and the attribution trailer from the session instructions. Do not commit `audit/` or unrelated files.
- **If blocked:** do not force it. Record the blocker in the progress file (what is needed, from whom), then continue with the next step only if it does not depend on the blocked one; otherwise stop the loop.

## 2. Progress file

State lives in `docs/plans/relational-broadcast-progress.md` (create it on the first iteration from the step list in section 4, all unchecked). It is committed with each step.

```
# Relational + Broadcast progress
- Iteration: N
- Last commit: <sha>
- Next step: <id>
- Human actions pending: <list or "none">

## Steps
- [ ] 0.1 ...
...

## Log
| Iter | Date | Step | Commit | Result | Notes / blockers |
```

Mark a step `[x]` only when its commit exists and checks passed. Mark `[H]` for steps prepared for a human and waiting; mark `[B]` for blocked, with the reason in the log.

## 3. Iteration procedure

1. Read the files in rule 1 and confirm the branch.
2. Pick the first step that is `[ ]` and whose dependencies are `[x]` (or `[H]` when the step says it can proceed without the human result).
3. Implement it fully, with tests.
4. Run the checks; fix until green. If still red after reasonable effort, revert the step's changes, mark it `[B]` with the error, and stop.
5. Commit, update the progress file (iteration, commit, next step, log line), amend nothing; the progress update goes in the same commit.
6. End the run with the message in section 8. Do not start the next step.

## 4. Steps

Dependencies in brackets. `HUMAN` = prepared by the loop, executed by a person.

### Phase 0: spike
- **0.1** Spike kit [none]: `docs/plans/spike/` with SQL for one table (`spike_events` with `room_code`), its broadcast trigger and `realtime.messages` policy, plus a dev-only script or page that subscribes to `trip:<code>` and logs payloads. README with exact steps. `HUMAN`: run it on a staging project and record in the progress file the exact client payload shape of `broadcast_changes` (field names for new row, old row, operation, table), and whether a token refresh keeps the subscription. Steps 1.x may proceed; step 3.10 waits for this result.

### Phase 1: schema (migration files only)
- **1.1** [0.1] Migration: `rooms` header columns (`destination`, `start_date`, `end_date`, `exchange_rate`, all nullable) and all trip tables from the plan's data model with composite PKs `(room_code, id)`, `version`, `updated_at`, `updated_by`, FKs (including `on delete set null (col)` where the plan says so), check constraints mirroring `src/constants/limits.ts`, and indexes for every FK.
- **1.2** [1.1] Migration: RLS enabled on every new table; restrictive member-only policies for `anon, authenticated`; grants reviewed per the plan (API uses the service role).
- **1.3** [1.1] Migration: schema `private`; `private.record_trip_change()` audit trigger into `trip_changes`; `private.broadcast_trip_change()`; triggers on every trip table; `select` policy on `realtime.messages` for members. Retention job for `trip_changes` documented, not scheduled.
- **1.4** [1.3] `src/types/database.ts` written by hand to match 1.1–1.3 exactly, with a header comment to regenerate via `supabase gen types typescript` once a project is available; row types for each table.

### Phase 2: migration functions (migration files only)
- **2.1** [1.1] Migration: `private.migrate_room(code)` (idempotent: deletes the trip's rows, then inserts from `rooms.payload` in one transaction; header columns from `payload.trip` / `exchangeRate`; legacy nulls and missing optional fields handled; dangling references to missing events/days become `null`); `private.migrate_all_rooms()` returning a per-room report.
- **2.2** [2.1] Migration: `private.verify_room(code)` (counts and totals per area: days, events per day, spans, expenses and their USD sum at the stored rate, tasks, options, travelers; returns differences) and `private.rebuild_payload(code)` (tables → `RoomPayload`-shaped JSONB written to `rooms.payload`, for rollback).
- **2.3** [2.2] `HUMAN` runbook `docs/plans/migration-rehearsal.md`: copy production to staging, run `scripts/check-payloads.ts`, apply migrations, run `migrate_all_rooms` + `verify_room`, record results in the progress file. Later steps proceed; step 4.1 requires this done with 0 differences.

### Phase 3: new code
- **3.1** [1.4] Repository layer `src/server/repo/*` (one module per table): typed reads/writes with per-row version guards (`... and version = $expected ... returning *`, 0 rows → conflict error with the current row).
- **3.2** [1.4] Migration + code: SQL function `get_trip(code)` returning the trip in `RoomPayload` shape in one round trip; `GET /api/rooms/[code]` uses it (still `requireMember`); response adds per-item `version`.
- **3.3** [3.1] Op registry `src/server/ops/*` and `POST /api/rooms/[code]/ops` (`{ op, args, expectedVersion? }`, `requireMember`, domain validation, repository execution, 409 with current row on conflict). First ops: `event.create/update/move/delete`. Domain functions rewritten to operate on rows.
- **3.4** [3.3] Ops: `day.swap` (SQL function), `day.update`, `itinerary.reset` (owner; SQL function), `daySpan.*`, `tripSpan.*`.
- **3.5** [3.3] Ops: `expense.*`, `trip.setExchangeRate`.
- **3.6** [3.3] Ops: `task.*`, `taskOption.*`, `task.chooseOption` (SQL function: insert event + expense, delete task, atomically).
- **3.7** [3.3] Ops: `traveler.add/remove`, `trip.update`.
- **3.8** [3.4–3.7] Agent tools call the op registry (same validation, same quota/owner rules); tool descriptions updated as static text; `mutateRoom` no longer used by the agent.
- **3.9** [3.4–3.7] Client: hooks send ops with optimistic updates and reconcile with responses; autosave of the full payload removed; 409 shows a Spanish notice and adopts the returned row.
- **3.10** [3.9, 0.1 result] `useTripChannel`: private channel `trip:<code>`, `setAuth()` on subscribe and on session refresh, `applyRowChange` per table/operation (ignores rows whose version is already known), refetch via `GET` on every `SUBSCRIBED` and on `visibilitychange`; the `postgres_changes` subscription is removed.
- **3.11** [3.3] Maintenance mode: `MAINTENANCE_MODE=on` makes ops and agent routes answer 503 with a Spanish message; the client shows a banner and retries after it.
- **3.12** [3.8–3.11] Remove `PATCH /api/rooms/[code]`, `persistRoom`, `mutateRoom`, full-payload validation for writes (keep `validateRoomPayload`/`payloadIssues` for reading the backup); update `GUIDELINES.md` (data model, write path, realtime, golden rule for tables) and `CLAUDE.md` architecture bullets.

### Phase 4: cut-over (human)
- **4.1** [2.3 done, 3.12] `HUMAN` runbook `docs/plans/cutover-runbook.md` with exact commands and checks for each step of the plan's maintenance window, abort criteria, rollback with `rebuild_payload`, and a post-cut-over smoke test (two accounts, conflict test, non-member test). The loop writes it and marks it `[H]`. The person marks it `[x]` in the progress file after running it.

### Phase 5–6 (only after 4.1 is `[x]`)
- **5.1** [4.1] Cleanup: remove maintenance flag code if no longer needed, dead code from the JSON model, docs pass. `rooms.payload` column stays.
- **6.1** [5.1] Activity panel from `trip_changes` (Spanish UI), read route with `requireMember`.
- **6.2** [6.1] Per-change undo (inverse op through the op registry) and owner restore of a deleted item.

## 5. Quality bar per step

- Matches the plan; deviations are written into the plan in the same commit.
- Old trips keep working at every step on this branch as far as the step can influence it (legacy categories, missing optional fields).
- No new `security definer` function in `public`; every new table has RLS; every route has `requireMember` or `requireUser`.
- Errors to clients go through `errorResponse`; no database messages leak.

## 6. Stop conditions for a single run

Stop after committing one step, or earlier if: the branch is wrong, the working tree has unexpected changes you did not make, checks cannot be made green, or the next step depends only on `HUMAN`/blocked steps.

## 7. Loop exit

End the loop (and say so) when every step through 3.12 is `[x]` and 4.1 is `[H]` (waiting for the cut-over), or when no step can proceed without a human. Steps 5.1–6.2 resume in a later loop after the cut-over is marked done.

## 8. Per-iteration final message

At most 6 lines, in Spanish: iteration number and step done (with commit sha), what changed in one line, checks run and results, anything a human must do (`HUMAN` steps or blockers), next step.
