-- rooms.members: display roster (name/avatar per member). The column already
-- existed in the live project but was never versioned; this makes the schema
-- reproducible from migrations.
alter table rooms add column if not exists members jsonb not null default '[]'::jsonb;
