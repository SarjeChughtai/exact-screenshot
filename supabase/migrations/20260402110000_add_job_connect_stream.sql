create or replace view public.shared_job_directory as
with quote_agg as (
  select
    q.job_id,
    max(nullif(q.client_name, '')) as client_name,
    max(nullif(q.job_name, '')) as job_name,
    max(nullif(q.sales_rep, '')) as sales_rep,
    max(nullif(q.estimator, '')) as estimator,
    (array_remove(array_agg(q.assigned_estimator_user_id), null))[1] as assigned_estimator_user_id,
    (array_remove(array_agg(q.created_by_user_id) filter (where q.document_type = 'dealer_rfq'), null))[1] as dealer_user_id,
    max(
      case q.document_type
        when 'external_quote' then 3
        when 'internal_quote' then 2
        when 'dealer_rfq' then 1
        when 'rfq' then 1
        else 0
      end
    ) as state_rank,
    (
      array_agg(
        q.document_type::text
        order by
          case q.document_type
            when 'external_quote' then 3
            when 'internal_quote' then 2
            when 'dealer_rfq' then 1
            when 'rfq' then 1
            else 0
          end desc,
          q.updated_at desc nulls last,
          q.created_at desc nulls last
      )
    )[1] as source_document_type,
    (
      array_agg(
        q.id
        order by
          case q.document_type
            when 'external_quote' then 3
            when 'internal_quote' then 2
            when 'dealer_rfq' then 1
            when 'rfq' then 1
            else 0
          end desc,
          q.updated_at desc nulls last,
          q.created_at desc nulls last
      )
    )[1] as source_document_id
  from public.quotes q
  where coalesce(q.job_id, '') <> ''
  group by q.job_id
),
deal_agg as (
  select
    d.job_id,
    max(nullif(d.client_name, '')) as client_name,
    max(nullif(d.job_name, '')) as job_name,
    max(nullif(d.sales_rep, '')) as sales_rep,
    max(nullif(d.estimator, '')) as estimator
  from public.deals d
  where coalesce(d.job_id, '') <> ''
  group by d.job_id
),
freight_agg as (
  select
    f.job_id,
    (array_remove(array_agg(f.assigned_freight_user_id), null))[1] as assigned_freight_user_id
  from public.freight f
  where coalesce(f.job_id, '') <> ''
  group by f.job_id
),
vendor_agg as (
  select
    vj.job_id,
    array_remove(array_agg(distinct vb.vendor_id), null) as vendor_user_ids
  from public.vendor_jobs vj
  left join public.vendor_bids vb on vb.job_id = vj.id
  where coalesce(vj.job_id, '') <> ''
  group by vj.job_id
),
construction_job_agg as (
  select
    rfq.job_id,
    max(nullif(rfq.job_name, '')) as job_name
  from public.construction_rfqs rfq
  where coalesce(rfq.job_id, '') <> ''
  group by rfq.job_id
),
construction_agg as (
  select
    rfq.job_id,
    array_remove(array_agg(distinct bid.vendor_id), null) as vendor_user_ids
  from public.construction_rfqs rfq
  left join public.construction_bids bid on bid.rfq_id = rfq.id
  where coalesce(rfq.job_id, '') <> ''
  group by rfq.job_id
),
job_ids as (
  select job_id from quote_agg
  union
  select job_id from deal_agg
  union
  select job_id from freight_agg
  union
  select job_id from vendor_agg
  union
  select job_id from construction_job_agg
  union
  select job_id from construction_agg
)
select
  ids.job_id,
  coalesce(deal_agg.client_name, quote_agg.client_name, '') as client_name,
  coalesce(deal_agg.job_name, quote_agg.job_name, construction_job_agg.job_name, '') as job_name,
  case
    when deal_agg.job_id is not null then 'deal'
    when quote_agg.state_rank = 3 then 'external_quote'
    when quote_agg.state_rank = 2 then 'internal_quote'
    when quote_agg.state_rank = 1 then 'rfq'
    else 'estimate'
  end as state,
  coalesce(deal_agg.sales_rep, quote_agg.sales_rep, '') as sales_rep,
  null::uuid as sales_rep_user_id,
  coalesce(deal_agg.estimator, quote_agg.estimator, '') as estimator,
  quote_agg.assigned_estimator_user_id,
  freight_agg.assigned_freight_user_id,
  quote_agg.dealer_user_id,
  coalesce(
    (
      select array_agg(distinct value)
      from unnest(
        coalesce(vendor_agg.vendor_user_ids, array[]::uuid[])
        || coalesce(construction_agg.vendor_user_ids, array[]::uuid[])
      ) as value
    ),
    array[]::uuid[]
  ) as vendor_user_ids,
  case
    when deal_agg.job_id is not null then 'deal'
    else quote_agg.source_document_type
  end as source_document_type,
  case
    when deal_agg.job_id is not null then null::uuid
    else quote_agg.source_document_id
  end as source_document_id
