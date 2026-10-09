-- Row-level write support for the repository layer
-- (docs/plans/relational-broadcast.md, step 3.1).

-- Every effective update bumps version and updated_at, including updates the
-- API does not write itself (foreign-key "on delete set null" cascades), so
-- clients never ignore a changed row because its version looks known. Writers
-- that already set version = old + 1 (the repository's guarded updates) keep
-- their value.
create or replace function private.bump_trip_row_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new is not distinct from old then
    return new;
  end if;
  if new.version = old.version then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.bump_trip_row_version() from public, anon, authenticated;

drop trigger if exists trip_days_bump_version on public.trip_days;
create trigger trip_days_bump_version
  before update on public.trip_days
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_events_bump_version on public.trip_events;
create trigger trip_events_bump_version
  before update on public.trip_events
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_day_spans_bump_version on public.trip_day_spans;
create trigger trip_day_spans_bump_version
  before update on public.trip_day_spans
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_spans_bump_version on public.trip_spans;
create trigger trip_spans_bump_version
  before update on public.trip_spans
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_expenses_bump_version on public.trip_expenses;
create trigger trip_expenses_bump_version
  before update on public.trip_expenses
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_tasks_bump_version on public.trip_tasks;
create trigger trip_tasks_bump_version
  before update on public.trip_tasks
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_task_options_bump_version on public.trip_task_options;
create trigger trip_task_options_bump_version
  before update on public.trip_task_options
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_travelers_bump_version on public.trip_travelers;
create trigger trip_travelers_bump_version
  before update on public.trip_travelers
  for each row execute function private.bump_trip_row_version();

-- Version-guarded delete. Deleted rows carry no
-- updated_by, so the acting user reaches the audit trigger through the
-- transaction-local app.user_id setting, which needs a SQL function around the
-- delete. Called only by the API with the service role.
--
-- Returns {"deleted": <row>} on success, or {"deleted": null, "current": <row
-- or null>} when the row changed since p_expected_version or no longer exists.
-- A null p_expected_version deletes without the guard.

create or replace function public.delete_trip_row(
  p_table            text,
  p_code             text,
  p_id               text,
  p_expected_version int,
  p_user             uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_deleted jsonb;
  v_current jsonb;
begin
  if p_table not in ('trip_days', 'trip_events', 'trip_day_spans', 'trip_spans',
                     'trip_expenses', 'trip_tasks', 'trip_task_options', 'trip_travelers') then
    raise exception 'unknown trip table %', p_table;
  end if;

  perform set_config('app.user_id', coalesce(p_user::text, ''), true);

  execute format(
    'delete from public.%I t where t.room_code = $1 and t.id = $2 and ($3 is null or t.version = $3) returning to_jsonb(t)',
    p_table
  ) into v_deleted using p_code, p_id, p_expected_version;

  perform set_config('app.user_id', '', true);

  if v_deleted is not null then
    return jsonb_build_object('deleted', v_deleted);
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.room_code = $1 and t.id = $2', p_table)
    into v_current using p_code, p_id;
  return jsonb_build_object('deleted', null, 'current', v_current);
end;
$$;

revoke all on function public.delete_trip_row(text, text, text, int, uuid) from public, anon, authenticated;
grant execute on function public.delete_trip_row(text, text, text, int, uuid) to service_role;
