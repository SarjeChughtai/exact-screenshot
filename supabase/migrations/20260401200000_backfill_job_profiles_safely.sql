with quote_seed as (
  select
    nullif(trim(job_id), '') as job_id,
    max(nullif(job_name, '')) as job_name,
    max(nullif(client_id, '')) as client_id,
    max(nullif(client_name, '')) as client_name,
    max(nullif(sales_rep, '')) as sales_rep,
    max(nullif(estimator, '')) as estimator,
    max(nullif(province, '')) as province,
    max(nullif(city, '')) as city,
    max(nullif(address, '')) as address,
    max(nullif(postal_code, '')) as postal_code,
    max(nullif(width, 0)) as width,
    max(nullif(length, 0)) as length,
    max(nullif(height, 0)) as height,
    max(nullif(substring(coalesce(payload ->> 'leftEaveHeight', payload ->> 'left_eave_height') from '[-]?[0-9]+(?:\.[0-9]+)?'), '')::numeric) as left_eave_height,
    max(nullif(substring(coalesce(payload ->> 'rightEaveHeight', payload ->> 'right_eave_height') from '[-]?[0-9]+(?:\.[0-9]+)?'), '')::numeric) as right_eave_height,
    bool_or(
      case lower(trim(coalesce(payload ->> 'singleSlope', payload ->> 'isSingleSlope', payload ->> 'is_single_slope', '')))
        when 'true' then true
        when 't' then true
        when '1' then true
        when 'yes' then true
        when 'y' then true
        when 'false' then false
        when 'f' then false
        when '0' then false
        when 'no' then false
        when 'n' then false
        else null
      end
    ) as is_single_slope,
    max(nullif(substring(coalesce(payload ->> 'pitch', payload ->> 'roofPitch', payload ->> 'roof_pitch') from '[-]?[0-9]+(?:\.[0-9]+)?'), '')::numeric) as pitch,
    max(nullif(trim(coalesce(payload ->> 'structureType', payload ->> 'structure_type')), '')) as structure_type
  from public.quotes
  where nullif(trim(job_id), '') is not null
  group by 1
), deal_seed as (
  select
    nullif(trim(job_id), '') as job_id,
    max(nullif(job_name, '')) as job_name,
    max(nullif(client_id, '')) as client_id,
    max(nullif(client_name, '')) as client_name,
    max(nullif(sales_rep, '')) as sales_rep,
    max(nullif(estimator, '')) as estimator,
    max(nullif(team_lead, '')) as team_lead,
    max(nullif(province, '')) as province,
    max(nullif(city, '')) as city,
    max(nullif(address, '')) as address,
    max(nullif(postal_code, '')) as postal_code,
    max(nullif(width, 0)) as width,
    max(nullif(length, 0)) as length,
    max(nullif(height, 0)) as height
  from public.deals
  where nullif(trim(job_id), '') is not null
  group by 1
), estimate_seed as (
  select
    nullif(trim(job_id), '') as job_id,
    max(nullif(client_id, '')) as client_id,
    max(nullif(client_name, '')) as client_name,
    max(nullif(sales_rep, '')) as sales_rep,
    max(nullif(province, '')) as province,
    max(nullif(city, '')) as city,
    max(nullif(postal_code, '')) as postal_code,
    max(nullif(width, 0)) as width,
    max(nullif(length, 0)) as length,
    max(nullif(height, 0)) as height,
    max(nullif(pitch, 0)) as pitch
  from public.estimates
  where nullif(trim(job_id), '') is not null
  group by 1
), freight_seed as (
  select
    nullif(trim(job_id), '') as job_id,
    max(nullif(client_name, '')) as client_name
  from public.freight
  where nullif(trim(job_id), '') is not null
  group by 1
), client_seed as (
  select
    nullif(trim(job_id), '') as job_id,
    max(nullif(c.client_id, '')) as client_id,
    max(nullif(c.client_name, '')) as client_name
  from public.clients c,
  lateral unnest(coalesce(c.job_ids, array[]::text[])) as job_id
  where nullif(trim(job_id), '') is not null
  group by 1
), warehouse_seed as (
  select
    job_id,
    max(job_name) as job_name,
    max(client_id) as client_id,
    max(client_name) as client_name,
    max(province) as province,
    max(city) as city,
    max(width) as width,
    max(length) as length,
    max(height) as height,
    max(pitch) as pitch,
    max(structure_type) as structure_type
  from (
    select
      nullif(trim(coalesce(job_id, project_id)), '') as job_id,
      nullif(trim(coalesce(parsed_data ->> 'job_name', parsed_data ->> 'jobName', parsed_data ->> 'project_name', parsed_data ->> 'projectName')), '') as job_name,
      nullif(trim(coalesce(parsed_data ->> 'client_id', parsed_data ->> 'clientId')), '') as client_id,
      nullif(trim(coalesce(parsed_data ->> 'client_name', parsed_data ->> 'clientName')), '') as client_name,
      nullif(trim(coalesce(parsed_data ->> 'province', parsed_data ->> 'state')), '') as province,
      nullif(trim(parsed_data ->> 'city'), '') as city,
      null::numeric as width,
      null::numeric as length,
      null::numeric as height,
      null::numeric as pitch,
      nullif(structure_type, '') as structure_type
    from public.stored_documents
    union all
    select
      nullif(trim(coalesce(job_id, project_id)), '') as job_id,
      nullif(trim(coalesce(raw_extraction ->> 'job_name', raw_extraction ->> 'jobName', raw_extraction ->> 'project_name', raw_extraction ->> 'projectName')), '') as job_name,
      nullif(trim(coalesce(raw_extraction ->> 'client_id', raw_extraction ->> 'clientId')), '') as client_id,
      nullif(trim(coalesce(raw_extraction ->> 'client_name', raw_extraction ->> 'clientName')), '') as client_name,
      nullif(trim(province), '') as province,
      nullif(trim(coalesce(raw_extraction ->> 'city', raw_extraction ->> 'location_city')), '') as city,
      nullif(width_ft, 0) as width,
      nullif(length_ft, 0) as length,
      nullif(eave_height_ft, 0) as height,
      nullif(roof_slope, 0) as pitch,
      nullif(structure_type, '') as structure_type
    from public.steel_cost_data
    union all
    select
      nullif(trim(coalesce(job_id, project_id)), '') as job_id,
      nullif(trim(coalesce(raw_extraction ->> 'job_name', raw_extraction ->> 'jobName', raw_extraction ->> 'project_name', raw_extraction ->> 'projectName')), '') as job_name,
      nullif(trim(coalesce(raw_extraction ->> 'client_id', raw_extraction ->> 'clientId')), '') as client_id,
      nullif(trim(coalesce(raw_extraction ->> 'client_name', raw_extraction ->> 'clientName')), '') as client_name,
      nullif(trim(split_part(coalesce(location, ''), ',', 1)), '') as province,
      nullif(trim(split_part(coalesce(location, ''), ',', 2)), '') as city,
      nullif(width_ft, 0) as width,
      nullif(length_ft, 0) as length,
      nullif(eave_height_ft, 0) as height,
      null::numeric as pitch,
      nullif(structure_type, '') as structure_type
    from public.insulation_cost_data
  ) seed
  where job_id is not null
  group by 1
), job_ids as (
  select job_id from quote_seed
  union
  select job_id from deal_seed
  union
  select job_id from estimate_seed
  union
  select job_id from freight_seed
  union
  select job_id from client_seed
  union
  select job_id from warehouse_seed
)
insert into public.job_profiles (
  job_id,
  job_name,
  client_id,
  client_name,
  sales_rep,
  estimator,
  team_lead,
  province,
  city,
  address,
  postal_code,
  width,
  length,
  height,
  left_eave_height,
  right_eave_height,
  is_single_slope,
  pitch,
  structure_type,
  last_source
)
select
  ids.job_id,
  coalesce(q.job_name, d.job_name, w.job_name, ''),
  coalesce(q.client_id, d.client_id, e.client_id, c.client_id, w.client_id, ''),
  coalesce(q.client_name, d.client_name, e.client_name, c.client_name, w.client_name, f.client_name, ''),
  coalesce(q.sales_rep, d.sales_rep, e.sales_rep, ''),
  coalesce(q.estimator, d.estimator, ''),
  coalesce(d.team_lead, ''),
  coalesce(q.province, d.province, e.province, w.province, ''),
  coalesce(q.city, d.city, e.city, w.city, ''),
  coalesce(q.address, d.address, ''),
  coalesce(q.postal_code, d.postal_code, e.postal_code, ''),
  coalesce(q.width, d.width, e.width, w.width, 0),
  coalesce(q.length, d.length, e.length, w.length, 0),
  coalesce(q.height, d.height, e.height, w.height, 0),
  q.left_eave_height,
  q.right_eave_height,
  q.is_single_slope,
  coalesce(q.pitch, e.pitch, w.pitch),
  coalesce(q.structure_type, w.structure_type),
  case
    when q.job_id is not null then 'quote'
    when d.job_id is not null then 'deal'
    when e.job_id is not null then 'estimate'
    when w.job_id is not null then 'warehouse'
    when c.job_id is not null then 'client'
    when f.job_id is not null then 'freight'
    else null
  end
