-- Trip read in one round trip (docs/plans/relational-broadcast.md, step 3.2).
-- Returns {code, payload, members, updated_at} with payload in the RoomPayload
-- shape the client already uses, assembled from the trip tables (never from
-- the frozen rooms.payload). Every item carries its row version for the
-- client's optimistic writes. Called only by the API with the service role,
-- after requireMember. Returns null when the room does not exist.
--
-- Optional fields that are null are omitted; exchangeRate is omitted when the
-- room has none, and the API applies the default at read time.

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
              'note', e.note, 'version', e.version
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
          'version', x.version
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
          'start', t.start_hour, 'end', t.end_hour, 'cat', t.cat, 'priority', t.priority, 'version', t.version,
          'options', (
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'id', o.id, 'label', o.label, 'note', o.note, 'amount', o.amount,
              'currency', o.currency, 'splitMode', o.split_mode, 'version', o.version
            )) order by o.position, o.id)
            from public.trip_task_options o where o.room_code = t.room_code and o.task_id = t.id
          )
        )) order by t.position, t.id)
        from public.trip_tasks t where t.room_code = r.code
      ), '[]'::jsonb),
      'mockPeople', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'version', m.version) order by m.position, m.id)
        from public.trip_travelers m where m.room_code = r.code
      ), '[]'::jsonb)
    )
    || case when r.exchange_rate is not null
         then jsonb_build_object('exchangeRate', r.exchange_rate) else '{}'::jsonb end
    || case when r.start_date is not null and r.end_date is not null
         then jsonb_build_object('trip', jsonb_strip_nulls(jsonb_build_object(
           'name', coalesce(r.name, ''),
           'destination', r.destination,
           'startDate', to_char(r.start_date, 'YYYY-MM-DD'),
           'endDate', to_char(r.end_date, 'YYYY-MM-DD')
         )))
         else '{}'::jsonb end
  )
  from public.rooms r
  where r.code = p_code
$$;

revoke all on function public.get_trip(text) from public, anon, authenticated;
grant execute on function public.get_trip(text) to service_role;
