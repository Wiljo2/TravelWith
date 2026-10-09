-- Sample writes for the spike. Replace SPIKE01 with the staging room code and
-- run one statement at a time while listen.ts is running.

insert into public.spike_events (room_code, id, title) values ('SPIKE01', 'e1', 'Museo');

update public.spike_events
set title = 'Museo del Oro', version = version + 1, updated_at = now()
where room_code = 'SPIKE01' and id = 'e1';

delete from public.spike_events where room_code = 'SPIKE01' and id = 'e1';

-- Size check: a title close to the limit, to see the message size and shape.
insert into public.spike_events (room_code, id, title) values ('SPIKE01', 'e2', repeat('x', 200));
delete from public.spike_events where room_code = 'SPIKE01' and id = 'e2';

-- Custom message as sent by the rooms header trigger (016_room_broadcast.sql):
-- record how the client receives realtime.send payloads too.
select realtime.send(
  jsonb_build_object('operation', 'UPDATE', 'table', 'rooms', 'schema', 'public', 'old_record', null,
                     'record', jsonb_build_object('code', 'SPIKE01', 'exchange_rate', 4200)),
  'UPDATE',
  'trip:SPIKE01',
  true
);
