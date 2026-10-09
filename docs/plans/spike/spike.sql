-- Phase 0 spike: one trip-like table broadcasting row changes on a private
-- channel per trip. STAGING ONLY. Not a migration: run it by hand in the SQL
-- editor of a staging project that already has migrations 001-007 applied.
-- Remove everything with teardown.sql.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.spike_events (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null,
  title      text not null check (char_length(title) between 1 and 200),
  start_hour numeric(5,2) not null default 9,
  version    int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (room_code, id)
);

alter table public.spike_events enable row level security;

drop policy if exists "spike members only" on public.spike_events;
create policy "spike members only" on public.spike_events
  as restrictive for all
  to authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = spike_events.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = spike_events.room_code and ur.user_id = (select auth.uid())
  ));

create or replace function private.spike_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke all on function private.spike_broadcast_change() from public, anon, authenticated;

drop trigger if exists spike_events_broadcast on public.spike_events;
create trigger spike_events_broadcast
  after insert or update or delete on public.spike_events
  for each row execute function private.spike_broadcast_change();

drop policy if exists "spike members receive trip broadcasts" on realtime.messages;
create policy "spike members receive trip broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.user_rooms ur
      where ur.user_id = (select auth.uid())
        and 'trip:' || ur.room_code = (select realtime.topic())
    )
  );
