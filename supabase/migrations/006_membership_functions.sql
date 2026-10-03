-- Membership changes as single transactions. The API calls these through the
-- service role; clients cannot execute them.
--
-- join_room / leave_room lock the room row, so concurrent joins and leaves are
-- serialized and the rooms.members roster can no longer lose updates.

create or replace function public.join_room(
  p_code   text,
  p_user   uuid,
  p_name   text,
  p_avatar text,
  p_role   text default 'member'
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  if p_role not in ('owner', 'member') then
    raise exception 'invalid role %', p_role;
  end if;

  perform 1 from public.rooms where code = p_code for update;
  if not found then
    return jsonb_build_object('joined', false);
  end if;

  -- Re-joining only bumps last_active_at; an existing role is never changed.
  insert into public.user_rooms (user_id, room_code, role, last_active_at)
  values (p_user, p_code, p_role, now())
  on conflict (user_id, room_code) do update set last_active_at = now()
  returning role into v_role;

  update public.rooms
  set members = coalesce(members, '[]'::jsonb) || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'userId',   p_user::text,
    'name',     p_name,
    'avatar',   p_avatar,
    'joinedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )))
  where code = p_code
    and not exists (
      select 1 from jsonb_array_elements(coalesce(members, '[]'::jsonb)) m
      where m ->> 'userId' = p_user::text
    );

  return jsonb_build_object('joined', true, 'role', v_role);
end;
$$;

-- Leaving removes the membership and the roster entry; the last member out
-- deletes the room. Callers that were not members get left = false and
-- nothing is touched.
create or replace function public.leave_room(p_code text, p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_deleted   integer;
  v_remaining integer;
begin
  perform 1 from public.rooms where code = p_code for update;

  delete from public.user_rooms where room_code = p_code and user_id = p_user;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return jsonb_build_object('left', false);
  end if;

  update public.rooms
  set members = coalesce((
    select jsonb_agg(m)
    from jsonb_array_elements(coalesce(members, '[]'::jsonb)) m
    where m ->> 'userId' <> p_user::text
  ), '[]'::jsonb)
  where code = p_code;

  select count(*) into v_remaining from public.user_rooms where room_code = p_code;
  if v_remaining = 0 then
    delete from public.rooms where code = p_code;
    return jsonb_build_object('left', true, 'roomDeleted', true);
  end if;

  return jsonb_build_object('left', true, 'roomDeleted', false);
end;
$$;

-- Hard delete for everyone (owner check happens in the API).
create or replace function public.delete_room(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.user_rooms where room_code = p_code;
  delete from public.rooms where code = p_code;
end;
$$;

revoke all on function public.join_room(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.leave_room(text, uuid) from public, anon, authenticated;
revoke all on function public.delete_room(text) from public, anon, authenticated;
grant execute on function public.join_room(text, uuid, text, text, text) to service_role;
grant execute on function public.leave_room(text, uuid) to service_role;
grant execute on function public.delete_room(text) to service_role;

-- updated_at is the trip's version for optimistic concurrency. Roster changes
-- (join/leave) must not bump it, or every member's next autosave gets a 409 and
-- drops their pending edits. Replaces the 001 body; see GUIDELINES "Known
-- backend debt".
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payload is distinct from old.payload then
    new.updated_at = now();
  end if;
  return new;
end;
$$;
