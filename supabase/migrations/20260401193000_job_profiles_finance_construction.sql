do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'payment_party_type'
  ) then
    create type public.payment_party_type as enum ('client', 'vendor', 'commission', 'general_expense');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'commission_recipient_type'
  ) then
    create type public.commission_recipient_type as enum ('sales_rep', 'estimator', 'operations', 'team_lead', 'marketing', 'owner');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'recurrence_frequency'
  ) then
    create type public.recurrence_frequency as enum ('monthly', 'quarterly', 'annual');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'commission_basis'
  ) then
    create type public.commission_basis as enum ('true_gp', 'rep_gp', 'auto');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'commission_schedule_rule'
  ) then
    create type public.commission_schedule_rule as enum ('rep_schedule', 'stage_2', 'manual');
  end if;
end
$$;

create table if not exists public.job_profiles (
  job_id text primary key,
  job_name text not null default '',
  client_id text not null default '',
  client_name text not null default '',
  sales_rep text not null default '',
  estimator text not null default '',
  team_lead text not null default '',
  province text not null default '',
  city text not null default '',
  address text not null default '',
  postal_code text not null default '',
  width numeric not null default 0,
  length numeric not null default 0,
  height numeric not null default 0,
  left_eave_height numeric,
  right_eave_height numeric,
  is_single_slope boolean,
  pitch numeric,
  structure_type text,
  last_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_profiles
  add column if not exists job_name text not null default '';
alter table public.job_profiles
  add column if not exists client_id text not null default '';
alter table public.job_profiles
  add column if not exists client_name text not null default '';
alter table public.job_profiles
  add column if not exists sales_rep text not null default '';
alter table public.job_profiles
  add column if not exists estimator text not null default '';
alter table public.job_profiles
  add column if not exists team_lead text not null default '';
alter table public.job_profiles
  add column if not exists province text not null default '';
alter table public.job_profiles
  add column if not exists city text not null default '';
alter table public.job_profiles
  add column if not exists address text not null default '';
alter table public.job_profiles
  add column if not exists postal_code text not null default '';
alter table public.job_profiles
  add column if not exists width numeric not null default 0;
alter table public.job_profiles
  add column if not exists length numeric not null default 0;
alter table public.job_profiles
  add column if not exists height numeric not null default 0;
alter table public.job_profiles
  add column if not exists left_eave_height numeric;
alter table public.job_profiles
  add column if not exists right_eave_height numeric;
alter table public.job_profiles
  add column if not exists is_single_slope boolean;
alter table public.job_profiles
  add column if not exists pitch numeric;
alter table public.job_profiles
  add column if not exists structure_type text;
alter table public.job_profiles
  add column if not exists last_source text;
alter table public.job_profiles
  add column if not exists created_at timestamptz not null default now();
alter table public.job_profiles
  add column if not exists updated_at timestamptz not null default now();

create index if not exists job_profiles_client_id_idx on public.job_profiles (client_id);
create index if not exists job_profiles_client_name_idx on public.job_profiles (client_name);

alter table public.deals
  add column if not exists engineering_drawings_status text not null default 'not_requested';
alter table public.deals
  add column if not exists foundation_drawings_status text not null default 'not_requested';

alter table public.deals
  drop constraint if exists deals_engineering_drawings_status_check;
alter table public.deals
  add constraint deals_engineering_drawings_status_check
  check (engineering_drawings_status in ('not_requested', 'requested', 'received', 'signed', 'not_required'));

alter table public.deals
  drop constraint if exists deals_foundation_drawings_status_check;
alter table public.deals
  add constraint deals_foundation_drawings_status_check
  check (foundation_drawings_status in ('not_requested', 'requested', 'received', 'signed', 'not_required'));

alter table public.production
  add column if not exists engineering_drawings_status text not null default 'not_requested';
alter table public.production
  add column if not exists foundation_drawings_status text not null default 'not_requested';

alter table public.production
  drop constraint if exists production_engineering_drawings_status_check;
alter table public.production
  add constraint production_engineering_drawings_status_check
  check (engineering_drawings_status in ('not_requested', 'requested', 'received', 'signed', 'not_required'));

alter table public.production
  drop constraint if exists production_foundation_drawings_status_check;
alter table public.production
  add constraint production_foundation_drawings_status_check
  check (foundation_drawings_status in ('not_requested', 'requested', 'received', 'signed', 'not_required'));

alter table public.freight
  add column if not exists estimated_pickup_date text not null default '';
alter table public.freight
  add column if not exists estimated_delivery_date text not null default '';
alter table public.freight
  add column if not exists actual_pickup_date text not null default '';
alter table public.freight
  add column if not exists actual_delivery_date text not null default '';

update public.freight
set actual_pickup_date = coalesce(nullif(actual_pickup_date, ''), pickup_date::text, '')
where coalesce(nullif(actual_pickup_date, ''), '') = '';

update public.freight
set actual_delivery_date = coalesce(nullif(actual_delivery_date, ''), delivery_date::text, '')
where coalesce(nullif(actual_delivery_date, ''), '') = '';

update public.freight
set estimated_pickup_date = coalesce(nullif(estimated_pickup_date, ''), pickup_date::text, actual_pickup_date, '')
where coalesce(nullif(estimated_pickup_date, ''), '') = '';

update public.freight
set estimated_delivery_date = coalesce(nullif(estimated_delivery_date, ''), delivery_date::text, actual_delivery_date, '')
where coalesce(nullif(estimated_delivery_date, ''), '') = '';

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_types on enum_values.enumtypid = enum_types.oid
    where enum_types.typname = 'payment_direction'
      and enum_values.enumlabel = 'Commission Payment OUT'
  ) then
    alter type public.payment_direction add value 'Commission Payment OUT';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_types on enum_values.enumtypid = enum_types.oid
    where enum_types.typname = 'payment_direction'
      and enum_values.enumlabel = 'Expense OUT'
  ) then
    alter type public.payment_direction add value 'Expense OUT';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_types on enum_values.enumtypid = enum_types.oid
    where enum_types.typname = 'payment_type'
      and enum_values.enumlabel = 'Commission'
  ) then
    alter type public.payment_type add value 'Commission';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_types on enum_values.enumtypid = enum_types.oid
    where enum_types.typname = 'payment_type'
      and enum_values.enumlabel = 'Expense'
  ) then
    alter type public.payment_type add value 'Expense';
  end if;
