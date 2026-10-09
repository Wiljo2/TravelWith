-- Optional emoji icon on calendar events and tasks (ux-wave step I.2).
-- null = automatic (derived from the title on the client). Cosmetic only:
-- private.trip_payload / rebuild_payload are intentionally NOT changed, so an
-- icon is lost on a payload rollback; that is acceptable.

alter table public.trip_events add column if not exists icon text;
alter table public.trip_tasks add column if not exists icon text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trip_events_icon_length') then
    alter table public.trip_events add constraint trip_events_icon_length
      check (icon is null or char_length(icon) between 1 and 16);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trip_tasks_icon_length') then
    alter table public.trip_tasks add constraint trip_tasks_icon_length
      check (icon is null or char_length(icon) between 1 and 16);
  end if;
end $$;

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
          'start', t.start_hour, 'end', t.end_hour, 'cat', t.cat, 'priority', t.priority, 'icon', t.icon, 'version', t.version,
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
