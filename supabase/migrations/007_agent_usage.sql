-- One row per AI assistant request, used for the per-user daily token quota and
-- for cost monitoring. Written and read only by the server (service role).
create table if not exists agent_usage (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  room_code      text not null,
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists agent_usage_user_created_idx on agent_usage (user_id, created_at desc);

-- RLS on with no policies: invisible to the anon key and signed-in clients.
alter table agent_usage enable row level security;
