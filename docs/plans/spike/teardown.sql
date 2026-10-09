-- Removes everything spike.sql created. STAGING ONLY.

drop policy if exists "spike members receive trip broadcasts" on realtime.messages;
drop table if exists public.spike_events;
drop function if exists private.spike_broadcast_change();