from job_ids ids
left join quote_agg on quote_agg.job_id = ids.job_id
left join deal_agg on deal_agg.job_id = ids.job_id
left join freight_agg on freight_agg.job_id = ids.job_id
left join vendor_agg on vendor_agg.job_id = ids.job_id
left join construction_job_agg on construction_job_agg.job_id = ids.job_id
left join construction_agg on construction_agg.job_id = ids.job_id;

create or replace function public.get_visible_job_directory(_allowed_states text[] default null)
returns table(
  job_id text,
  client_name text,
  job_name text,
  state text,
  sales_rep text,
  sales_rep_user_id uuid,
  estimator text,
  assigned_estimator_user_id uuid,
  assigned_freight_user_id uuid,
  dealer_user_id uuid,
  vendor_user_ids uuid[],
  source_document_type text,
  source_document_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sjd.job_id,
    sjd.client_name,
    sjd.job_name,
    sjd.state,
    sjd.sales_rep,
    sjd.sales_rep_user_id,
    sjd.estimator,
    sjd.assigned_estimator_user_id,
    sjd.assigned_freight_user_id,
    sjd.dealer_user_id,
    sjd.vendor_user_ids,
    sjd.source_document_type,
    sjd.source_document_id
  from public.shared_job_directory sjd
  where (_allowed_states is null or sjd.state = any(_allowed_states))
    and public.can_access_shared_job(
      sjd.sales_rep,
      sjd.estimator,
      sjd.dealer_user_id,
      sjd.assigned_estimator_user_id,
      sjd.assigned_freight_user_id,
      sjd.vendor_user_ids
    );
$$;

create table if not exists public.job_stream_entries (
  id uuid primary key default gen_random_uuid(),
  job_id text not null default '',
  entry_type text not null check (entry_type in ('event', 'post', 'comment')),
  event_key text,
  parent_entry_id uuid references public.job_stream_entries(id) on delete cascade,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.job_stream_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.job_stream_entries(id) on delete cascade,
  job_id text not null default '',
  file_name text not null default '',
  file_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  storage_path text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.job_stream_user_state (
  job_id text not null default '',
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

create index if not exists job_stream_entries_job_created_idx
  on public.job_stream_entries (job_id, created_at desc);
create index if not exists job_stream_entries_parent_idx
  on public.job_stream_entries (parent_entry_id, created_at asc);
create index if not exists job_stream_attachments_entry_idx
  on public.job_stream_attachments (entry_id, created_at asc);

alter table public.job_stream_entries enable row level security;
alter table public.job_stream_attachments enable row level security;
alter table public.job_stream_user_state enable row level security;

create or replace function public.can_access_job_stream(_job_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shared_job_directory sjd
    where sjd.job_id = _job_id
      and public.can_access_shared_job(
        sjd.sales_rep,
        sjd.estimator,
        sjd.dealer_user_id,
        sjd.assigned_estimator_user_id,
        sjd.assigned_freight_user_id,
        sjd.vendor_user_ids
      )
  );
$$;

create or replace function public.get_visible_job_stream_summaries()
returns table(
  job_id text,
  client_name text,
  job_name text,
  state text,
  latest_entry_id uuid,
  latest_entry_type text,
  latest_event_key text,
  latest_body text,
  latest_created_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with visible_jobs as (
    select * from public.get_visible_job_directory(null)
  ),
  latest_entries as (
    select distinct on (entry.job_id)
      entry.job_id,
      entry.id as latest_entry_id,
      entry.entry_type as latest_entry_type,
      entry.event_key as latest_event_key,
      entry.body as latest_body,
      entry.created_at as latest_created_at
    from public.job_stream_entries entry
    where entry.deleted_at is null
      and entry.parent_entry_id is null
    order by entry.job_id, entry.created_at desc, entry.id desc
  ),
  unread as (
    select
      entry.job_id,
      count(*)::bigint as unread_count
    from public.job_stream_entries entry
    left join public.job_stream_user_state state
      on state.job_id = entry.job_id
     and state.user_id = auth.uid()
    where entry.deleted_at is null
      and entry.created_by_user_id is distinct from auth.uid()
      and entry.created_at > coalesce(state.last_read_at, to_timestamp(0))
    group by entry.job_id
  )
  select
    job.job_id,
    job.client_name,
    job.job_name,
    job.state,
    latest.latest_entry_id,
    latest.latest_entry_type,
    latest.latest_event_key,
    latest.latest_body,
    latest.latest_created_at,
    coalesce(unread.unread_count, 0) as unread_count
  from visible_jobs job
  left join latest_entries latest on latest.job_id = job.job_id
  left join unread on unread.job_id = job.job_id
  order by coalesce(latest.latest_created_at, to_timestamp(0)) desc, job.job_id;
$$;

drop policy if exists "Job stream entries read" on public.job_stream_entries;
create policy "Job stream entries read"
  on public.job_stream_entries for select to authenticated
  using (public.can_access_job_stream(job_id));

drop policy if exists "Job stream entries insert" on public.job_stream_entries;
create policy "Job stream entries insert"
  on public.job_stream_entries for insert to authenticated
  with check (
    auth.uid() = created_by_user_id
    and public.can_access_job_stream(job_id)
    and (
      (entry_type in ('event', 'post') and parent_entry_id is null)
      or (entry_type = 'comment' and parent_entry_id is not null)
    )
  );

drop policy if exists "Job stream entries update own manual entries" on public.job_stream_entries;
create policy "Job stream entries update own manual entries"
  on public.job_stream_entries for update to authenticated
  using (
    auth.uid() = created_by_user_id
    and public.can_access_job_stream(job_id)
    and entry_type <> 'event'
  )
  with check (
    auth.uid() = created_by_user_id
    and public.can_access_job_stream(job_id)
    and entry_type <> 'event'
  );

drop policy if exists "Job stream attachments read" on public.job_stream_attachments;
create policy "Job stream attachments read"
  on public.job_stream_attachments for select to authenticated
  using (public.can_access_job_stream(job_id));

drop policy if exists "Job stream attachments insert" on public.job_stream_attachments;
create policy "Job stream attachments insert"
  on public.job_stream_attachments for insert to authenticated
  with check (
    auth.uid() = created_by_user_id
    and public.can_access_job_stream(job_id)
  );

drop policy if exists "Job stream attachments delete own" on public.job_stream_attachments;
create policy "Job stream attachments delete own"
  on public.job_stream_attachments for delete to authenticated
  using (
    auth.uid() = created_by_user_id
    and public.can_access_job_stream(job_id)
  );

drop policy if exists "Job stream user state read own" on public.job_stream_user_state;
create policy "Job stream user state read own"
  on public.job_stream_user_state for select to authenticated
  using (auth.uid() = user_id and public.can_access_job_stream(job_id));

drop policy if exists "Job stream user state insert own" on public.job_stream_user_state;
create policy "Job stream user state insert own"
  on public.job_stream_user_state for insert to authenticated
  with check (auth.uid() = user_id and public.can_access_job_stream(job_id));

drop policy if exists "Job stream user state update own" on public.job_stream_user_state;
create policy "Job stream user state update own"
  on public.job_stream_user_state for update to authenticated
  using (auth.uid() = user_id and public.can_access_job_stream(job_id))
  with check (auth.uid() = user_id and public.can_access_job_stream(job_id));