from job_ids ids
left join quote_seed q on q.job_id = ids.job_id
left join deal_seed d on d.job_id = ids.job_id
left join estimate_seed e on e.job_id = ids.job_id
left join freight_seed f on f.job_id = ids.job_id
left join client_seed c on c.job_id = ids.job_id
left join warehouse_seed w on w.job_id = ids.job_id
where ids.job_id is not null
on conflict (job_id) do update
set job_name = coalesce(nullif(excluded.job_name, ''), public.job_profiles.job_name),
    client_id = coalesce(nullif(excluded.client_id, ''), public.job_profiles.client_id),
    client_name = coalesce(nullif(excluded.client_name, ''), public.job_profiles.client_name),
    sales_rep = coalesce(nullif(excluded.sales_rep, ''), public.job_profiles.sales_rep),
    estimator = coalesce(nullif(excluded.estimator, ''), public.job_profiles.estimator),
    team_lead = coalesce(nullif(excluded.team_lead, ''), public.job_profiles.team_lead),
    province = coalesce(nullif(excluded.province, ''), public.job_profiles.province),
    city = coalesce(nullif(excluded.city, ''), public.job_profiles.city),
    address = coalesce(nullif(excluded.address, ''), public.job_profiles.address),
    postal_code = coalesce(nullif(excluded.postal_code, ''), public.job_profiles.postal_code),
    width = case when coalesce(excluded.width, 0) <> 0 then excluded.width else public.job_profiles.width end,
    length = case when coalesce(excluded.length, 0) <> 0 then excluded.length else public.job_profiles.length end,
    height = case when coalesce(excluded.height, 0) <> 0 then excluded.height else public.job_profiles.height end,
    left_eave_height = coalesce(excluded.left_eave_height, public.job_profiles.left_eave_height),
    right_eave_height = coalesce(excluded.right_eave_height, public.job_profiles.right_eave_height),
    is_single_slope = coalesce(excluded.is_single_slope, public.job_profiles.is_single_slope),
    pitch = coalesce(excluded.pitch, public.job_profiles.pitch),
    structure_type = coalesce(nullif(excluded.structure_type, ''), public.job_profiles.structure_type),
    last_source = coalesce(excluded.last_source, public.job_profiles.last_source),
    updated_at = now();