end
$$;

alter table public.payments
  alter column job_id drop not null;
alter table public.payments
  alter column job_id drop default;

update public.payments
set job_id = null
where nullif(trim(coalesce(job_id, '')), '') is null;

alter table public.payments
  add column if not exists party_type public.payment_party_type not null default 'client';
alter table public.payments
  add column if not exists commission_recipient_type public.commission_recipient_type;
alter table public.payments
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;
alter table public.payments
  add column if not exists recurrence_frequency public.recurrence_frequency;
alter table public.payments
  add column if not exists recurrence_start_date text;
alter table public.payments
  add column if not exists recurrence_end_date text;
alter table public.payments
  add column if not exists include_in_projection boolean not null default false;

update public.payments
set party_type = case
  when direction = 'Client Payment IN' then 'client'::public.payment_party_type
  when direction = 'Refund OUT' then 'client'::public.payment_party_type
  when direction = 'Vendor Payment OUT' then 'vendor'::public.payment_party_type
  when direction = 'Refund IN' then 'vendor'::public.payment_party_type
  else party_type
end;

create table if not exists public.commission_recipient_settings (
  id uuid primary key default gen_random_uuid(),
  recipient_type public.commission_recipient_type not null,
  recipient_name text not null default '',
  linked_user_id uuid references auth.users(id) on delete set null,
  basis_override public.commission_basis not null default 'auto',
  schedule_rule public.commission_schedule_rule not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_type, recipient_name)
);

alter table public.commission_payouts
  drop constraint if exists commission_payouts_recipient_role_check;
alter table public.commission_payouts
  drop constraint if exists commission_payouts_payout_stage_check;

alter table public.commission_payouts
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;
alter table public.commission_payouts
  add column if not exists basis_used public.commission_basis;
alter table public.commission_payouts
  add column if not exists schedule_rule public.commission_schedule_rule;
alter table public.commission_payouts
  add column if not exists payment_ledger_id uuid references public.payments(id) on delete set null;

update public.commission_payouts
set payout_stage = case payout_stage
  when 'sales_rep_stage_1' then 'rep_stage_1'
  when 'sales_rep_stage_2' then 'rep_stage_2'
  when 'sales_rep_stage_3' then 'rep_stage_3'
  when 'estimator_stage_2' then 'stage_2'
  else payout_stage
end;

