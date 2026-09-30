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
