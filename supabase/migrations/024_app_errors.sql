-- Errors seen by the app (browser and server), kept to look back at what failed:
-- Vercel's runtime logs expire within hours. Written and read only by the server
-- (service role). Limits mirror src/server/errors.ts.
create table if not exists app_errors (
  id          bigint generated always as identity primary key,
  source      text not null check (source in ('client', 'server')),
  context     text check (char_length(context) <= 120),
  message     text not null check (char_length(message) <= 1000),
  stack       text check (char_length(stack) <= 8000),
  path        text check (char_length(path) <= 300),
  user_agent  text check (char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);

create index if not exists app_errors_created_idx on app_errors (created_at desc);

-- RLS on with no policies: invisible to the anon key and signed-in clients.
alter table app_errors enable row level security;
