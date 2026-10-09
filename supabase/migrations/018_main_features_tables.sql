-- Storage for the data main added while the relational branch was open
-- (docs/plans/relational-broadcast.md, step 3.14): ideas, the idea analysis,
-- trip map places, Drive documents, and the activity / expense fields that
-- point at them. Same rules as 008-013: composite (room_code, id) keys, row
-- versions, RLS member-only, audit + Broadcast + version-bump triggers.
--
-- Ideas are stored as one jsonb document per idea: main keeps adding optional
-- idea fields, and none of them is referenced by other rows. Map places hang
-- off their activity (id = event id) so locating an activity never bumps the
-- event's own version. The idea place list and the last "Analizar con Claude"
-- result are trip-wide settings on rooms, last write wins like the header.

alter table public.rooms add column if not exists idea_places jsonb;
alter table public.rooms add column if not exists idea_plan jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_idea_places_array') then
    alter table public.rooms add constraint rooms_idea_places_array
      check (idea_places is null or jsonb_typeof(idea_places) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_idea_plan_object') then
    alter table public.rooms add constraint rooms_idea_plan_object
      check (idea_plan is null or (jsonb_typeof(idea_plan) = 'object' and octet_length(idea_plan::text) <= 262144));
  end if;
end $$;

-- Drive documents: payload.documents[]. Only the Drive file id and a short title.
create table if not exists public.trip_documents (
  room_code     text not null references public.rooms (code) on delete cascade,
  id            text not null check (char_length(id) between 1 and 100),
  position      int not null default 0,
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,100}$'),
  title         text not null check (char_length(title) between 1 and 120),
  kind          text check (kind in ('flight', 'lodging', 'insurance', 'ticket', 'other')),
  version       int not null default 1 check (version > 0),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  primary key (room_code, id)
);

-- Ideas: payload.ideas[]. data holds the idea without its id.
create table if not exists public.trip_ideas (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  position   int not null default 0,
  data       jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536),
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id)
);

-- Trip map: payload.eventPlaces[eventId]. id is the activity's id.
create table if not exists public.trip_event_places (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 8192),
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, id) references public.trip_events (room_code, id) on delete cascade
);

alter table public.trip_events add column if not exists maps_url text;
alter table public.trip_events add column if not exists document_id text;
alter table public.trip_expenses add column if not exists document_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trip_events_maps_url_https') then
    alter table public.trip_events add constraint trip_events_maps_url_https
      check (maps_url is null or (maps_url ~ '^https://' and char_length(maps_url) <= 4000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trip_events_document_fkey') then
    alter table public.trip_events add constraint trip_events_document_fkey
      foreign key (room_code, document_id) references public.trip_documents (room_code, id)
      on delete set null (document_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trip_expenses_document_fkey') then
    alter table public.trip_expenses add constraint trip_expenses_document_fkey
      foreign key (room_code, document_id) references public.trip_documents (room_code, id)
      on delete set null (document_id);
  end if;
end $$;

create index if not exists trip_documents_updated_by_idx on public.trip_documents (updated_by);
create index if not exists trip_ideas_updated_by_idx on public.trip_ideas (updated_by);
create index if not exists trip_event_places_updated_by_idx on public.trip_event_places (updated_by);
create index if not exists trip_events_document_idx on public.trip_events (room_code, document_id);
create index if not exists trip_expenses_document_idx on public.trip_expenses (room_code, document_id);

-- Access control, as in 009.
alter table public.trip_documents enable row level security;

drop policy if exists "members only" on public.trip_documents;
create policy "members only" on public.trip_documents
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_documents.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_documents.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_documents from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_documents from authenticated;

alter table public.trip_ideas enable row level security;

drop policy if exists "members only" on public.trip_ideas;
create policy "members only" on public.trip_ideas
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_ideas.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_ideas.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_ideas from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_ideas from authenticated;

alter table public.trip_event_places enable row level security;

drop policy if exists "members only" on public.trip_event_places;
create policy "members only" on public.trip_event_places
  as restrictive for all
  to anon, authenticated
  using (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_event_places.room_code and ur.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.user_rooms ur
    where ur.room_code = trip_event_places.room_code and ur.user_id = (select auth.uid())
  ));

revoke all on table public.trip_event_places from anon;
revoke insert, update, delete, truncate, references, trigger on table public.trip_event_places from authenticated;

-- History, Broadcast and version bumps, as in 010 and 013.
drop trigger if exists trip_documents_audit on public.trip_documents;
create trigger trip_documents_audit
  after insert or update or delete on public.trip_documents
  for each row execute function private.record_trip_change();

drop trigger if exists trip_documents_broadcast on public.trip_documents;
create trigger trip_documents_broadcast
  after insert or update or delete on public.trip_documents
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_documents_bump_version on public.trip_documents;
create trigger trip_documents_bump_version
  before update on public.trip_documents
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_ideas_audit on public.trip_ideas;
create trigger trip_ideas_audit
  after insert or update or delete on public.trip_ideas
  for each row execute function private.record_trip_change();

drop trigger if exists trip_ideas_broadcast on public.trip_ideas;
create trigger trip_ideas_broadcast
  after insert or update or delete on public.trip_ideas
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_ideas_bump_version on public.trip_ideas;
create trigger trip_ideas_bump_version
  before update on public.trip_ideas
  for each row execute function private.bump_trip_row_version();

drop trigger if exists trip_event_places_audit on public.trip_event_places;
create trigger trip_event_places_audit
  after insert or update or delete on public.trip_event_places
  for each row execute function private.record_trip_change();

drop trigger if exists trip_event_places_broadcast on public.trip_event_places;
create trigger trip_event_places_broadcast
  after insert or update or delete on public.trip_event_places
  for each row execute function private.broadcast_trip_change();

drop trigger if exists trip_event_places_bump_version on public.trip_event_places;
create trigger trip_event_places_bump_version
  before update on public.trip_event_places
  for each row execute function private.bump_trip_row_version();

-- delete_trip_row (013) also serves the new tables; same signature and grants.
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
                     'trip_expenses', 'trip_tasks', 'trip_task_options', 'trip_travelers',
                     'trip_documents', 'trip_ideas', 'trip_event_places') then
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

-- The rooms broadcast (016) also carries the idea settings; payload never.
create or replace function private.broadcast_room_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.bulk_load', true) = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform realtime.send(
      jsonb_build_object('operation', 'DELETE', 'table', 'rooms', 'schema', 'public',
                         'record', null, 'old_record', jsonb_build_object('code', old.code)),
      'DELETE',
      'trip:' || old.code,
      true
    );
    return null;
  end if;

  if (new.name, new.destination, new.start_date, new.end_date, new.exchange_rate, new.members,
      new.idea_places, new.idea_plan)
     is not distinct from
     (old.name, old.destination, old.start_date, old.end_date, old.exchange_rate, old.members,
      old.idea_places, old.idea_plan) then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'operation', 'UPDATE', 'table', 'rooms', 'schema', 'public', 'old_record', null,
      'record', jsonb_build_object(
        'code', new.code, 'name', new.name, 'destination', new.destination,
        'start_date', new.start_date, 'end_date', new.end_date,
        'exchange_rate', new.exchange_rate, 'members', new.members,
        'idea_places', new.idea_places, 'idea_plan', new.idea_plan
      )
    ),
    'UPDATE',
    'trip:' || new.code,
    true
  );
  return null;
end;
$$;
