alter type public.freight_status add value if not exists 'RFQ';
alter type public.freight_status add value if not exists 'Quoted';

alter table public.freight
  add column if not exists moffett_included boolean not null default false;
