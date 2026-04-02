update public.freight
set status = 'RFQ'::public.freight_status
where mode = 'pre_sale'
  and status = 'Pending'::public.freight_status;
