CREATE OR REPLACE FUNCTION public.normalize_job_assignment_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(value, ''))), '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.current_user_job_display_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_job_assignment_name(directory.display_name)
  FROM public.get_user_directory(ARRAY[auth.uid()]) directory
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_shared_job(
  _sales_rep text,
  _estimator text,
  _dealer_user_id uuid,
  _assigned_estimator_user_id uuid,
  _assigned_freight_user_id uuid,
  _vendor_user_ids uuid[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','accounting']::app_role[])
      OR (
        public.has_role(auth.uid(), 'sales_rep'::app_role)
        AND public.normalize_job_assignment_name(_sales_rep) = public.current_user_job_display_name()
      )
      OR (
        public.has_role(auth.uid(), 'estimator'::app_role)
        AND (
          _assigned_estimator_user_id = auth.uid()
          OR public.normalize_job_assignment_name(_estimator) = public.current_user_job_display_name()
        )
      )
      OR (
        public.has_role(auth.uid(), 'freight'::app_role)
        AND _assigned_freight_user_id = auth.uid()
      )
      OR (
        public.has_role(auth.uid(), 'dealer'::app_role)
        AND _dealer_user_id = auth.uid()
      )
      OR (
        public.has_any_role(auth.uid(), ARRAY['manufacturer','construction']::app_role[])
        AND auth.uid() = ANY(coalesce(_vendor_user_ids, ARRAY[]::uuid[]))
      )
    );
$$;

CREATE OR REPLACE VIEW public.shared_job_directory AS
WITH quote_agg AS (
  SELECT
    q.job_id,
    max(nullif(q.client_name, '')) AS client_name,
    max(nullif(q.job_name, '')) AS job_name,
    max(nullif(q.sales_rep, '')) AS sales_rep,
    max(nullif(q.estimator, '')) AS estimator,
    max(q.assigned_estimator_user_id) AS assigned_estimator_user_id,
    max(q.created_by_user_id) FILTER (WHERE q.document_type = 'dealer_rfq') AS dealer_user_id,
    max(
      CASE q.document_type
        WHEN 'external_quote' THEN 3
        WHEN 'internal_quote' THEN 2
        WHEN 'dealer_rfq' THEN 1
        WHEN 'rfq' THEN 1
        ELSE 0
      END
    ) AS state_rank,
    (
      array_agg(
        q.document_type::text
        ORDER BY
          CASE q.document_type
            WHEN 'external_quote' THEN 3
            WHEN 'internal_quote' THEN 2
            WHEN 'dealer_rfq' THEN 1
            WHEN 'rfq' THEN 1
            ELSE 0
          END DESC,
          q.updated_at DESC NULLS LAST,
          q.created_at DESC NULLS LAST
      )
    )[1] AS source_document_type,
    (
      array_agg(
        q.id
        ORDER BY
          CASE q.document_type
            WHEN 'external_quote' THEN 3
            WHEN 'internal_quote' THEN 2
            WHEN 'dealer_rfq' THEN 1
            WHEN 'rfq' THEN 1
            ELSE 0
          END DESC,
          q.updated_at DESC NULLS LAST,
          q.created_at DESC NULLS LAST
      )
    )[1] AS source_document_id
  FROM public.quotes q
  WHERE coalesce(q.job_id, '') <> ''
  GROUP BY q.job_id
),
deal_agg AS (
  SELECT
    d.job_id,
    max(nullif(d.client_name, '')) AS client_name,
    max(nullif(d.job_name, '')) AS job_name,
    max(nullif(d.sales_rep, '')) AS sales_rep,
    max(nullif(d.estimator, '')) AS estimator
  FROM public.deals d
  WHERE coalesce(d.job_id, '') <> ''
  GROUP BY d.job_id
),
freight_agg AS (
  SELECT
    f.job_id,
    max(f.assigned_freight_user_id) AS assigned_freight_user_id
  FROM public.freight f
  WHERE coalesce(f.job_id, '') <> ''
  GROUP BY f.job_id
),
vendor_agg AS (
  SELECT
    vj.job_id,
    array_remove(array_agg(DISTINCT vb.vendor_id), NULL) AS vendor_user_ids
  FROM public.vendor_jobs vj
  LEFT JOIN public.vendor_bids vb ON vb.job_id = vj.id
  WHERE coalesce(vj.job_id, '') <> ''
  GROUP BY vj.job_id
),
job_ids AS (
  SELECT job_id FROM quote_agg
  UNION
  SELECT job_id FROM deal_agg
  UNION
  SELECT job_id FROM freight_agg
  UNION
  SELECT job_id FROM vendor_agg
)
SELECT
  ids.job_id,
  coalesce(deal_agg.client_name, quote_agg.client_name, '') AS client_name,
  coalesce(deal_agg.job_name, quote_agg.job_name, '') AS job_name,
  CASE
    WHEN deal_agg.job_id IS NOT NULL THEN 'deal'
    WHEN quote_agg.state_rank = 3 THEN 'external_quote'
    WHEN quote_agg.state_rank = 2 THEN 'internal_quote'
    WHEN quote_agg.state_rank = 1 THEN 'rfq'
    ELSE 'estimate'
  END AS state,
  coalesce(deal_agg.sales_rep, quote_agg.sales_rep, '') AS sales_rep,
  NULL::uuid AS sales_rep_user_id,
  coalesce(deal_agg.estimator, quote_agg.estimator, '') AS estimator,
  quote_agg.assigned_estimator_user_id,
  freight_agg.assigned_freight_user_id,
  quote_agg.dealer_user_id,
  coalesce(vendor_agg.vendor_user_ids, ARRAY[]::uuid[]) AS vendor_user_ids,
  CASE
    WHEN deal_agg.job_id IS NOT NULL THEN 'deal'
    ELSE quote_agg.source_document_type
  END AS source_document_type,
  CASE
    WHEN deal_agg.job_id IS NOT NULL THEN NULL::uuid
    ELSE quote_agg.source_document_id
  END AS source_document_id
FROM job_ids ids
LEFT JOIN quote_agg ON quote_agg.job_id = ids.job_id
LEFT JOIN deal_agg ON deal_agg.job_id = ids.job_id
LEFT JOIN freight_agg ON freight_agg.job_id = ids.job_id
LEFT JOIN vendor_agg ON vendor_agg.job_id = ids.job_id;

CREATE OR REPLACE FUNCTION public.get_visible_job_directory(_allowed_states text[] DEFAULT NULL)
RETURNS TABLE(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
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
  FROM public.shared_job_directory sjd
  WHERE (_allowed_states IS NULL OR sjd.state = ANY(_allowed_states))
    AND public.can_access_shared_job(
      sjd.sales_rep,
      sjd.estimator,
      sjd.dealer_user_id,
      sjd.assigned_estimator_user_id,
      sjd.assigned_freight_user_id,
      sjd.vendor_user_ids
    );
$$;
