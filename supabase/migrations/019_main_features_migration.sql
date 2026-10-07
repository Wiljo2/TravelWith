-- The cut-over functions learn the data from 018
-- (docs/plans/relational-broadcast.md, step 3.14b): migrate_room also moves
-- documents, ideas, map places, the idea settings and the activity / expense
-- links to them; verify_room compares them; trip_payload (rollback) and
-- get_trip (reads) return them.
--
-- migrate_room and verify_room keep their 011 / 012 bodies under a new name
-- and are wrapped, so the new parts stay separate; trip_payload and get_trip
-- are replaced whole because the new activity and expense fields sit inside
-- their nested arrays.

alter function private.migrate_room(text) rename to migrate_room_base;
alter function private.verify_room(text) rename to verify_room_base;

create or replace function private.migrate_room_extras(p_code text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  p         jsonb;
  r         record;
  v_skipped jsonb := '[]'::jsonb;
  v_nulled  jsonb := '[]'::jsonb;
  v_url     text;
  v_doc     text;
  v_plan    jsonb;
begin
  select coalesce(payload, '{}'::jsonb) into p from public.rooms where code = p_code for update;
  if not found then
    raise exception 'room % not found', p_code;
  end if;

  perform set_config('app.bulk_load', 'on', true);

  delete from public.trip_ideas where room_code = p_code;
  delete from public.trip_event_places where room_code = p_code;
  delete from public.trip_documents where room_code = p_code;

  -- Idea settings: the place list and the last analysis, under their payload keys.
  select jsonb_object_agg(key, value) into v_plan
  from jsonb_each(p) where key in ('ideaLinks', 'ideaLinksAt', 'ideaLinksIds');
  begin
    update public.rooms
    set idea_places = case when jsonb_typeof(p -> 'ideaPlaces') = 'array' then p -> 'ideaPlaces' end,
        idea_plan = v_plan
    where code = p_code;
  exception when others then
    v_skipped := v_skipped || jsonb_build_object('table', 'rooms', 'id', p_code, 'error', sqlerrm);
  end;

  -- Documents
  for r in
    select x.value as v, x.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'documents') = 'array' then p -> 'documents' else '[]'::jsonb end)
      with ordinality as x(value, ord)
  loop
    begin
      insert into public.trip_documents (room_code, id, position, drive_file_id, title, kind)
      values (p_code, private.json_text(r.v -> 'id'), r.pos, private.json_text(r.v -> 'driveFileId'),
              private.json_text(r.v -> 'title'),
              case when r.v ->> 'kind' in ('flight', 'lodging', 'insurance', 'ticket', 'other') then r.v ->> 'kind' end);
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_documents', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Ideas: everything but the id goes into data
  for r in
    select x.value as v, x.ord - 1 as pos
    from jsonb_array_elements(case when jsonb_typeof(p -> 'ideas') = 'array' then p -> 'ideas' else '[]'::jsonb end)
      with ordinality as x(value, ord)
  loop
    begin
      insert into public.trip_ideas (room_code, id, position, data)
      values (p_code, private.json_text(r.v -> 'id'), r.pos,
              case when jsonb_typeof(r.v) = 'object' then r.v - 'id' end);
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_ideas', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Activity fields: Maps link (https only) and document
  for r in
    select e.value as v
    from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end) as d(value)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value -> 'events') = 'array' then d.value -> 'events' else '[]'::jsonb end) as e(value)
    where e.value ? 'mapsUrl' or e.value ? 'documentId'
  loop
    v_url := private.json_text(r.v -> 'mapsUrl');
    if v_url is not null and (v_url !~ '^https://' or char_length(v_url) > 4000) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_events', 'id', r.v -> 'id', 'field', 'maps_url');
      v_url := null;
    end if;
    v_doc := private.json_text(r.v -> 'documentId');
    if v_doc is not null and not exists (select 1 from public.trip_documents where room_code = p_code and id = v_doc) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_events', 'id', r.v -> 'id', 'field', 'document_id');
      v_doc := null;
    end if;
    begin
      update public.trip_events set maps_url = v_url, document_id = v_doc
      where room_code = p_code and id = private.json_text(r.v -> 'id');
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_events', 'id', r.v -> 'id', 'error', sqlerrm);
    end;
  end loop;

  -- Expense documents
  for r in
    select x.value as v
    from jsonb_array_elements(case when jsonb_typeof(p -> 'extras') = 'array' then p -> 'extras' else '[]'::jsonb end) as x(value)
    where x.value ? 'documentId'
  loop
    v_doc := private.json_text(r.v -> 'documentId');
    if v_doc is not null and not exists (select 1 from public.trip_documents where room_code = p_code and id = v_doc) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_expenses', 'id', r.v -> 'id', 'field', 'document_id');
      v_doc := null;
    end if;
    update public.trip_expenses set document_id = v_doc
    where room_code = p_code and id = private.json_text(r.v -> 'id');
  end loop;

  -- Map places, by activity id; places of activities that no longer exist are dropped
  for r in
    select x.key as id, x.value as v
    from jsonb_each(case when jsonb_typeof(p -> 'eventPlaces') = 'object' then p -> 'eventPlaces' else '{}'::jsonb end) as x(key, value)
  loop
    if not exists (select 1 from public.trip_events where room_code = p_code and id = r.id) then
      v_nulled := v_nulled || jsonb_build_object('table', 'trip_event_places', 'id', r.id, 'field', 'event');
      continue;
    end if;
    begin
      insert into public.trip_event_places (room_code, id, data) values (p_code, r.id, r.v);
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('table', 'trip_event_places', 'id', r.id, 'error', sqlerrm);
    end;
  end loop;

  perform set_config('app.bulk_load', 'off', true);

  return jsonb_build_object(
    'documents', (select count(*) from public.trip_documents where room_code = p_code),
    'ideas', (select count(*) from public.trip_ideas where room_code = p_code),
    'eventPlaces', (select count(*) from public.trip_event_places where room_code = p_code),
    'skipped', v_skipped,
    'nulled', v_nulled
  );
