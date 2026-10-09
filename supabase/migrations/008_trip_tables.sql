-- Relational trip data (docs/plans/relational-broadcast.md, step 1.1).
-- One table per item type, keyed by (room_code, id) because existing ids are
-- only unique within a trip. Additive only: rooms.payload stays untouched and
-- becomes a frozen backup after the cut-over.
--
-- Checks mirror src/lib/schemas.ts and src/constants/limits.ts as they accept
-- stored data today (hours 0-48, nullable optional fields), so legacy payloads
-- migrate; the domain layer keeps enforcing the stricter rules for new writes
-- (6 <= start < end <= 26). Every row carries version / updated_at / updated_by
-- for per-row optimistic concurrency and attribution. position keeps list order
-- so rows can be assembled back into the payload shape.

-- Trip header on rooms (nullable; filled by the migration from payload.trip).
alter table public.rooms add column if not exists destination text;
alter table public.rooms add column if not exists start_date date;
alter table public.rooms add column if not exists end_date date;
alter table public.rooms add column if not exists exchange_rate numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_destination_length') then
    alter table public.rooms add constraint rooms_destination_length
      check (destination is null or char_length(destination) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_date_range') then
    alter table public.rooms add constraint rooms_date_range
      check (start_date is null or end_date is null or end_date >= start_date);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_exchange_rate_positive') then
    alter table public.rooms add constraint rooms_exchange_rate_positive
      check (exchange_rate is null or exchange_rate > 0);
  end if;
end $$;

-- Days: payload.days[]
create table if not exists public.trip_days (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  position   int not null default 0,
  label      text not null check (char_length(label) <= 200),
  sub        text check (char_length(sub) <= 200),
  flexible   boolean,
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id)
);

-- Events: payload.days[].events[]
create table if not exists public.trip_events (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  day_id     text not null,
  position   int not null default 0,
  start_hour numeric(5,2) not null check (start_hour between 0 and 48),
  end_hour   numeric(5,2) not null check (end_hour between 0 and 48),
  title      text not null check (char_length(title) <= 200),
  cat        text not null check (char_length(cat) <= 100),
  note       text check (char_length(note) <= 4000),
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, day_id) references public.trip_days (room_code, id) on delete cascade,
  constraint trip_events_hour_order check (end_hour > start_hour)
);

-- Colored ranges inside one day: payload.days[].spans[]
create table if not exists public.trip_day_spans (
  room_code      text not null references public.rooms (code) on delete cascade,
  id             text not null check (char_length(id) between 1 and 100),
  day_id         text not null,
  position       int not null default 0,
  label          text check (char_length(label) <= 200),
  start_event_id text,
  end_event_id   text,
  start_hour     numeric(5,2) check (start_hour between 0 and 48),
  end_hour       numeric(5,2) check (end_hour between 0 and 48),
  bg             text not null check (bg ~ '^(#[0-9a-fA-F]{3,8}|transparent|rgba?\([0-9\s.,%]+\))$'),
  border         text not null check (border ~ '^(#[0-9a-fA-F]{3,8}|transparent|rgba?\([0-9\s.,%]+\))$'),
  z_index        int,
  version        int not null default 1 check (version > 0),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, day_id) references public.trip_days (room_code, id) on delete cascade,
  foreign key (room_code, start_event_id) references public.trip_events (room_code, id) on delete set null (start_event_id),
  foreign key (room_code, end_event_id) references public.trip_events (room_code, id) on delete set null (end_event_id)
);

-- Cross-day spans: payload.tripSpans[]. They only exist between two events.
create table if not exists public.trip_spans (
  room_code      text not null references public.rooms (code) on delete cascade,
  id             text not null check (char_length(id) between 1 and 100),
  position       int not null default 0,
  label          text check (char_length(label) <= 200),
  start_event_id text not null,
  end_event_id   text not null,
  bg             text not null check (bg ~ '^(#[0-9a-fA-F]{3,8}|transparent|rgba?\([0-9\s.,%]+\))$'),
  border         text not null check (border ~ '^(#[0-9a-fA-F]{3,8}|transparent|rgba?\([0-9\s.,%]+\))$'),
  z_index        int,
  version        int not null default 1 check (version > 0),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, start_event_id) references public.trip_events (room_code, id) on delete cascade,
  foreign key (room_code, end_event_id) references public.trip_events (room_code, id) on delete cascade
);

