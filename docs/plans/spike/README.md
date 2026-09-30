# Phase 0 spike: Broadcast from the database on a private channel

Goal (step 0.1 of `docs/plans/relational-broadcast.md`): confirm, on a **staging** project, that a row trigger calling `realtime.broadcast_changes` reaches members on the private channel `trip:<code>`, that non-members receive nothing, what the exact client payload looks like, and whether a token refresh keeps the subscription alive.

Nothing here runs against production. Nothing here is a migration.

## Files

| File | Purpose |
|---|---|
| `spike.sql` | `public.spike_events` table (with `room_code`), RLS, `private.spike_broadcast_change()` trigger, `select` policy on `realtime.messages` for members |
| `writes.sql` | Insert / update / delete statements to trigger broadcasts |
| `listen.ts` | Node listener: signs in, subscribes to `trip:<code>` as a private channel, prints every message with its size |
| `teardown.sql` | Removes everything `spike.sql` created |

## Prerequisites

- A staging Supabase project with migrations `001`–`007` applied (never production).
- Two staging users with email + password sign-in: **A** (member) and **B** (not a member).
- A room in staging, e.g. `SPIKE01`, with A in `user_rooms` and B not. Easiest: sign in to the app pointed at staging as A and create a trip, then use its code; or insert by hand in the SQL editor:
  ```sql
  insert into public.rooms (code, name, payload) values ('SPIKE01', 'Spike', '{}'::jsonb);
  insert into public.user_rooms (user_id, room_code, role)
  values ('<user A uuid>', 'SPIKE01', 'owner');
  ```
- Realtime settings: leave "Allow public access" as it is for now (the test uses a private channel either way).

## Steps

1. In the staging SQL editor, run `spike.sql`.
2. Create `docs/plans/spike/.env.spike.local` (gitignored by `*.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=<staging url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
   SPIKE_EMAIL=<user A email>
   SPIKE_PASSWORD=<user A password>
   SPIKE_ROOM=SPIKE01
   ```
3. Terminal 1 (member A):
   ```
   npx tsx --env-file=docs/plans/spike/.env.spike.local docs/plans/spike/listen.ts
   ```
   Expect `channel status SUBSCRIBED`.
4. Terminal 2 (non-member B): same command with `SPIKE_EMAIL`/`SPIKE_PASSWORD` of B, e.g. from a second env file `.env.spike-b.local`. Note what status B gets (`SUBSCRIBED`, `CHANNEL_ERROR`, …).
5. Run each statement of `writes.sql` in the SQL editor, one at a time. After each one:
   - A prints `broadcast INSERT|UPDATE|DELETE (<n> bytes)` followed by the full message.
   - B prints nothing.
6. Token refresh: restart A with `SPIKE_REFRESH_SECONDS=60` in its env file. Wait for at least two `token refreshed, setAuth called` lines, then run `writes.sql` again. A must still receive every change. Optionally leave A running past the JWT expiry (default 1 hour) without the forced refresh and repeat.
7. Run `teardown.sql`.

## What to record in `docs/plans/relational-broadcast-progress.md`

Paste into the log (and mark 0.1 `[x]`):

1. One full message for each of INSERT, UPDATE and DELETE, exactly as printed by A (event name, where the row lives, e.g. `payload.record` / `payload.old_record`, and the names for operation, table and schema).
2. The byte size of the INSERT message for the 200-character title.
3. What B saw: channel status and whether any message arrived (must be none).
4. Token refresh: whether A kept receiving after forced refreshes, and after the natural JWT expiry if tested; any `CHANNEL_ERROR` / `CLOSED` lines.
5. Anything that differs from the plan (for example the event name not being `INSERT`/`UPDATE`/`DELETE`).

Step 3.10 (`useTripChannel`) is written against this record.
