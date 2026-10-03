-- Lock down client access. The app's route handlers use the service role key,
-- which bypasses RLS; these policies only constrain the public anon key and
-- signed-in browser clients (PostgREST and Realtime).
--
-- Restrictive policies are ANDed with the existing permissive ones from 001/002,
-- so nothing is dropped: a row is visible or writable only when both allow it.

-- rooms: only members of a room can read or write it directly. Realtime
-- postgres_changes applies the same select check per subscriber.
drop policy if exists "members only" on rooms;
create policy "members only" on rooms
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from user_rooms ur
    where ur.room_code = rooms.code and ur.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from user_rooms ur
    where ur.room_code = rooms.code and ur.user_id = auth.uid()
  ));

-- user_rooms: membership is written only by the server (join, leave, GC), so
-- clients can no longer grant themselves a role or bypass the leave flow.
drop policy if exists "server inserts only" on user_rooms;
create policy "server inserts only" on user_rooms
  as restrictive for insert
  to anon, authenticated
  with check (false);

drop policy if exists "server deletes only" on user_rooms;
create policy "server deletes only" on user_rooms
  as restrictive for delete
  to anon, authenticated
  using (false);

-- Membership must point at a real room; deleting a room removes its
-- memberships. Added NOT VALID so existing orphan rows don't block the
-- migration; validated right away when there are none.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_rooms_room_code_fkey') then
    alter table user_rooms
      add constraint user_rooms_room_code_fkey
      foreign key (room_code) references rooms (code) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from user_rooms ur
    where not exists (select 1 from rooms r where r.code = ur.room_code)
  ) then
    alter table user_rooms validate constraint user_rooms_room_code_fkey;
  else
    raise notice 'user_rooms has orphan rows; clean them up, then run: alter table user_rooms validate constraint user_rooms_room_code_fkey;';
  end if;
end $$;

-- Room codes must match the format the API accepts (normalizeRoomCode).
-- NOT VALID: enforced for new and updated rows, existing rows untouched.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_code_format') then
    alter table rooms add constraint rooms_code_format check (code ~ '^[A-Z0-9]{4,12}$') not valid;
  end if;
end $$;

-- Pin the trigger function's search_path (Supabase advisor:
-- function_search_path_mutable). It only calls now(), from pg_catalog.
alter function touch_updated_at() set search_path = '';
