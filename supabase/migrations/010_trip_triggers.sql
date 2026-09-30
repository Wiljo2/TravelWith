-- History and Realtime fan-out for the trip tables
-- (docs/plans/relational-broadcast.md, step 1.3).
--
-- Trigger functions live in schema private: the realtime schema is locked for
-- new objects, and private is not exposed through the API. Both functions are
-- security definer so they work whoever the writer is (service role today),
-- with an empty search_path and execute revoked from client roles.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Audit: one trip_changes row per effective change. The acting user is, in
-- order: the app.user_id setting (set by server SQL functions, needed for
-- deletes), the row's updated_by (inserts and updates), auth.uid().
-- Deletes cascading from a deleted room are not recorded: the room and its
-- history are gone together.
create or replace function private.record_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room text := coalesce(new.room_code, old.room_code);
  v_user uuid;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return null;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.rooms where code = v_room) then
    return null;
  end if;

  v_user := coalesce(
    nullif(current_setting('app.user_id', true), '')::uuid,
    case when tg_op = 'DELETE' then null else new.updated_by end,
    auth.uid()
  );

  insert into public.trip_changes (room_code, table_name, row_id, op, before, after, user_id)
  values (
    v_room,
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    v_user
  );
  return null;
end;
$$;

-- Broadcast: every row change goes to the private channel trip:<room_code>.
-- Event name and operation are INSERT / UPDATE / DELETE.
create or replace function private.broadcast_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return null;
  end if;

  perform realtime.broadcast_changes(
    'trip:' || coalesce(new.room_code, old.room_code),
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function private.record_trip_change() from public, anon, authenticated;
revoke all on function private.broadcast_trip_change() from public, anon, authenticated;

drop trigger if exists trip_days_audit on public.trip_days;
create trigger trip_days_audit
  after insert or update or delete on public.trip_days
  for each row execute function private.record_trip_change();

drop trigger if exists trip_days_broadcast on public.trip_days;
create trigger trip_days_broadcast
  after insert or update or delete on public.trip_days
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_events_audit on public.trip_events;
create trigger trip_events_audit
  after insert or update or delete on public.trip_events
  for each row execute function private.record_trip_change();

drop trigger if exists trip_events_broadcast on public.trip_events;
create trigger trip_events_broadcast
  after insert or update or delete on public.trip_events
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_day_spans_audit on public.trip_day_spans;
create trigger trip_day_spans_audit
  after insert or update or delete on public.trip_day_spans
  for each row execute function private.record_trip_change();

drop trigger if exists trip_day_spans_broadcast on public.trip_day_spans;
create trigger trip_day_spans_broadcast
  after insert or update or delete on public.trip_day_spans
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_spans_audit on public.trip_spans;
create trigger trip_spans_audit
  after insert or update or delete on public.trip_spans
  for each row execute function private.record_trip_change();

drop trigger if exists trip_spans_broadcast on public.trip_spans;
create trigger trip_spans_broadcast
  after insert or update or delete on public.trip_spans
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_expenses_audit on public.trip_expenses;
create trigger trip_expenses_audit
  after insert or update or delete on public.trip_expenses
  for each row execute function private.record_trip_change();

drop trigger if exists trip_expenses_broadcast on public.trip_expenses;
create trigger trip_expenses_broadcast
  after insert or update or delete on public.trip_expenses
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_tasks_audit on public.trip_tasks;
create trigger trip_tasks_audit
  after insert or update or delete on public.trip_tasks
  for each row execute function private.record_trip_change();

drop trigger if exists trip_tasks_broadcast on public.trip_tasks;
create trigger trip_tasks_broadcast
  after insert or update or delete on public.trip_tasks
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_task_options_audit on public.trip_task_options;
create trigger trip_task_options_audit
  after insert or update or delete on public.trip_task_options
  for each row execute function private.record_trip_change();

drop trigger if exists trip_task_options_broadcast on public.trip_task_options;
create trigger trip_task_options_broadcast
  after insert or update or delete on public.trip_task_options
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_travelers_audit on public.trip_travelers;
create trigger trip_travelers_audit
  after insert or update or delete on public.trip_travelers
  for each row execute function private.record_trip_change();

drop trigger if exists trip_travelers_broadcast on public.trip_travelers;
create trigger trip_travelers_broadcast
  after insert or update or delete on public.trip_travelers
  for each row execute function private.broadcast_trip_change();

-- Receiving: members of a trip may read its Broadcast messages. No insert
-- policy: clients never send on trip channels, only these triggers do.
drop policy if exists "members receive trip broadcasts" on realtime.messages;
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

-- Retention for trip_changes: keep 90 days, and at most the newest 5,000
-- changes per trip. Not scheduled here; once pg_cron is enabled, schedule it
-- with:
--   select cron.schedule('prune-trip-changes', '17 3 * * *', 'select private.prune_trip_changes()');
create or replace function private.prune_trip_changes()
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from public.trip_changes c
  where c.created_at < now() - interval '90 days'
     or c.id in (
       select ranked.id from (
         select id, row_number() over (partition by room_code order by id desc) as rn
         from public.trip_changes
       ) ranked
       where ranked.rn > 5000
     );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function private.prune_trip_changes() from public, anon, authenticated;
