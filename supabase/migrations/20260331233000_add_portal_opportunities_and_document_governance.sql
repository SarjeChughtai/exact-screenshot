create extension if not exists pgcrypto;

alter table public.quote_files
  add column if not exists duplicate_group_key text,
  add column if not exists is_primary_document boolean not null default true,
  add column if not exists stored_document_id uuid;

alter table public.stored_documents
  add column if not exists duplicate_group_key text,
  add column if not exists is_primary_document boolean not null default true;

alter table public.quotes
  add column if not exists opportunity_id uuid;

alter table public.deals
  add column if not exists opportunity_id uuid;

alter table public.freight
  add column if not exists opportunity_id uuid,
  add column if not exists drop_off_location text not null default '',
  add column if not exists pickup_date date,
  add column if not exists delivery_date date,
  add column if not exists mode text not null default 'execution';

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  job_id text not null unique,
  client_id text not null default '',
  client_name text not null default '',
  name text not null default '',
  potential_revenue numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'abandoned')),
  created_by_user_id uuid,
  owner_user_id uuid,
  sales_rep text,
  estimator text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_milestones (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.deals(job_id) on delete cascade,
  milestone_key text not null,
  is_complete boolean not null default false,
  completed_at timestamptz,
  completed_by_user_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, milestone_key)
);

create index if not exists quote_files_job_id_duplicate_idx
  on public.quote_files (job_id, duplicate_group_key, is_primary_document, created_at desc);

create index if not exists stored_documents_quote_file_duplicate_idx
  on public.stored_documents (quote_file_id, duplicate_group_key, is_primary_document);

create index if not exists opportunities_job_id_idx
  on public.opportunities (job_id);

create index if not exists opportunities_status_idx
  on public.opportunities (status);

create index if not exists deal_milestones_job_id_idx
  on public.deal_milestones (job_id, milestone_key);

update public.freight
set
  drop_off_location = case
    when coalesce(drop_off_location, '') <> '' then drop_off_location
    else coalesce(delivery_address, '')
  end,
  pickup_date = coalesce(pickup_date, nullif(pickup_date::text, '')::date),
  delivery_date = coalesce(delivery_date, nullif(delivery_date::text, '')::date)
where true;

update public.quote_files
set duplicate_group_key = concat_ws(
  '|',
  coalesce(nullif(lower(regexp_replace(job_id, '[^a-zA-Z0-9]+', '-', 'g')), ''), 'no-job'),
  coalesce(nullif(lower(regexp_replace(file_type, '[^a-zA-Z0-9]+', '-', 'g')), ''), 'unknown'),
  coalesce(nullif(lower(regexp_replace(coalesce(document_id, ''), '[^a-zA-Z0-9]+', '-', 'g')), ''), 'no-document'),
  coalesce(nullif(lower(regexp_replace(building_label, '[^a-zA-Z0-9]+', '-', 'g')), ''), 'no-building'),
  coalesce(nullif(lower(regexp_replace(client_id, '[^a-zA-Z0-9]+', '-', 'g')), ''), 'no-client')
)
where duplicate_group_key is null;

update public.stored_documents d
set duplicate_group_key = q.duplicate_group_key
from public.quote_files q
where d.quote_file_id = q.id
  and d.duplicate_group_key is null;

insert into public.opportunities (
  job_id,
  client_id,
  client_name,
  name,
  potential_revenue,
  status,
  created_by_user_id,
  sales_rep,
  estimator,
  source
)
select
  q.job_id,
  coalesce(max(q.client_id), ''),
  coalesce(max(q.client_name), ''),
  coalesce(max(nullif(q.job_name, '')), max(q.client_name), q.job_id),
  max(coalesce(q.grand_total, 0)),
  case
    when bool_or(q.workflow_status = 'lost' or q.status = 'Lost' or q.status = 'Expired') then 'lost'
    else 'open'
  end,
  (array_remove(array_agg(q.created_by_user_id), null))[1],
  max(nullif(q.sales_rep, '')),
  max(nullif(q.estimator, '')),
  max(q.document_type)
from public.quotes q
where coalesce(q.job_id, '') <> ''
group by q.job_id
on conflict (job_id) do update
set
  client_id = excluded.client_id,
  client_name = excluded.client_name,
  name = excluded.name,
  potential_revenue = greatest(public.opportunities.potential_revenue, excluded.potential_revenue),
  sales_rep = coalesce(excluded.sales_rep, public.opportunities.sales_rep),
  estimator = coalesce(excluded.estimator, public.opportunities.estimator),
  source = excluded.source,
  updated_at = now();

insert into public.opportunities (
  job_id,
  client_id,
  client_name,
  name,
  potential_revenue,
  status,
  sales_rep,
  estimator,
  source
)
select
  d.job_id,
  coalesce(d.client_id, ''),
  coalesce(d.client_name, ''),
  coalesce(nullif(d.job_name, ''), d.client_name, d.job_id),
  0,
  case
    when d.deal_status = 'Cancelled' then 'abandoned'
    when d.deal_status in ('Lead', 'Quoted') then 'open'
    else 'won'
  end,
  nullif(d.sales_rep, ''),
  nullif(d.estimator, ''),
  'deal'
from public.deals d
where coalesce(d.job_id, '') <> ''
on conflict (job_id) do update
set
  client_id = coalesce(excluded.client_id, public.opportunities.client_id),
  client_name = coalesce(excluded.client_name, public.opportunities.client_name),
  name = coalesce(excluded.name, public.opportunities.name),
  status = excluded.status,
  sales_rep = coalesce(excluded.sales_rep, public.opportunities.sales_rep),
  estimator = coalesce(excluded.estimator, public.opportunities.estimator),
  source = 'deal',
  updated_at = now();

update public.quotes q
set opportunity_id = o.id
from public.opportunities o
where q.job_id = o.job_id
  and q.opportunity_id is null;

update public.deals d
set opportunity_id = o.id
from public.opportunities o
where d.job_id = o.job_id
  and d.opportunity_id is null;

update public.freight f
set opportunity_id = o.id
from public.opportunities o
where f.job_id = o.job_id
  and f.opportunity_id is null;

alter table public.opportunities enable row level security;
alter table public.deal_milestones enable row level security;

drop policy if exists "Opportunities read" on public.opportunities;
drop policy if exists "Opportunities write" on public.opportunities;
drop policy if exists "Deal milestones read" on public.deal_milestones;
drop policy if exists "Deal milestones write" on public.deal_milestones;

create policy "Opportunities read"
on public.opportunities
for select to authenticated
using (
  public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role])
  or public.can_access_job_id(job_id)
);

create policy "Opportunities write"
on public.opportunities
for all to authenticated
using (
  public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'sales_rep'::app_role, 'estimator'::app_role, 'dealer'::app_role])
)
with check (
  public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'sales_rep'::app_role, 'estimator'::app_role, 'dealer'::app_role])
);

create policy "Deal milestones read"
on public.deal_milestones
for select to authenticated
using (
  public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'freight'::app_role])
  or public.can_access_job_id(job_id)
);

create policy "Deal milestones write"
on public.deal_milestones
for all to authenticated
using (
  public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'freight'::app_role])
)
with check (
  public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'freight'::app_role])
);
