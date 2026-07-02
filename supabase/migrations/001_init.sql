-- Rooms table: each row is a shared itinerary identified by a short code
create table if not exists rooms (
  code        text primary key,
  payload     jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

-- Auto-update timestamp on every write
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_updated_at
  before update on rooms
  for each row execute procedure touch_updated_at();

-- Row Level Security: anyone with the code can read/write (public sharing)
alter table rooms enable row level security;

create policy "public read"   on rooms for select using (true);
create policy "public insert" on rooms for insert with check (true);
create policy "public update" on rooms for update using (true);

-- Enable Supabase Realtime for this table
alter publication supabase_realtime add table rooms;
