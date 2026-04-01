do $$
begin
  if not exists (
    select 1
    from pg_enum enum_values
    join pg_type enum_types on enum_values.enumtypid = enum_types.oid
    where enum_types.typname = 'foundation_type'
      and enum_values.enumlabel = 'none'
  ) then
    alter type public.foundation_type add value 'none';
  end if;
end
$$;

alter table public.stored_documents
  add column if not exists structure_type text;

alter table public.steel_cost_data
  add column if not exists structure_type text;

alter table public.insulation_cost_data
  add column if not exists structure_type text;

update public.stored_documents
set job_id = nullif(trim(coalesce(job_id, project_id)), '')
where nullif(trim(coalesce(job_id, '')), '') is null
  and nullif(trim(coalesce(project_id, '')), '') is not null;

update public.steel_cost_data
set job_id = nullif(trim(coalesce(job_id, project_id)), '')
where nullif(trim(coalesce(job_id, '')), '') is null
  and nullif(trim(coalesce(project_id, '')), '') is not null;

update public.insulation_cost_data
set job_id = nullif(trim(coalesce(job_id, project_id)), '')
where nullif(trim(coalesce(job_id, '')), '') is null
  and nullif(trim(coalesce(project_id, '')), '') is not null;

update public.stored_documents
set structure_type = 'steel_building'
where nullif(trim(coalesce(structure_type, '')), '') is null;

update public.steel_cost_data
set structure_type = 'steel_building'
where nullif(trim(coalesce(structure_type, '')), '') is null;

update public.insulation_cost_data
set structure_type = 'steel_building'
where nullif(trim(coalesce(structure_type, '')), '') is null;

alter table public.stored_documents
  alter column structure_type set default 'steel_building';
alter table public.stored_documents
  alter column structure_type set not null;
alter table public.stored_documents
  drop constraint if exists stored_documents_structure_type_check;
alter table public.stored_documents
  add constraint stored_documents_structure_type_check
  check (structure_type in ('steel_building', 'container_cover', 'canopy', 'other'));

alter table public.steel_cost_data
  alter column structure_type set default 'steel_building';
alter table public.steel_cost_data
  alter column structure_type set not null;
alter table public.steel_cost_data
  drop constraint if exists steel_cost_data_structure_type_check;
alter table public.steel_cost_data
  add constraint steel_cost_data_structure_type_check
  check (structure_type in ('steel_building', 'container_cover', 'canopy', 'other'));

alter table public.insulation_cost_data
  alter column structure_type set default 'steel_building';
alter table public.insulation_cost_data
  alter column structure_type set not null;
alter table public.insulation_cost_data
  drop constraint if exists insulation_cost_data_structure_type_check;
alter table public.insulation_cost_data
  add constraint insulation_cost_data_structure_type_check
  check (structure_type in ('steel_building', 'container_cover', 'canopy', 'other'));

create index if not exists stored_documents_structure_type_idx
  on public.stored_documents (structure_type);

create index if not exists steel_cost_data_structure_type_idx
  on public.steel_cost_data (structure_type);

create index if not exists insulation_cost_data_structure_type_idx
  on public.insulation_cost_data (structure_type);
