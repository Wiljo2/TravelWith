-- Verification and rollback for the payload-to-tables cut-over
-- (docs/plans/relational-broadcast.md, step 2.2). Run by a person, never by the
-- app:
--
--   select * from private.verify_all_rooms() where jsonb_array_length(differences) > 0;
--   select private.rebuild_payload('<code>');   -- rollback, writes rooms.payload
--
-- private.trip_payload(code) assembles the tables into the RoomPayload shape
-- without writing anything; rebuild_payload stores that result.

create or replace function private.trip_payload(p_code text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select
    coalesce(r.payload, '{}'::jsonb)
    || jsonb_build_object(
      'days', coalesce((
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'id', d.id, 'label', d.label, 'sub', d.sub, 'flexible', d.flexible,
            'spans', (
              select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                'id', s.id, 'label', s.label, 'startEventId', s.start_event_id, 'endEventId', s.end_event_id,
                'startHour', s.start_hour, 'endHour', s.end_hour, 'bg', s.bg, 'border', s.border, 'zIndex', s.z_index
              )) order by s.position, s.id)
              from public.trip_day_spans s where s.room_code = d.room_code and s.day_id = d.id
            )
          ))
          || jsonb_build_object('events', coalesce((
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id', e.id, 'start', e.start_hour, 'end', e.end_hour, 'title', e.title, 'cat', e.cat, 'note', e.note
            )) order by e.position, e.id)
            from public.trip_events e where e.room_code = d.room_code and e.day_id = d.id
          ), '[]'::jsonb))
          order by d.position, d.id)
        from public.trip_days d where d.room_code = r.code
      ), '[]'::jsonb),
      'extras', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', x.id, 'label', x.label, 'amount', x.amount, 'currency', x.currency, 'splitMode', x.split_mode,
          'linkedEventId', x.linked_event_id, 'startDayId', x.start_day_id, 'endDayId', x.end_day_id
        )) order by x.position, x.id)
        from public.trip_expenses x where x.room_code = r.code
      ), '[]'::jsonb),
      'tripSpans', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', s.id, 'label', s.label, 'startEventId', s.start_event_id, 'endEventId', s.end_event_id,
          'bg', s.bg, 'border', s.border, 'zIndex', s.z_index
        )) order by s.position, s.id)
        from public.trip_spans s where s.room_code = r.code
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', t.id, 'title', t.title, 'done', t.done, 'note', t.note, 'dayId', t.day_id,
          'start', t.start_hour, 'end', t.end_hour, 'cat', t.cat, 'priority', t.priority,
          'options', (
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id', o.id, 'label', o.label, 'note', o.note, 'amount', o.amount,
              'currency', o.currency, 'splitMode', o.split_mode
            )) order by o.position, o.id)
            from public.trip_task_options o where o.room_code = t.room_code and o.task_id = t.id
          )
        )) order by t.position, t.id)
        from public.trip_tasks t where t.room_code = r.code
      ), '[]'::jsonb),
      'mockPeople', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.position, m.id)
        from public.trip_travelers m where m.room_code = r.code
      ), '[]'::jsonb)
    )
    || case when r.exchange_rate is not null
         then jsonb_build_object('exchangeRate', r.exchange_rate) else '{}'::jsonb end
    || case when r.payload ? 'trip' or r.start_date is not null
         then jsonb_build_object('trip',
           coalesce(case when jsonb_typeof(r.payload -> 'trip') = 'object' then r.payload -> 'trip' end, '{}'::jsonb)
           || jsonb_strip_nulls(jsonb_build_object(
             'name', coalesce(r.name, r.payload -> 'trip' ->> 'name'),
             'destination', r.destination,
             'startDate', to_char(r.start_date, 'YYYY-MM-DD'),
             'endDate', to_char(r.end_date, 'YYYY-MM-DD')
           )))
         else '{}'::jsonb end
  from public.rooms r
  where r.code = p_code
$$;