-- Expenses: payload.extras[]
create table if not exists public.trip_expenses (
  room_code       text not null references public.rooms (code) on delete cascade,
  id              text not null check (char_length(id) between 1 and 100),
  position        int not null default 0,
  label           text not null check (char_length(label) <= 200),
  amount          numeric(14,2) not null,
  currency        text check (currency in ('USD', 'COP')),
  split_mode      text check (split_mode in ('group', 'perPerson')),
  linked_event_id text,
  start_day_id    text,
  end_day_id      text,
  version         int not null default 1 check (version > 0),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, linked_event_id) references public.trip_events (room_code, id) on delete set null (linked_event_id),
  foreign key (room_code, start_day_id) references public.trip_days (room_code, id) on delete set null (start_day_id),
  foreign key (room_code, end_day_id) references public.trip_days (room_code, id) on delete set null (end_day_id)
);

-- Tasks: payload.tasks[]. Deleting the day moves the task back to the backlog;
-- its hours are ignored while day_id is null.
create table if not exists public.trip_tasks (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  position   int not null default 0,
  title      text not null check (char_length(title) <= 200),
  done       boolean not null default false,
  note       text check (char_length(note) <= 4000),
  day_id     text,
  start_hour numeric(5,2) check (start_hour between 0 and 48),
  end_hour   numeric(5,2) check (end_hour between 0 and 48),
  cat        text check (char_length(cat) <= 100),
  priority   text check (priority in ('alta', 'media', 'baja')),
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, day_id) references public.trip_days (room_code, id) on delete set null (day_id)
);

-- Candidate choices of a task: payload.tasks[].options[]
create table if not exists public.trip_task_options (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  task_id    text not null,
  position   int not null default 0,
  label      text not null check (char_length(label) <= 200),
  note       text check (char_length(note) <= 4000),
  amount     numeric(14,2),
  currency   text check (currency in ('USD', 'COP')),
  split_mode text check (split_mode in ('group', 'perPerson')),
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id),
  foreign key (room_code, task_id) references public.trip_tasks (room_code, id) on delete cascade
);

-- Travelers without an account: payload.mockPeople[]
create table if not exists public.trip_travelers (
  room_code  text not null references public.rooms (code) on delete cascade,
  id         text not null check (char_length(id) between 1 and 100),
  position   int not null default 0,
  name       text not null check (char_length(name) <= 80),
  version    int not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (room_code, id)
);

-- Append-only history, written by the audit trigger (step 1.3).
create table if not exists public.trip_changes (
  id         bigint generated always as identity primary key,
  room_code  text not null references public.rooms (code) on delete cascade,
  table_name text not null,
  row_id     text not null,
  op         text not null check (op in ('INSERT', 'UPDATE', 'DELETE')),
  before     jsonb,
  after      jsonb,
  user_id    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Foreign-key indexes. room_code alone is covered by each primary key prefix.
create index if not exists trip_days_updated_by_idx on public.trip_days (updated_by);

create index if not exists trip_events_day_idx on public.trip_events (room_code, day_id);
create index if not exists trip_events_updated_by_idx on public.trip_events (updated_by);

create index if not exists trip_day_spans_day_idx on public.trip_day_spans (room_code, day_id);
create index if not exists trip_day_spans_start_event_idx on public.trip_day_spans (room_code, start_event_id);
create index if not exists trip_day_spans_end_event_idx on public.trip_day_spans (room_code, end_event_id);
create index if not exists trip_day_spans_updated_by_idx on public.trip_day_spans (updated_by);

create index if not exists trip_spans_start_event_idx on public.trip_spans (room_code, start_event_id);
create index if not exists trip_spans_end_event_idx on public.trip_spans (room_code, end_event_id);
create index if not exists trip_spans_updated_by_idx on public.trip_spans (updated_by);

create index if not exists trip_expenses_linked_event_idx on public.trip_expenses (room_code, linked_event_id);
create index if not exists trip_expenses_start_day_idx on public.trip_expenses (room_code, start_day_id);
create index if not exists trip_expenses_end_day_idx on public.trip_expenses (room_code, end_day_id);
create index if not exists trip_expenses_updated_by_idx on public.trip_expenses (updated_by);

create index if not exists trip_tasks_day_idx on public.trip_tasks (room_code, day_id);
create index if not exists trip_tasks_updated_by_idx on public.trip_tasks (updated_by);

create index if not exists trip_task_options_task_idx on public.trip_task_options (room_code, task_id);
create index if not exists trip_task_options_updated_by_idx on public.trip_task_options (updated_by);

create index if not exists trip_travelers_updated_by_idx on public.trip_travelers (updated_by);

create index if not exists trip_changes_room_created_idx on public.trip_changes (room_code, created_at desc);
create index if not exists trip_changes_user_idx on public.trip_changes (user_id);
