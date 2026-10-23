-- Group voting (docs/plans/group-voting.md): approval votes on the options of
-- "Por decidir" tasks, and the columns and functions date and destination votes
-- use. A vote is the voter's auth user id in trip_task_options.votes, so get_trip,
-- Broadcast (010), the version bump (013) and the audit log carry it as is.
-- private.trip_payload / rebuild_payload are intentionally NOT changed: votes,
-- option dates and decides are lost on a payload rollback, as icons are (020).

alter table public.trip_tasks add column if not exists decides text;
alter table public.trip_task_options add column if not exists votes text[];
alter table public.trip_task_options add column if not exists start_date date;
alter table public.trip_task_options add column if not exists end_date date;

-- Votes mirror LIMITS.votesPerOption; option dates mirror MAX_TRIP_DAYS (60 days).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trip_tasks_decides') then
    alter table public.trip_tasks add constraint trip_tasks_decides
      check (decides is null or decides in ('dates', 'destination'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trip_task_options_votes_size') then
    alter table public.trip_task_options add constraint trip_task_options_votes_size
      check (votes is null or cardinality(votes) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trip_task_options_dates') then
    alter table public.trip_task_options add constraint trip_task_options_dates
      check ((start_date is null) = (end_date is null)
             and (end_date is null or end_date between start_date and start_date + 59));
  end if;
end $$;

-- Adds (p_on) or removes p_user's vote on one option, in one statement and
-- without a version guard: the UPDATE locks the row, so concurrent voters
-- serialize and READ COMMITTED re-checks the WHERE against the newer row (no
-- vote is lost). A vote already in that state writes nothing (no broadcast,
-- no history). Called only by the API with the service role, after
-- requireMember; p_user is always the caller. Returns the option as stored.
create or replace function public.set_task_option_vote(p_code text, p_option_id text, p_on boolean, p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v jsonb;
begin
  update public.trip_task_options o
  set votes = case when p_on then coalesce(o.votes, '{}') || p_user::text
                   else nullif(array_remove(o.votes, p_user::text), '{}') end,
      updated_by = p_user
  where o.room_code = p_code and o.id = p_option_id
    and (p_user::text = any(coalesce(o.votes, '{}'))) is distinct from p_on
  returning to_jsonb(o) into v;
  if v is null then
    select to_jsonb(o) into v from public.trip_task_options o where o.room_code = p_code and o.id = p_option_id;
    if v is null then
      raise exception 'option not found' using errcode = 'P0002';
    end if;
  end if;
  return v;
end;
$$;

revoke all on function public.set_task_option_vote(text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_task_option_vote(text, text, boolean, uuid) to service_role;

-- Closes a date or destination vote with its winning option, atomically (owner
-- only, checked by the API). Dates set the trip dates and rebuild the days with
-- reset_itinerary from p_days (built by the API from the option's dates); when
-- the itinerary has activities that needs p_replace, so an activity added while
-- the owner confirmed is never wiped silently. A destination sets the trip
-- destination. Then the task is marked done. p_expected_version guards the task
-- (null = no guard). The room is locked first, in the same order as
-- reset_itinerary. Returns {task, days, trip} (days null for a destination), or
-- {conflict: true, current: <task or null>} when the task changed or is gone.
create or replace function public.close_task_vote(
  p_code             text,
  p_task_id          text,
  p_option_id        text,
  p_expected_version int,
  p_days             jsonb,
  p_replace          boolean,
  p_user             uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_task   public.trip_tasks;
  v_option public.trip_task_options;
  v_days   jsonb;
  v_trip   jsonb;
begin
  perform 1 from public.rooms where code = p_code for update;
  if not found then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  select * into v_task from public.trip_tasks
  where room_code = p_code and id = p_task_id
  for update;
  if not found or (p_expected_version is not null and v_task.version <> p_expected_version) then
    return jsonb_build_object('conflict', true, 'current', case when found then to_jsonb(v_task) end);
  end if;
  if v_task.decides is null or v_task.done then
    raise exception 'task is not an open vote' using errcode = '22023';
  end if;

  select * into v_option from public.trip_task_options
  where room_code = p_code and id = p_option_id and task_id = p_task_id;
  if not found then
    raise exception 'option not found' using errcode = 'P0002';
  end if;

  if v_task.decides = 'dates' then
    if v_option.start_date is null or v_option.end_date is null then
      raise exception 'option has no dates' using errcode = '22023';
    end if;
    if not coalesce(p_replace, false) and exists (select 1 from public.trip_events where room_code = p_code) then
      raise exception 'the itinerary has activities' using errcode = '22023';
    end if;
    update public.rooms
    set start_date = v_option.start_date, end_date = v_option.end_date
    where code = p_code;
    v_days := public.reset_itinerary(p_code, p_days, p_user) -> 'days';
  else
    update public.rooms set destination = v_option.label where code = p_code;
  end if;

  update public.trip_tasks
  set done = true, updated_by = p_user
  where room_code = p_code and id = p_task_id
  returning * into v_task;

  select jsonb_build_object(
    'code', r.code, 'name', r.name, 'destination', r.destination,
    'start_date', r.start_date, 'end_date', r.end_date, 'exchange_rate', r.exchange_rate,
    'idea_places', r.idea_places, 'idea_plan', r.idea_plan
  ) into v_trip
  from public.rooms r where r.code = p_code;

  return jsonb_build_object('task', to_jsonb(v_task), 'days', v_days, 'trip', v_trip);
end;
$$;

revoke all on function public.close_task_vote(text, text, text, int, jsonb, boolean, uuid) from public, anon, authenticated;
grant execute on function public.close_task_vote(text, text, text, int, jsonb, boolean, uuid) to service_role;

-- get_trip as of 020, plus: task decides; option votes and dates; and the trip
-- header always (dates only when both are set), so undated trips keep their
-- name and destination.
create or replace function public.get_trip(p_code text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'code', r.code,
    'members', coalesce(r.members, '[]'::jsonb),
    'updated_at', r.updated_at,
    'payload', jsonb_build_object(
      'days', coalesce((
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'id', d.id, 'label', d.label, 'sub', d.sub, 'flexible', d.flexible, 'version', d.version,
            'spans', (
              select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', s.id, 'label', s.label, 'startEventId', s.start_event_id, 'endEventId', s.end_event_id,
                'startHour', s.start_hour, 'endHour', s.end_hour, 'bg', s.bg, 'border', s.border,
                'zIndex', s.z_index, 'version', s.version
              )) order by s.position, s.id)
              from public.trip_day_spans s where s.room_code = d.room_code and s.day_id = d.id
            )
          ))
          || jsonb_build_object('events', coalesce((
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id', e.id, 'start', e.start_hour, 'end', e.end_hour, 'title', e.title, 'cat', e.cat,
              'note', e.note, 'mapsUrl', e.maps_url, 'documentId', e.document_id, 'icon', e.icon, 'version', e.version
            )) order by e.position, e.id)
            from public.trip_events e where e.room_code = d.room_code and e.day_id = d.id
          ), '[]'::jsonb))
          order by d.position, d.id)
        from public.trip_days d where d.room_code = r.code
      ), '[]'::jsonb),
      'extras', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', x.id, 'label', x.label, 'amount', x.amount, 'currency', x.currency, 'splitMode', x.split_mode,
          'linkedEventId', x.linked_event_id, 'startDayId', x.start_day_id, 'endDayId', x.end_day_id,
          'documentId', x.document_id, 'version', x.version
        )) order by x.position, x.id)
        from public.trip_expenses x where x.room_code = r.code
      ), '[]'::jsonb),
      'tripSpans', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', s.id, 'label', s.label, 'startEventId', s.start_event_id, 'endEventId', s.end_event_id,
          'bg', s.bg, 'border', s.border, 'zIndex', s.z_index, 'version', s.version
        )) order by s.position, s.id)
        from public.trip_spans s where s.room_code = r.code
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', t.id, 'title', t.title, 'done', t.done, 'note', t.note, 'dayId', t.day_id,
          'start', t.start_hour, 'end', t.end_hour, 'cat', t.cat, 'priority', t.priority, 'icon', t.icon,
          'decides', t.decides, 'version', t.version,
          'options', (
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id', o.id, 'label', o.label, 'note', o.note, 'amount', o.amount,
              'currency', o.currency, 'splitMode', o.split_mode, 'votes', o.votes,
              'startDate', to_char(o.start_date, 'YYYY-MM-DD'), 'endDate', to_char(o.end_date, 'YYYY-MM-DD'),
              'version', o.version
            )) order by o.position, o.id)
            from public.trip_task_options o where o.room_code = t.room_code and o.task_id = t.id
          )
        )) order by t.position, t.id)
        from public.trip_tasks t where t.room_code = r.code
      ), '[]'::jsonb),
      'mockPeople', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'version', m.version) order by m.position, m.id)
        from public.trip_travelers m where m.room_code = r.code
      ), '[]'::jsonb),
      'documents', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', x.id, 'driveFileId', x.drive_file_id, 'title', x.title, 'kind', x.kind, 'version', x.version
        )) order by x.position, x.id)
        from public.trip_documents x where x.room_code = r.code
      ), '[]'::jsonb),
      'ideas', coalesce((
        select jsonb_agg(i.data || jsonb_build_object('id', i.id, 'version', i.version) order by i.position, i.id)
        from public.trip_ideas i where i.room_code = r.code
      ), '[]'::jsonb),
      'eventPlaces', coalesce((
        select jsonb_object_agg(pl.id, pl.data || jsonb_build_object('version', pl.version))
        from public.trip_event_places pl where pl.room_code = r.code
      ), '{}'::jsonb)
    )
    || coalesce(r.idea_plan, '{}'::jsonb)
    || case when r.idea_places is not null then jsonb_build_object('ideaPlaces', r.idea_places) else '{}'::jsonb end
    || case when r.exchange_rate is not null
         then jsonb_build_object('exchangeRate', r.exchange_rate) else '{}'::jsonb end
    || jsonb_build_object('trip', jsonb_strip_nulls(jsonb_build_object(
         'name', coalesce(r.name, ''),
         'destination', r.destination,
         'startDate', case when r.start_date is not null and r.end_date is not null
                        then to_char(r.start_date, 'YYYY-MM-DD') end,
         'endDate', case when r.start_date is not null and r.end_date is not null
                      then to_char(r.end_date, 'YYYY-MM-DD') end
       )))
  )
  from public.rooms r
  where r.code = p_code
$$;
