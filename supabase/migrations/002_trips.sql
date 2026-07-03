-- Trip name denormalized onto rooms so listings don't need to fetch full payloads
alter table rooms add column if not exists name text;

-- user_rooms: relational membership (user ↔ room). The table already existed in
-- the live project but was never versioned; this makes the schema reproducible.
create table if not exists user_rooms (
  user_id    uuid not null references auth.users (id) on delete cascade,
  room_code  text not null,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (user_id, room_code)
);

create index if not exists user_rooms_room_code_idx on user_rooms (room_code);

alter table user_rooms enable row level security;

-- Each user manages only their own membership rows
drop policy if exists "own rows select" on user_rooms;
create policy "own rows select" on user_rooms for select using (auth.uid() = user_id);

drop policy if exists "own rows insert" on user_rooms;
create policy "own rows insert" on user_rooms for insert with check (auth.uid() = user_id);

drop policy if exists "own rows delete" on user_rooms;
create policy "own rows delete" on user_rooms for delete using (auth.uid() = user_id);
