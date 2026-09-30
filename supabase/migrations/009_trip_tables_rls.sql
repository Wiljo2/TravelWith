-- Access control for the trip tables (docs/plans/relational-broadcast.md,
-- step 1.2). Route handlers use the service role, which bypasses RLS and is the
-- only writer; these rules are defense in depth for the anon key and signed-in
-- browser clients.
--
-- Each trip table gets RLS plus a restrictive member-only policy. There is no
-- permissive policy yet, so clients see no rows at all; if direct reads are
-- ever needed, a permissive select policy can be added and the restrictive one
-- still limits it to members. Clients never write: insert/update/delete are
-- revoked from anon and authenticated, and anon loses select too.
--
-- trip_changes is server-only history: RLS with no policies and no grants,
-- like agent_usage.

alter table public.trip_days enable row level security;

drop policy if exists "members only" on public.trip_days;
create policy "members only" on public.trip_days
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_days.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_days.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_days from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_days from authenticated;

alter table public.trip_events enable row level security;

drop policy if exists "members only" on public.trip_events;
create policy "members only" on public.trip_events
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_events.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_events.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_events from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_events from authenticated;

alter table public.trip_day_spans enable row level security;

drop policy if exists "members only" on public.trip_day_spans;
create policy "members only" on public.trip_day_spans
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_day_spans.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_day_spans.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_day_spans from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_day_spans from authenticated;

alter table public.trip_spans enable row level security;

drop policy if exists "members only" on public.trip_spans;
create policy "members only" on public.trip_spans
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_spans.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_spans.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_spans from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_spans from authenticated;

alter table public.trip_expenses enable row level security;

drop policy if exists "members only" on public.trip_expenses;
create policy "members only" on public.trip_expenses
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_expenses.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_expenses.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_expenses from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_expenses from authenticated;

alter table public.trip_tasks enable row level security;

drop policy if exists "members only" on public.trip_tasks;
create policy "members only" on public.trip_tasks
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_tasks.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_tasks.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_tasks from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_tasks from authenticated;

alter table public.trip_task_options enable row level security;

drop policy if exists "members only" on public.trip_task_options;
create policy "members only" on public.trip_task_options
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_task_options.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_task_options.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_task_options from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_task_options from authenticated;

alter table public.trip_travelers enable row level security;

drop policy if exists "members only" on public.trip_travelers;
create policy "members only" on public.trip_travelers
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_travelers.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_travelers.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_travelers from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_travelers from authenticated;

alter table public.trip_changes enable row level security;
revoke all on table public.trip_changes from anon, authenticated;
