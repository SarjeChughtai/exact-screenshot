-- Create clients table to track client info and associated job IDs
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  client_id text unique not null,
  client_name text not null,
  job_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS: allow all authenticated users full CRUD
alter table clients enable row level security;

create policy "authenticated full access on clients"
  on clients
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