alter table public.commission_payouts
  add constraint commission_payouts_recipient_role_check
  check (recipient_role in ('sales_rep', 'estimator', 'operations', 'team_lead', 'marketing', 'owner'));

alter table public.commission_payouts
  add constraint commission_payouts_payout_stage_check
  check (payout_stage in ('rep_stage_1', 'rep_stage_2', 'rep_stage_3', 'stage_2', 'manual'));

create table if not exists public.construction_rfqs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null default '',
  title text not null default '',
  scope text not null default 'install'
    check (scope in ('install', 'install_plus_concrete')),
  building_details text not null default '',
  job_name text not null default '',
  province text not null default '',
  city text not null default '',
  postal_code text not null default '',
  address text not null default '',
  width numeric not null default 0,
  length numeric not null default 0,
  height numeric not null default 0,
  notes text not null default '',
  required_by_date text not null default '',
  closing_date text not null default '',
  status text not null default 'Open'
    check (status in ('Open', 'Closed', 'Awarded', 'Cancelled')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  awarded_bid_id uuid
);

create table if not exists public.construction_bids (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.construction_rfqs(id) on delete cascade,
  vendor_id uuid not null references auth.users(id) on delete cascade,
  vendor_name text not null default '',
  bid_scope text not null default 'install_only'
    check (bid_scope in ('install_only', 'concrete_only', 'both')),
  install_amount numeric not null default 0,
  concrete_amount numeric not null default 0,
  total_amount numeric not null default 0,
  notes text not null default '',
  status text not null default 'Submitted'
    check (status in ('Submitted', 'Under Review', 'Accepted', 'Rejected', 'Withdrawn')),
  submitted_at timestamptz not null default now()
);

alter table public.construction_rfqs
  add constraint fk_construction_awarded_bid
  foreign key (awarded_bid_id) references public.construction_bids(id) on delete set null;

create index if not exists construction_rfqs_job_id_idx on public.construction_rfqs (job_id, status);
create index if not exists construction_bids_rfq_id_idx on public.construction_bids (rfq_id);
create index if not exists payments_job_id_idx on public.payments (job_id);
create index if not exists payments_party_type_idx on public.payments (party_type, direction);
create index if not exists payments_projection_idx on public.payments (include_in_projection, recurrence_frequency);

alter table public.job_profiles enable row level security;
alter table public.commission_recipient_settings enable row level security;
alter table public.construction_rfqs enable row level security;
alter table public.construction_bids enable row level security;

drop policy if exists "Authenticated full access on job_profiles" on public.job_profiles;
create policy "Authenticated full access on job_profiles"
  on public.job_profiles for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Commission recipient settings read" on public.commission_recipient_settings;
create policy "Commission recipient settings read"
  on public.commission_recipient_settings for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]));

drop policy if exists "Commission recipient settings write" on public.commission_recipient_settings;
create policy "Commission recipient settings write"
  on public.commission_recipient_settings for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]))
  with check (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]));

drop policy if exists "Construction RFQs internal full access" on public.construction_rfqs;
create policy "Construction RFQs internal full access"
  on public.construction_rfqs for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]))
  with check (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]));

drop policy if exists "Construction vendors read RFQs" on public.construction_rfqs;
create policy "Construction vendors read RFQs"
  on public.construction_rfqs for select to authenticated
  using (public.has_role(auth.uid(), 'construction'::app_role));

drop policy if exists "Construction bids internal full access" on public.construction_bids;
create policy "Construction bids internal full access"
  on public.construction_bids for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]))
  with check (public.has_any_role(auth.uid(), array['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]));

drop policy if exists "Construction vendors read own bids" on public.construction_bids;
create policy "Construction vendors read own bids"
  on public.construction_bids for select to authenticated
  using (vendor_id = auth.uid());

drop policy if exists "Construction vendors insert own bids" on public.construction_bids;
create policy "Construction vendors insert own bids"
  on public.construction_bids for insert to authenticated
  with check (vendor_id = auth.uid() and public.has_role(auth.uid(), 'construction'::app_role));

drop policy if exists "Construction vendors update own bids" on public.construction_bids;
create policy "Construction vendors update own bids"
  on public.construction_bids for update to authenticated
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid() and public.has_role(auth.uid(), 'construction'::app_role));

-- Historical job_profile hydration is intentionally handled in a follow-up
-- idempotent backfill migration. This schema migration must remain safe to
-- rerun against partially-applied remote state.
