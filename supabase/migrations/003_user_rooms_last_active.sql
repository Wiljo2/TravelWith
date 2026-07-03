-- Track when a user last opened a room, so the app can auto-resume their most
-- recent trip across devices (DB-backed relation, not localStorage).
alter table user_rooms add column if not exists last_active_at timestamptz not null default now();

create index if not exists user_rooms_last_active_idx on user_rooms (user_id, last_active_at desc);