end;
$$;

create or replace function private.migrate_room(p_code text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_base  jsonb;
  v_extra jsonb;
begin
  v_base := private.migrate_room_base(p_code);
  v_extra := private.migrate_room_extras(p_code);
  return v_base
    || (v_extra - 'skipped' - 'nulled')
    || jsonb_build_object(
      'skipped', (v_base -> 'skipped') || (v_extra -> 'skipped'),
      'nulled', (v_base -> 'nulled') || (v_extra -> 'nulled')
    );
end;
$$;

-- Comparison of the new areas; same shape as verify_room_base's entries.
create or replace function private.verify_room(p_code text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  p       jsonb;
  v_diffs jsonb;
  v_area  record;
  v_rooms record;
begin
  v_diffs := private.verify_room_base(p_code);
  select coalesce(payload, '{}'::jsonb) as payload, idea_places, idea_plan into v_rooms from public.rooms where code = p_code;
  p := v_rooms.payload;

  for v_area in
    with
      events as (
        select e.value as v
        from jsonb_array_elements(case when jsonb_typeof(p -> 'days') = 'array' then p -> 'days' else '[]'::jsonb end) as d(value)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(d.value -> 'events') = 'array' then d.value -> 'events' else '[]'::jsonb end) as e(value)
      ),
      extras as (
        select x.value as v
        from jsonb_array_elements(case when jsonb_typeof(p -> 'extras') = 'array' then p -> 'extras' else '[]'::jsonb end) as x(value)
      )
    select 'documents' as area,
           jsonb_array_length(case when jsonb_typeof(p -> 'documents') = 'array' then p -> 'documents' else '[]'::jsonb end)::bigint as expected,
           (select count(*) from public.trip_documents where room_code = p_code) as actual
    union all select 'ideas',
           jsonb_array_length(case when jsonb_typeof(p -> 'ideas') = 'array' then p -> 'ideas' else '[]'::jsonb end)::bigint,
           (select count(*) from public.trip_ideas where room_code = p_code)
    union all select 'eventPlaces',
           (select count(*) from jsonb_object_keys(case when jsonb_typeof(p -> 'eventPlaces') = 'object' then p -> 'eventPlaces' else '{}'::jsonb end) k
            where exists (select 1 from public.trip_events e where e.room_code = p_code and e.id = k)),
           (select count(*) from public.trip_event_places where room_code = p_code)
    union all select 'eventMapsUrls',
           (select count(*) from events where private.json_text(v -> 'mapsUrl') is not null),
           (select count(*) from public.trip_events where room_code = p_code and maps_url is not null)
    union all select 'eventDocuments',
           (select count(*) from events where private.json_text(v -> 'documentId') is not null),
           (select count(*) from public.trip_events where room_code = p_code and document_id is not null)
    union all select 'expenseDocuments',
           (select count(*) from extras where private.json_text(v -> 'documentId') is not null),
           (select count(*) from public.trip_expenses where room_code = p_code and document_id is not null)
  loop
    if v_area.expected is distinct from v_area.actual then
      v_diffs := v_diffs || jsonb_build_object('area', v_area.area, 'expected', v_area.expected, 'actual', v_area.actual);
    end if;
  end loop;

  if (case when jsonb_typeof(p -> 'ideaPlaces') = 'array' then p -> 'ideaPlaces' end) is distinct from v_rooms.idea_places then
    v_diffs := v_diffs || jsonb_build_object('area', 'ideaPlaces');
  end if;
  if (select jsonb_object_agg(key, value) from jsonb_each(p) where key in ('ideaLinks', 'ideaLinksAt', 'ideaLinksIds'))
     is distinct from v_rooms.idea_plan then
    v_diffs := v_diffs || jsonb_build_object('area', 'ideaPlan');
  end if;

  return v_diffs;
end;
$$;

create or replace function private.trip_payload(p_code text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select
    (coalesce(r.payload, '{}'::jsonb) - 'ideaPlaces' - 'ideaLinks' - 'ideaLinksAt' - 'ideaLinksIds')
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
              'id', e.id, 'start', e.start_hour, 'end', e.end_hour, 'title', e.title, 'cat', e.cat, 'note', e.note,
              'mapsUrl', e.maps_url, 'documentId', e.document_id
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
          'documentId', x.document_id
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
      ), '[]'::jsonb),
      'documents', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', x.id, 'driveFileId', x.drive_file_id, 'title', x.title, 'kind', x.kind
        )) order by x.position, x.id)
        from public.trip_documents x where x.room_code = r.code
      ), '[]'::jsonb),
      'ideas', coalesce((
        select jsonb_agg(i.data || jsonb_build_object('id', i.id) order by i.position, i.id)
        from public.trip_ideas i where i.room_code = r.code
      ), '[]'::jsonb),
      'eventPlaces', coalesce((
        select jsonb_object_agg(pl.id, pl.data)
        from public.trip_event_places pl where pl.room_code = r.code
      ), '{}'::jsonb)
    )
    || coalesce(r.idea_plan, '{}'::jsonb)
    || case when r.idea_places is not null then jsonb_build_object('ideaPlaces', r.idea_places) else '{}'::jsonb end
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
              'note', e.note, 'mapsUrl', e.maps_url, 'documentId', e.document_id, 'version', e.version
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

revoke all on function private.migrate_room_extras(text) from public, anon, authenticated;
revoke all on function private.migrate_room(text) from public, anon, authenticated;
revoke all on function private.verify_room(text) from public, anon, authenticated;
