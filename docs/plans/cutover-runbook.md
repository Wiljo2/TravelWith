# Cut-over runbook (step 4.1)

> Historical: the production cut-over ran on 2026-10-09. `scripts/check-payloads.ts` was removed in step 5.1 (find it in git history, e.g. commit `52508d5`, if a payload check is needed again).

Moves production from `rooms.payload` (one JSONB per trip) to the `trip_*` tables, the ops endpoint and the private Broadcast channel `trip:<code>`, in one short maintenance window. Every step is **[H]**: a person runs it. The loop never touches production.

Design and rollback logic: `docs/plans/relational-broadcast.md` ("Migration: direct cut-over"). Rehearsal that this runbook repeats on production: `docs/plans/migration-rehearsal.md` (done with 0 differences on staging, 001–019).

`rooms.payload` is never modified by the migration, so it is the backup. Until phase 5 cleanup, `private.rebuild_payload(code)` writes the tables back to it.

## What changes in production

| Piece | Before | After |
|---|---|---|
| Schema | migrations 001–007 | + 008–019 (additive: new tables, functions, triggers, columns) |
| Writes | `PATCH /api/rooms/[code]` with the whole payload | `POST /api/rooms/[code]/ops` |
| Reads | `rooms.payload` | SQL `get_trip(code)` |
| Realtime | `postgres_changes` on `rooms` | private Broadcast `trip:<code>` |
| Client | old tabs | old tabs break on the first save and must reload |

Migrations 008–019 are additive and the old code ignores them, so they can be applied before the deploy without breaking the running app.

## Requirements (do not start without all of them)

- [ ] Browser pass of `docs/plans/staging-test/README.md` done on staging and its failures fixed (conflict fix `861905a` re-tested). Also test the non-member (403) and `MAINTENANCE_MODE=on` rows that are in the README.
- [ ] Branch `feature/relational-broadcast` reviewed and merged into the branch Vercel deploys to production, **but not yet deployed** (or a deployment of it built and ready to promote). Pushing and merging is done by you, not by the loop.
- [ ] You know how to roll back the Vercel deployment: write down the id/URL of the current production deployment (Vercel → Deployments) as `PREV_DEPLOY`.
- [ ] Production Supabase: Dashboard → Database → Backups shows a recent backup, or PITR is on.
- [ ] A time with nobody editing (the trips are small and few users). Tell the travelers beforehand: trips open empty and editing is paused for a few minutes.
- [ ] Shell with `PROD_DB_URL` exported (Dashboard → Connect → Session pooler). Never commit it. `psql` and `pg_dump` at the project's major version.

Abort criteria for the whole window: any step below fails or any `verify` difference appears. Abort = "Abort" section at the end. Nothing is irreversible before step 6.

## 1. Backup and checks (production, read-only)

```
mkdir -p /tmp/tw-cutover
pg_dump "$PROD_DB_URL" --data-only --table=public.rooms --table=public.user_rooms --no-owner --no-privileges -f /tmp/tw-cutover/rooms-and-members.sql
psql "$PROD_DB_URL" -c "select count(*) as rooms, sum(length(payload::text)) as bytes from public.rooms;"
psql "$PROD_DB_URL" -c "select version from supabase_migrations.schema_migrations order by 1;"   # optional: confirms 001–007 are the latest
npx tsx --env-file=.env.local scripts/check-payloads.ts > /tmp/tw-cutover/check-payloads.txt
```

- `.env.local` must point to production for the last command (read-only script). Keep the dump outside the repo; it has real trip data.
- Record the room count and the issues in `check-payloads.txt`. Rooms with issues may end as `skipped` in step 4; if any, fix their data through the app first (as was done with `d4-zarpe`) and recheck.
- If the count is different from the rehearsal (1 room, `NVHPCI`), rehearse again with the new rooms before continuing: `docs/plans/migration-rehearsal.md`.

## 2. Apply the schema (before maintenance, harmless to the old code)

In the Supabase SQL Editor of **production**, run the files in order, one at a time, stopping at the first error:

`008_trip_tables.sql`, `009_trip_tables_rls.sql`, `010_trip_triggers.sql`, `011_migrate_rooms.sql`, `012_verify_rebuild.sql`, `013_trip_row_writes.sql`, `014_get_trip.sql`, `015_day_ops.sql`, `016_room_broadcast.sql`, `017_task_ops.sql`, `018_main_features_tables.sql`, `019_main_features_migration.sql`

If the editor asks about RLS on a new table, choose "Run and enable RLS" (the files already enable it).

Checks:

```
psql "$PROD_DB_URL" -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'trip\_%';"
psql "$PROD_DB_URL" -c "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'trip\_%' and not rowsecurity;"
```

- First query: 12 tables (`trip_days`, `trip_events`, `trip_day_spans`, `trip_spans`, `trip_expenses`, `trip_tasks`, `trip_task_options`, `trip_travelers`, `trip_changes`, `trip_documents`, `trip_ideas`, `trip_event_places`; compare with staging if it differs).
- Second query: **no rows** (RLS on everywhere).
- Dashboard → Advisors (Security and Performance): record warnings about `trip_*`, the `private` schema or `realtime.messages`. Compare with staging; new unexplained "RLS disabled" or "exposed function" warnings abort.

## 3. Start maintenance and deploy the new code

`MAINTENANCE_MODE` is read by the new code only, so the deploy and the maintenance start together:

1. Vercel → Project → Settings → Environment Variables → Production: set `MAINTENANCE_MODE=on` (the exact value `on`).
2. Deploy `feature/relational-broadcast` (merged) to production: push/merge triggers it, or promote the prepared deployment. Make sure it was built **after** the variable was set.
3. Check: open the production app, edit anything. It must show the maintenance banner and keep the edit, and `curl -i -X POST https://<prod-host>/api/rooms/X/ops` must answer `503` (or `401` without a token: then use a signed-in session instead).
4. From this deploy on nothing writes `rooms.payload` any more (the `PATCH` route is gone). Trips may show empty until step 4 finishes; this is expected.

Abort here if the deploy fails or the app does not show the banner. See "Abort".

## 4. Migrate every room

```
psql "$PROD_DB_URL" <<'SQL'
\timing on
select room_code, ok, report from private.migrate_all_rooms();
SQL
```

- Expected: every room `ok = true` (rehearsal: 2 rooms in 212 ms). `report -> 'nulled'` entries are expected for legacy references; `report -> 'skipped'` or `'error'` are not.
- Any room with `ok = false`: stop. Do not turn maintenance off. Fix the data (if it is a data problem, in the app or by editing the payload with the owner's agreement, then `select private.migrate_room('<code>');`, which is idempotent) or abort.
- Running `migrate_all_rooms()` again is safe and must give the same counts.

## 5. Verify every room (gate)

```
psql "$PROD_DB_URL" -c "select room_code, differences from private.verify_all_rooms() where jsonb_array_length(differences) > 0;"
```

**No rows = 0 differences = continue.** Any row aborts (cause: payload and tables differ in the named area; fix and rerun step 4 for that room, or abort). Then, for one or more rooms:

```
psql "$PROD_DB_URL" -c "select private.verify_room('<code>');"   # must return []
psql "$PROD_DB_URL" -c "select count(*) from public.trip_events where room_code='<code>';"   # compare with the number of activities you know
```

## 6. Close the old Realtime path and open to users

1. Supabase Dashboard → Realtime → Settings: turn **off** "Allow public access" (private channels only). The new client uses private channels, so this does not affect it; old tabs lose their subscription and must reload.
2. Vercel: set `MAINTENANCE_MODE` to `off` (or delete the variable) and redeploy production so the value is read. The app is writable again.
3. Leave `rooms` in the `supabase_realtime` publication as is; nothing listens to it any more and cleanup happens in step 5.1.

## 7. Smoke test (two accounts)

Use two real accounts (owner and member of the same trip) in two browsers.

- [ ] Open the trip: days, activities, budget, tasks, ideas, documents and map show what the old app showed. Header says "Al día".
- [ ] A edits an activity; B sees it without reloading.
- [ ] A and B edit different activities at the same time: both saved.
- [ ] Same activity: the second one gets "Otro miembro cambió este elemento…" and shows the other version, and the loser's later edits do **not** overwrite the winner (fixed in `861905a`; test by holding A's requests with DevTools offline or throttling).
- [ ] Budget: add an expense and change the exchange rate; B sees both.
- [ ] Task: create, add an option, choose it (activity and expense appear).
- [ ] Ideas (add, vote), documents (Drive link) and map places.
- [ ] Reload B: everything is still there.
- [ ] Non-member: a third account (or a request without membership) gets `403` on `GET /api/rooms/<code>` and receives nothing on `trip:<code>`.
- [ ] Only the owner sees "Restablecer itinerario".
- [ ] Assistant: send one question and one edit; the edit shows up in the other browser. `ANTHROPIC_API_KEY` is set only in production.
- [ ] Old tab (opened before the deploy): reloading restores it; an old tab that tries to save is told to reload, not corrupted.

## 8. Close

- Delete the backup folder when you are done with the rollback window: `rm -rf /tmp/tw-cutover`.
- Mark 4.1 `[x]` in `docs/plans/relational-broadcast-progress.md` and add a log line with the date, room count, `migrate_all_rooms` duration, `ok` counts, `verify` result (counts and room codes only, never trip content), advisors, and any smoke test failure.
- Keep `rooms.payload` (never dropped) and keep `PREV_DEPLOY` until phase 5.1 is done. Then run the loop for 5.1 and later.

## Abort and rollback

| Point | What to do |
|---|---|
| Before step 3 (schema only) | Nothing to undo: the old app works. Leave the new tables or drop them later. |
| Steps 3–5, before opening to users | Vercel → Deployments → promote/rollback to `PREV_DEPLOY`. `rooms.payload` was never modified, so the old app works unchanged. Remove or set `MAINTENANCE_MODE=off` afterwards. Optionally clear the migrated rows later; `migrate_room` deletes and reloads them on the next try. |
| After step 6, nobody has edited yet (`select count(*) from public.trip_changes;` is 0, or only older than the cut-over) | Same: rollback the deployment to `PREV_DEPLOY`. Turn "Allow public access" back on in Realtime settings for the old app. |
| After step 6, users edited | 1) `MAINTENANCE_MODE=on` and redeploy the **new** code once more (this blocks writes). 2) For each room with changes after the cut-over: `psql "$PROD_DB_URL" -c "select private.rebuild_payload('<code>');"` (writes the tables back into `rooms.payload`, also bumps `updated_at` for the old client). 3) Realtime → "Allow public access" back on. 4) Roll back to `PREV_DEPLOY`. 5) Note the incident in the progress file. |

`rebuild_payload` output is verified in the rehearsal (`verify_room` returned `[]` after it); omitted-only differences are cosmetic (`spans: []`).

## Contacts and limits

- The migration of the one-room production data took about 100 ms in rehearsal; the window is dominated by the two Vercel deploys (about 2 × 1–2 minutes). Plan 15 minutes.
- Do not edit trips by hand in the dashboard during the window.
