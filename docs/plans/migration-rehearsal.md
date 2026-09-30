# Migration rehearsal runbook (step 2.3)

Rehearse the payload-to-tables migration on a **copy of production in staging** before the cut-over. It shows whether every trip migrates cleanly and how long it takes. Step 4.1 (the cut-over) only happens once this rehearsal ends with **0 differences**.

Production is only **read** here: one read-only script and one data dump. Every write happens in staging.

## What you need

- A staging Supabase project, separate from production.
- `psql` and `pg_dump` at the same major version as the projects (Dashboard → Project Settings → Infrastructure shows it).
- Connection strings from Dashboard → Connect → "Session pooler" or "Direct connection" for both projects. Export them in your shell only; never commit them:
  ```
  export PROD_DB_URL='postgresql://...'      # production, used read-only
  export STAGING_DB_URL='postgresql://...'   # staging
  ```
- This branch checked out (`feature/relational-broadcast`), which has migrations `008`–`012`.

The dump contains real trip data. Keep it in a temporary folder outside the repo and delete it at the end (step 9).

## 1. Check the stored payloads (production, read-only)

```
npx tsx --env-file=.env.local scripts/check-payloads.ts > check-payloads.txt
```

Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for production in `.env.local`. It never writes. Record in the progress file how many rooms were checked and how many have issues. Rooms with issues are likely to show up as `skipped` in step 5.

## 2. Prepare staging with the current production schema

Apply migrations `001`–`007` to staging in order (skip any that staging already has):

```
for f in supabase/migrations/00[1-7]_*.sql; do psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
```

Staging must not have any rooms yet: `psql "$STAGING_DB_URL" -c "select count(*) from public.rooms;"` should return `0`.

## 3. Copy the rooms from production

```
mkdir -p /tmp/tw-rehearsal
pg_dump "$PROD_DB_URL" --data-only --table=public.rooms --no-owner --no-privileges -f /tmp/tw-rehearsal/rooms.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/tw-rehearsal/rooms.sql
psql "$STAGING_DB_URL" -c "select count(*) from public.rooms;"
```

The count must match production (`psql "$PROD_DB_URL" -c "select count(*) from public.rooms;"`). Only `rooms` is copied: the migration reads `rooms.payload` and nothing else, and `user_rooms` would need the production `auth.users`.

If the restore fails on the `rooms_code_format` check, a room has a code the API no longer accepts. Record the code (not the trip content) in the progress file and stop here.

## 4. Apply the new migrations to staging

```
for f in supabase/migrations/0{08,09,10,11,12}_*.sql; do psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
```

Then run Dashboard → Advisors (Security and Performance) on staging and record any new warning about the `trip_*` tables, the `private` schema or `realtime.messages`.

## 5. Migrate every room and time it

```
psql "$STAGING_DB_URL" <<'SQL'
\timing on
\copy (select room_code, ok, report from private.migrate_all_rooms()) to '/tmp/tw-rehearsal/migrate-report.csv' csv header
SQL
```

The time printed by `\timing` is the length of this step in the maintenance window. Then:

```
psql "$STAGING_DB_URL" -c "select count(*) filter (where ok) as ok, count(*) filter (where not ok) as not_ok from private.migrate_all_rooms();"
```

Running it a second time is intentional: `migrate_room` is idempotent, and the counts must be the same both times.

For every row with `ok = false`, look at `report -> 'skipped'` (rows that could not be stored, with the database error) and `report -> 'error'` (the whole room failed). `report -> 'nulled'` lists references to missing days/events that became null; these are expected for legacy trips and are not differences.

## 6. Verify

```
psql "$STAGING_DB_URL" -c "\copy (select room_code, differences from private.verify_all_rooms() where jsonb_array_length(differences) > 0) to '/tmp/tw-rehearsal/verify-differences.csv' csv header"
wc -l /tmp/tw-rehearsal/verify-differences.csv
```

A file with only the header line means **0 differences**. Each difference names the area (`days`, `events`, `eventsPerDay`, `daySpans`, `tripSpans`, `expenses`, `expensesUSD`, `tasks`, `options`, `travelers`) with expected (payload) and actual (tables) values.

## 7. Spot-check the rollback path

```
psql "$STAGING_DB_URL" -c "select count(*) as rooms, count(*) filter (where private.trip_payload(code) = payload) as identical from public.rooms;"
```

Rooms that are not identical are expected when the payload had null optional fields, empty `spans`/`options` arrays, or skipped rows. Pick one room that verified clean, then:

```
psql "$STAGING_DB_URL" -c "select private.rebuild_payload('<code>');"
psql "$STAGING_DB_URL" -c "select private.verify_room('<code>');"
```

The second command must return `[]`.

## 8. Record the results

Add a log line to `docs/plans/relational-broadcast-progress.md` with **counts and room codes only, never trip content**:

- Date, production room count, rooms with `check-payloads` issues.
- `migrate_all_rooms`: duration, `ok` / `not ok` counts, and for each `not ok` room its code and the skipped tables and errors.
- `verify_all_rooms`: number of rooms with differences, and their codes and areas.
- Advisors: new warnings, if any.
- Step 7 result.

Mark 2.3 `[x]` only when verification has **0 differences**. Otherwise leave it `[H]` and describe each difference. Fix it in one of two ways:
- the room's data is wrong: fix it in production through the app (for example, an event whose end is before its start), then repeat from step 3;
- the migration is wrong: note it as a blocker in the progress file so the loop fixes `migrate_room` in a new migration, then repeat from step 4 on a fresh staging copy.

## 9. Clean up

```
rm -rf /tmp/tw-rehearsal check-payloads.txt
```

Staging can keep the migrated data for the phase 3 manual tests, or be reset.
