-- Video analysis of ideas (docs/plans/video-spike.md): Gemini watches a shared
-- TikTok/reel and the server stores what it saw on the idea, plus one child
-- idea per spot when the video lists several. Additive only: the analysis
-- lives in trip_ideas.data (jsonb), so no trip table changes.

-- One row per analysis attempt, for the per-user daily quota and the real cost
-- (tokens × price, reconciled against the provider bills). Server only.
create table if not exists public.video_usage (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  room_code       text not null,
  idea_id         text not null,
  source          text not null check (source in ('tiktok', 'instagram', 'youtube', 'upload', 'other')),
  model           text,
  ok              boolean not null default false,
  reason          text,
  video_seconds   numeric,
  bytes           bigint,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  thinking_tokens integer not null default 0,
  provider_calls  integer not null default 0,
  attempts        integer not null default 0,
  wall_ms         integer,
  created_at      timestamptz not null default now()
);

create index if not exists video_usage_user_created_idx on public.video_usage (user_id, created_at desc);
create index if not exists video_usage_room_created_idx on public.video_usage (room_code, created_at desc);

-- RLS on with no policies: invisible to the anon key and signed-in clients.
alter table public.video_usage enable row level security;
revoke all on table public.video_usage from anon, authenticated;

-- Writes an analysis in one transaction: replaces the parent idea's data
-- (guarded by p_expected_version) and inserts the child ideas. Children have
-- ids derived from the parent, so a repeated analysis never duplicates them
-- (on conflict do nothing), and they stop at the 500-ideas cap. Returns
-- {parent, children} or {conflict: true, current} when the parent changed or
-- is gone.
create or replace function public.apply_idea_video(
  p_code             text,
  p_parent_id        text,
  p_expected_version int,
  p_parent_data      jsonb,
  p_children         jsonb,
  p_user             uuid
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_parent   public.trip_ideas;
  v_room     int;
  v_position int;
  v_children jsonb;
begin
  if jsonb_typeof(p_children) <> 'array' then
    raise exception 'children must be an array' using errcode = '22023';
  end if;

  select * into v_parent from public.trip_ideas
  where room_code = p_code and id = p_parent_id
  for update;
  if not found or (p_expected_version is not null and v_parent.version <> p_expected_version) then
    return jsonb_build_object('conflict', true, 'current', case when found then to_jsonb(v_parent) end);
  end if;

  update public.trip_ideas
  set data = p_parent_data, updated_by = p_user
  where room_code = p_code and id = p_parent_id
  returning * into v_parent;

  select count(*), coalesce(max(position) + 1, 0) into v_room, v_position
  from public.trip_ideas where room_code = p_code;
  v_room := greatest(500 - v_room, 0);

  with incoming as (
    select c ->> 'id' as id, c -> 'data' as data, ord
    from jsonb_array_elements(p_children) with ordinality as t(c, ord)
    order by ord
    limit v_room
  ),
  inserted as (
    insert into public.trip_ideas (room_code, id, position, data, updated_by)
    select p_code, id, v_position + ord::int - 1, data, p_user from incoming
    on conflict (room_code, id) do nothing
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted) order by inserted.position), '[]'::jsonb) into v_children from inserted;

  return jsonb_build_object('parent', to_jsonb(v_parent), 'children', v_children);
end;
$$;

revoke all on function public.apply_idea_video(text, text, int, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.apply_idea_video(text, text, int, jsonb, jsonb, uuid) to service_role;