-- Area-by-area comparison of rooms.payload against the tables. Returns one
-- entry per difference; an empty array means the trip migrated completely.
-- Money is compared in USD, each amount rounded to cents as stored, using the
-- payload's rate on one side and rooms.exchange_rate on the other.
create or replace function private.verify_room(p_code text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  p       jsonb;
  v_rate  numeric;
  v_diffs jsonb := '[]'::jsonb;
  v_area  record;
begin
  select coalesce(payload, '{}'::jsonb), exchange_rate into p, v_rate from public.rooms where code = p_code;
  if not found then
    raise exception 'room % not found', p_code;
  end if;

  for v_area in
    with
      days as (select d.value as v from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end) d),
      events as (
        select private.json_text(d.v -> 'id') as day_id, e.value as v
        from days d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.v -> 'events') = 'array' then d.v -> 'events' else '[]'::jsonb end) e
      ),
      spans as (
        select s.value as v
        from days d cross join lateral jsonb_array_elements(case when jsonb_typeof(d.v -> 'spans') = 'array' then d.v -> 'spans' else '[]'::jsonb end) s
      ),
      arr as (
        select k, case when jsonb_typeof(p -> k) = 'array' then p -> k else '[]'::jsonb end as a
        from unnest(array['extras', 'tripSpans', 'tasks', 'mockPeople']) k
      ),
      tasks as (select t.value as v from arr, jsonb_array_elements(arr.a) t where arr.k = 'tasks'),
      options as (
        select o.value as v
        from tasks t cross join lateral jsonb_array_elements(case when jsonb_typeof(t.v -> 'options') = 'array' then t.v -> 'options' else '[]'::jsonb end) o
      )
    select 'days' as area, (select count(*) from days) as expected,
           (select count(*) from public.trip_days where room_code = p_code) as actual
    union all select 'events', (select count(*) from events),
           (select count(*) from public.trip_events where room_code = p_code)
    union all select 'daySpans', (select count(*) from spans),
           (select count(*) from public.trip_day_spans where room_code = p_code)
    union all select 'tripSpans', (select jsonb_array_length(a) from arr where k = 'tripSpans'),
           (select count(*) from public.trip_spans where room_code = p_code)
    union all select 'expenses', (select jsonb_array_length(a) from arr where k = 'extras'),
           (select count(*) from public.trip_expenses where room_code = p_code)
    union all select 'tasks', (select count(*) from tasks),
           (select count(*) from public.trip_tasks where room_code = p_code)
    union all select 'options', (select count(*) from options),
           (select count(*) from public.trip_task_options where room_code = p_code)
    union all select 'travelers', (select jsonb_array_length(a) from arr where k = 'mockPeople'),
           (select count(*) from public.trip_travelers where room_code = p_code)
  loop
    if v_area.expected is distinct from v_area.actual then
      v_diffs := v_diffs || jsonb_build_object('area', v_area.area, 'expected', v_area.expected, 'actual', v_area.actual);
    end if;
  end loop;

  -- Events per day
  for v_area in
    with
      expected as (
        select private.json_text(d.value -> 'id') as day_id,
               jsonb_array_length(case when jsonb_typeof(d.value -> 'events') = 'array' then d.value -> 'events' else '[]'::jsonb end) as n
        from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end) d
      ),
      actual as (
        select day_id, count(*) as n from public.trip_events where room_code = p_code group by day_id
      )
    select coalesce(e.day_id, a.day_id) as day_id, coalesce(e.n, 0) as expected, coalesce(a.n, 0) as actual
    from expected e full join actual a on a.day_id = e.day_id
    where coalesce(e.n, 0) <> coalesce(a.n, 0)
  loop
    v_diffs := v_diffs || jsonb_build_object('area', 'eventsPerDay', 'day', v_area.day_id,
                                             'expected', v_area.expected, 'actual', v_area.actual);
  end loop;

  -- Expense total in USD
  for v_area in
    select
      (select round(coalesce(sum(case
                when x.value ->> 'currency' = 'COP' then round(private.json_num(x.value -> 'amount'), 2) / nullif(private.json_num(p -> 'exchangeRate'), 0)
                else round(private.json_num(x.value -> 'amount'), 2) end), 0), 2)
       from jsonb_array_elements(case when jsonb_typeof(p -> 'extras') = 'array' then p -> 'extras' else '[]'::jsonb end) x) as expected,
      (select round(coalesce(sum(case
                when currency = 'COP' then amount / nullif(v_rate, 0)
                else amount end), 0), 2)
       from public.trip_expenses where room_code = p_code) as actual
  loop
    if v_area.expected is distinct from v_area.actual then
      v_diffs := v_diffs || jsonb_build_object('area', 'expensesUSD', 'expected', v_area.expected, 'actual', v_area.actual);
    end if;
  end loop;

  return v_diffs;
end;
$$;

create or replace function private.verify_all_rooms()
returns table (room_code text, differences jsonb)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_code text;
begin
  for v_code in select code from public.rooms order by code loop
    room_code := v_code;
    differences := private.verify_room(v_code);
    return next;
  end loop;
end;
$$;

-- Rollback: writes the tables back into rooms.payload (and keeps rooms.name in
-- sync with trip.name, as the old save path did).
create or replace function private.rebuild_payload(p_code text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  perform 1 from public.rooms where code = p_code for update;
  if not found then
    raise exception 'room % not found', p_code;
  end if;

  v_payload := private.trip_payload(p_code);
  update public.rooms
  set payload = v_payload,
      name = coalesce(v_payload -> 'trip' ->> 'name', name)
  where code = p_code;
  return v_payload;
end;
$$;

revoke all on function private.trip_payload(text) from public, anon, authenticated;
revoke all on function private.verify_room(text) from public, anon, authenticated;
revoke all on function private.verify_all_rooms() from public, anon, authenticated;
revoke all on function private.rebuild_payload(text) from public, anon, authenticated;
