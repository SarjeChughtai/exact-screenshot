alter table if exists public.estimates
add column if not exists job_id text;

update public.estimates
set job_id = nullif(trim(coalesce(job_id, payload ->> 'jobId')), '')
where nullif(trim(coalesce(job_id, '')), '') is null
  and nullif(trim(coalesce(payload ->> 'jobId', '')), '') is not null;

create index if not exists estimates_job_id_idx
on public.estimates(job_id);
