-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create the table
create table if not exists app_state (
  id text primary key default 'default',
  state jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 2. Enable real-time for this table
alter publication supabase_realtime add table app_state;

-- 3. Enable Row Level Security (required by Supabase)
alter table app_state enable row level security;

-- 4. Allow all authenticated and anonymous users to read/write
--    (the anon key is public, but only this one row exists)
create policy "Allow all access" on app_state
  for all
  using (true)
  with check (true);
