-- Trip header and roster changes on the trip channel
-- (docs/plans/relational-broadcast.md, step 3.5). The rooms row is not a trip
-- table: it carries the frozen payload backup, which must never be sent, so
-- instead of broadcast_changes this sends only the header columns and the
-- members roster with realtime.send (private). Same message fields as the
-- trip tables: operation, table, schema, record, old_record.

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

  if (new.name, new.destination, new.start_date, new.end_date, new.exchange_rate, new.members)
     is not distinct from
     (old.name, old.destination, old.start_date, old.end_date, old.exchange_rate, old.members) then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'operation', 'UPDATE', 'table', 'rooms', 'schema', 'public', 'old_record', null,
      'record', jsonb_build_object(
        'code', new.code, 'name', new.name, 'destination', new.destination,
        'start_date', new.start_date, 'end_date', new.end_date,
        'exchange_rate', new.exchange_rate, 'members', new.members
      )
    ),
    'UPDATE',
    'trip:' || new.code,
    true
  );
  return null;
end;
$$;

revoke all on function private.broadcast_room_change() from public, anon, authenticated;

drop trigger if exists rooms_broadcast on public.rooms;
create trigger rooms_broadcast
  after update or delete on public.rooms
  for each row execute function private.broadcast_room_change();
