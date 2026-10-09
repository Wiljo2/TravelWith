-- Task ops (docs/plans/relational-broadcast.md, step 3.6). Called only by the
-- API with the service role, after requireMember.

-- swap_days also moves the tasks scheduled on the two days, as the client
-- always did (replaces the 015 body; same signature and grants).
create or replace function public.swap_days(p_code text, p_a text, p_b text, p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_events jsonb;
  v_spans  jsonb;
  v_tasks  jsonb;
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

  with moved as (
    update public.trip_tasks
    set day_id = case when day_id = p_a then p_b else p_a end, updated_by = p_user
    where room_code = p_code and day_id in (p_a, p_b)
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(moved)), '[]'::jsonb) into v_tasks from moved;

  return jsonb_build_object('events', v_events, 'daySpans', v_spans, 'tasks', v_tasks);
end;
$$;

-- Confirms a task by one of its options, atomically: inserts the calendar
-- event (when the task is scheduled) and the expense (when the option has a
-- cost), both built and validated by the API, then deletes the task and its
-- options. p_expected_version guards the task (null = no guard). Returns
-- {event, expense, task} (event/expense null when not created), or
-- {conflict: true, current: <task or null>} when the task changed or is gone.
create or replace function public.choose_task_option(
  p_code             text,
  p_task_id          text,
  p_expected_version int,
  p_event            jsonb,
  p_expense          jsonb,
  p_user             uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_task    public.trip_tasks;
  v_event   public.trip_events;
  v_expense public.trip_expenses;
begin
  select * into v_task from public.trip_tasks
  where room_code = p_code and id = p_task_id
  for update;
  if not found or (p_expected_version is not null and v_task.version <> p_expected_version) then
    return jsonb_build_object('conflict', true, 'current', case when found then to_jsonb(v_task) end);
  end if;

  if p_event is not null then
    insert into public.trip_events (room_code, id, day_id, position, start_hour, end_hour, title, cat, note, updated_by)
    values (
      p_code, p_event ->> 'id', p_event ->> 'day_id',
      coalesce((select max(position) + 1 from public.trip_events where room_code = p_code and day_id = p_event ->> 'day_id'), 0),
      (p_event ->> 'start_hour')::numeric, (p_event ->> 'end_hour')::numeric,
      p_event ->> 'title', p_event ->> 'cat', p_event ->> 'note', p_user
    )
    returning * into v_event;
  end if;

  if p_expense is not null then
    insert into public.trip_expenses (room_code, id, position, label, amount, currency, split_mode, linked_event_id, updated_by)
    values (
      p_code, p_expense ->> 'id',
      coalesce((select max(position) + 1 from public.trip_expenses where room_code = p_code), 0),
      p_expense ->> 'label', (p_expense ->> 'amount')::numeric, p_expense ->> 'currency', p_expense ->> 'split_mode',
      v_event.id, p_user
    )
    returning * into v_expense;
  end if;

  perform set_config('app.user_id', coalesce(p_user::text, ''), true);
  delete from public.trip_tasks where room_code = p_code and id = p_task_id;
  perform set_config('app.user_id', '', true);

  return jsonb_build_object(
    'event', case when v_event.id is not null then to_jsonb(v_event) end,
    'expense', case when v_expense.id is not null then to_jsonb(v_expense) end,
    'task', to_jsonb(v_task)
  );
end;
$$;

revoke all on function public.choose_task_option(text, text, int, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.choose_task_option(text, text, int, jsonb, jsonb, uuid) to service_role;
