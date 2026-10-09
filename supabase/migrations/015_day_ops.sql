-- Multi-row day ops as single transactions (docs/plans/relational-broadcast.md,
-- step 3.4). Called only by the API with the service role, after
-- requireMember (reset_itinerary: owner only, checked by the API).

-- Swaps the contents (events and day spans) of two days of one trip; each day
-- keeps its own label and date. Event ids don't change, so trip spans and
-- linked expenses keep pointing at the same events. Returns the moved rows.
create or replace function public.swap_days(p_code text, p_a text, p_b text, p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_events jsonb;
  v_spans  jsonb;
begin
  if p_a = p_b then
    raise exception 'cannot swap a day with itself' using errcode = '22023';
  end if;
  perform 1 from public.trip_days
  where room_code = p_code and id in (p_a, p_b)
  for update;
  if (select count(*) from public.trip_days where room_code = p_code and id in (p_a, p_b)) <> 2 then
    raise exception 'day not found' using errcode = 'P0002';
  end if;

  with moved as (
    update public.trip_events
    set day_id = case when day_id = p_a then p_b else p_a end, updated_by = p_user
    where room_code = p_code and day_id in (p_a, p_b)
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(moved)), '[]'::jsonb) into v_events from moved;

  with moved as (
    update public.trip_day_spans
    set day_id = case when day_id = p_a then p_b else p_a end, updated_by = p_user
    where room_code = p_code and day_id in (p_a, p_b)
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(moved)), '[]'::jsonb) into v_spans from moved;

  return jsonb_build_object('events', v_events, 'daySpans', v_spans);
end;
$$;

-- Clears the calendar: deletes every event, day span and trip span, and
-- replaces the days with p_days ([{id, label, sub, flexible}], in order, built
-- by the API from the trip dates). Days that disappear release their expenses
-- and tasks (foreign keys set null); days that stay keep their ids. Deletes are
-- attributed to p_user through app.user_id. Returns the resulting days.
create or replace function public.reset_itinerary(p_code text, p_days jsonb, p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_days jsonb;
begin
  if jsonb_typeof(p_days) <> 'array' then
    raise exception 'p_days must be an array' using errcode = '22023';
  end if;
  perform 1 from public.rooms where code = p_code for update;
  if not found then
    raise exception 'room not found' using errcode = 'P0002';
  end if;

  perform set_config('app.user_id', coalesce(p_user::text, ''), true);

  delete from public.trip_spans where room_code = p_code;
  delete from public.trip_day_spans where room_code = p_code;
  delete from public.trip_events where room_code = p_code;
  delete from public.trip_days d
  where d.room_code = p_code
    and not exists (select 1 from jsonb_array_elements(p_days) n where n ->> 'id' = d.id);

  insert into public.trip_days (room_code, id, position, label, sub, flexible, updated_by)
  select p_code, n.value ->> 'id', (n.ord - 1)::int, n.value ->> 'label', n.value ->> 'sub',
         (n.value ->> 'flexible')::boolean, p_user
  from jsonb_array_elements(p_days) with ordinality as n(value, ord)
  on conflict (room_code, id) do update
  set position = excluded.position,
      label = excluded.label,
      sub = excluded.sub,
      flexible = excluded.flexible,
      updated_by = excluded.updated_by;

  perform set_config('app.user_id', '', true);

  select coalesce(jsonb_agg(to_jsonb(d) order by d.position, d.id), '[]'::jsonb) into v_days
  from public.trip_days d where d.room_code = p_code;
  return jsonb_build_object('days', v_days);
end;
$$;

revoke all on function public.swap_days(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.reset_itinerary(text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.swap_days(text, text, text, uuid) to service_role;
grant execute on function public.reset_itinerary(text, jsonb, uuid) to service_role;
