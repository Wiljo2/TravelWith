-- One-time copy of rooms.payload into the trip tables
-- (docs/plans/relational-broadcast.md, step 2.1). Run by a person during the
-- cut-over (docs/plans/cutover-runbook.md), never by the app:
--
--   select * from private.migrate_all_rooms();
--
-- rooms.payload is only read, never modified. migrate_room is idempotent: it
-- deletes the trip's rows and inserts them again, so it must not run after
-- users start editing the tables.
--
-- Rows that cannot be stored (missing required fields, failed checks,
-- duplicate ids, trip spans whose events are missing) are skipped and listed in
-- the report; optional references to missing days or events become null and
-- are listed too. private.verify_room (step 2.2) compares the result.

-- Bulk loads set app.bulk_load = 'on' for their transaction: the audit and
-- Broadcast triggers skip those writes, so migrating does not flood
-- trip_changes or the channels. Replaces the 010 bodies with that guard only.
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
  if current_setting('app.bulk_load', true) = 'on' then
    return null;
  end if;
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

create or replace function private.broadcast_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.bulk_load', true) = 'on' then
    return null;
  end if;
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

-- Lenient readers for legacy JSON values: wrong types become null instead of
-- failing the whole trip.
create or replace function private.json_num(v jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric
    when jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then trim(v #>> '{}')::numeric
  end
$$;

create or replace function private.json_text(v jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) in ('string', 'number', 'boolean') then v #>> '{}' end
$$;

create or replace function private.json_bool(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(v) = 'boolean' then (v #>> '{}')::boolean end
$$;

create or replace function private.json_date(v jsonb)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$' then
    return (v #>> '{}')::date;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

create or replace function private.migrate_room(p_code text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  p          jsonb;
  r          record;
  v_skipped  jsonb := '[]'::jsonb;
  v_nulled   jsonb := '[]'::jsonb;
  v_ref      text;
  v_ref2     text;
  v_ref3     text;
  v_start    date;
  v_end      date;
  v_rate     numeric;
begin
  select payload into p from public.rooms where code = p_code for update;
  if not found then
    raise exception 'room % not found', p_code;
  end if;
  p := coalesce(p, '{}'::jsonb);

  perform set_config('app.bulk_load', 'on', true);

  delete from public.trip_task_options where room_code = p_code;
  delete from public.trip_tasks where room_code = p_code;
  delete from public.trip_expenses where room_code = p_code;
  delete from public.trip_spans where room_code = p_code;
  delete from public.trip_day_spans where room_code = p_code;
  delete from public.trip_events where room_code = p_code;
  delete from public.trip_days where room_code = p_code;
  delete from public.trip_travelers where room_code = p_code;

  v_start := private.json_date(p -> 'trip' -> 'startDate');
  v_end := private.json_date(p -> 'trip' -> 'endDate');
  if v_start is not null and v_end is not null and v_end < v_start then
    v_nulled := v_nulled || jsonb_build_object('table', 'rooms', 'id', p_code, 'field', 'end_date');
    v_end := null;
  end if;
  v_rate := private.json_num(p -> 'exchangeRate');
  update public.rooms
  set destination = nullif(left(trim(private.json_text(p -> 'trip' -> 'destination')), 80), ''),
      start_date = v_start,
      end_date = v_end,
      exchange_rate = case when v_rate > 0 then v_rate end
  where code = p_code;

  -- Days
  for r in
    select d.value as v, d.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end)
      with ordinality as d(value, ord)
  loop
    begin
      insert into public.trip_days (room_code, id, position, label, sub, flexible)
      values (p_code, private.json_text(r.v -> 'id'), r.pos, private.json_text(r.v -> 'label'),
              private.json_text(r.v -> 'sub'), private.json_bool(r.v -> 'flexible'));
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_days', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Events
  for r in
    select d.value -> 'id' as day_id, e.value as v, e.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end) as d(value)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value -> 'events') = 'array' then d.value -> 'events' else '[]'::jsonb end)
      with ordinality as e(value, ord)
  loop
    begin
      insert into public.trip_events (room_code, id, day_id, position, start_hour, end_hour, title, cat, note)
      values (p_code, private.json_text(r.v -> 'id'), private.json_text(r.day_id), r.pos,
              private.json_num(r.v -> 'start'), private.json_num(r.v -> 'end'),
              private.json_text(r.v -> 'title'), private.json_text(r.v -> 'cat'), private.json_text(r.v -> 'note'));
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_events', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Day spans: event references are optional
  for r in
    select d.value -> 'id' as day_id, s.value as v, s.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end) as d(value)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value -> 'spans') = 'array' then d.value -> 'spans' else '[]'::jsonb end)
      with ordinality as s(value, ord)
  loop
    v_ref := private.json_text(r.v -> 'startEventId');
    if v_ref is not null and not exists (select 1 from public.trip_events where room_code = p_code and id = v_ref) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_day_spans', 'id', r.v -> 'id', 'field', 'start_event_id');
      v_ref := null;
    end if;
    v_ref2 := private.json_text(r.v -> 'endEventId');
    if v_ref2 is not null and not exists (select 1 from public.trip_events where room_code = p_code and id = v_ref2) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_day_spans', 'id', r.v -> 'id', 'field', 'end_event_id');
      v_ref2 := null;
    end if;
    begin
      insert into public.trip_day_spans (room_code, id, day_id, position, label, start_event_id, end_event_id,
                                         start_hour, end_hour, bg, border, z_index)
      values (p_code, private.json_text(r.v -> 'id'), private.json_text(r.day_id), r.pos, private.json_text(r.v -> 'label'),
              v_ref, v_ref2, private.json_num(r.v -> 'startHour'), private.json_num(r.v -> 'endHour'),
              private.json_text(r.v -> 'bg'), private.json_text(r.v -> 'border'), round(private.json_num(r.v -> 'zIndex')));
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_day_spans', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Trip spans: both events are required, so a missing one skips the span
  for r in
    select s.value as v, s.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'tripSpans') = 'array' then p -> 'tripSpans' else '[]'::jsonb end)
      with ordinality as s(value, ord)
  loop
    begin
      insert into public.trip_spans (room_code, id, position, label, start_event_id, end_event_id, bg, border, z_index)
      values (p_code, private.json_text(r.v -> 'id'), r.pos, private.json_text(r.v -> 'label'),
              private.json_text(r.v -> 'startEventId'), private.json_text(r.v -> 'endEventId'),
              private.json_text(r.v -> 'bg'), private.json_text(r.v -> 'border'), round(private.json_num(r.v -> 'zIndex')));
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_spans', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Expenses: event and day references are optional
  for r in
    select x.value as v, x.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'extras') = 'array' then p -> 'extras' else '[]'::jsonb end)
      with ordinality as x(value, ord)
  loop
    v_ref := private.json_text(r.v -> 'linkedEventId');
    if v_ref is not null and not exists (select 1 from public.trip_events where room_code = p_code and id = v_ref) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_expenses', 'id', r.v -> 'id', 'field', 'linked_event_id');
      v_ref := null;
    end if;
    v_ref2 := private.json_text(r.v -> 'startDayId');
    if v_ref2 is not null and not exists (select 1 from public.trip_days where room_code = p_code and id = v_ref2) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_expenses', 'id', r.v -> 'id', 'field', 'start_day_id');
      v_ref2 := null;
    end if;
    v_ref3 := private.json_text(r.v -> 'endDayId');
    if v_ref3 is not null and not exists (select 1 from public.trip_days where room_code = p_code and id = v_ref3) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_expenses', 'id', r.v -> 'id', 'field', 'end_day_id');
      v_ref3 := null;
    end if;
    begin
      insert into public.trip_expenses (room_code, id, position, label, amount, currency, split_mode,
                                        linked_event_id, start_day_id, end_day_id)
      values (p_code, private.json_text(r.v -> 'id'), r.pos, private.json_text(r.v -> 'label'),
              private.json_num(r.v -> 'amount'),
              case when r.v ->> 'currency' in ('USD', 'COP') then r.v ->> 'currency' end,
              case when r.v ->> 'splitMode' in ('group', 'perPerson') then r.v ->> 'splitMode' end,
              v_ref, v_ref2, v_ref3);
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_expenses', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Tasks: a missing day sends the task back to the backlog
  for r in
    select t.value as v, t.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'tasks') = 'array' then p -> 'tasks' else '[]'::jsonb end)
      with ordinality as t(value, ord)
  loop
    v_ref := private.json_text(r.v -> 'dayId');
    if v_ref is not null and not exists (select 1 from public.trip_days where room_code = p_code and id = v_ref) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_tasks', 'id', r.v -> 'id', 'field', 'day_id');
      v_ref := null;
    end if;
    begin
      insert into public.trip_tasks (room_code, id, position, title, done, note, day_id, start_hour, end_hour, cat, priority)
      values (p_code, private.json_text(r.v -> 'id'), r.pos, private.json_text(r.v -> 'title'),
              coalesce(private.json_bool(r.v -> 'done'), false), private.json_text(r.v -> 'note'), v_ref,
              private.json_num(r.v -> 'start'), private.json_num(r.v -> 'end'), private.json_text(r.v -> 'cat'),
              case when r.v ->> 'priority' in ('alta', 'media', 'baja') then r.v ->> 'priority' end);
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_tasks', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Task options
  for r in
    select t.value -> 'id' as task_id, o.value as v, o.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'tasks') = 'array' then p -> 'tasks' else '[]'::jsonb end) as t(value)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(t.value -> 'options') = 'array' then t.value -> 'options' else '[]'::jsonb end)
      with ordinality as o(value, ord)
  loop
    begin
      insert into public.trip_task_options (room_code, id, task_id, position, label, note, amount, currency, split_mode)
      values (p_code, private.json_text(r.v -> 'id'), private.json_text(r.task_id), r.pos, private.json_text(r.v -> 'label'),
              private.json_text(r.v -> 'note'), private.json_num(r.v -> 'amount'),
              case when r.v ->> 'currency' in ('USD', 'COP') then r.v ->> 'currency' end,
              case when r.v ->> 'splitMode' in ('group', 'perPerson') then r.v ->> 'splitMode' end);
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_task_options', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Travelers without an account
  for r in
    select m.value as v, m.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'mockPeople') = 'array' then p -> 'mockPeople' else '[]'::jsonb end)
      with ordinality as m(value, ord)
  loop
    begin
      insert into public.trip_travelers (room_code, id, position, name)
      values (p_code, private.json_text(r.v -> 'id'), r.pos, private.json_text(r.v -> 'name'));
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_travelers', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  perform set_config('app.bulk_load', 'off', true);

  return jsonb_build_object(
    'room', p_code,
    'days', (select count(*) from public.trip_days where room_code = p_code),
    'events', (select count(*) from public.trip_events where room_code = p_code),
    'daySpans', (select count(*) from public.trip_day_spans where room_code = p_code),
    'tripSpans', (select count(*) from public.trip_spans where room_code = p_code),
    'expenses', (select count(*) from public.trip_expenses where room_code = p_code),
    'tasks', (select count(*) from public.trip_tasks where room_code = p_code),
    'options', (select count(*) from public.trip_task_options where room_code = p_code),
    'travelers', (select count(*) from public.trip_travelers where room_code = p_code),
    'skipped', v_skipped,
    'nulled', v_nulled
  );
end;
$$;

-- Migrates every room, each in its own subtransaction: a room that fails is
-- rolled back alone and reported with its error.
create or replace function private.migrate_all_rooms()
returns table (room_code text, ok boolean, report jsonb)
language plpgsql
set search_path = ''
as $$
declare
  v_code text;
begin
  for v_code in select code from public.rooms order by code loop
    begin
      room_code := v_code;
      report := private.migrate_room(v_code);
      ok := jsonb_array_length(report -> 'skipped') = 0;
    exception when others then
      ok := false;
      report := jsonb_build_object('room', v_code, 'error', sqlerrm);
    end;
    return next;
  end loop;
end;
$$;

revoke all on function private.json_num(jsonb) from public, anon, authenticated;
revoke all on function private.json_text(jsonb) from public, anon, authenticated;
revoke all on function private.json_bool(jsonb) from public, anon, authenticated;
revoke all on function private.json_date(jsonb) from public, anon, authenticated;
revoke all on function private.migrate_room(text) from public, anon, authenticated;
revoke all on function private.migrate_all_rooms() from public, anon, authenticated;
