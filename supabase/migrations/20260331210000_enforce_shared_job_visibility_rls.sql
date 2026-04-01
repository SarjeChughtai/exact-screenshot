CREATE OR REPLACE FUNCTION public.can_access_job_id(_job_id text)
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
      OR EXISTS (
        SELECT 1
        FROM public.shared_job_directory sjd
        WHERE sjd.job_id = _job_id
          AND public.can_access_shared_job(
            sjd.sales_rep,
            sjd.estimator,
            sjd.dealer_user_id,
            sjd.assigned_estimator_user_id,
            sjd.assigned_freight_user_id,
            sjd.vendor_user_ids
          )
      )
    );
$$;

DROP POLICY IF EXISTS "Shared job visibility on quotes" ON public.quotes;
CREATE POLICY "Shared job visibility on quotes"
  ON public.quotes
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Shared job visibility on deals" ON public.deals;
CREATE POLICY "Shared job visibility on deals"
  ON public.deals
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Shared job visibility on internal costs" ON public.internal_costs;
CREATE POLICY "Shared job visibility on internal costs"
  ON public.internal_costs
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Shared job visibility on payments" ON public.payments;
CREATE POLICY "Shared job visibility on payments"
  ON public.payments
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Shared job visibility on production" ON public.production;
CREATE POLICY "Shared job visibility on production"
  ON public.production
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Role-aware freight read" ON public.freight;
DROP POLICY IF EXISTS "Shared job visibility on freight" ON public.freight;
CREATE POLICY "Shared job visibility on freight"
  ON public.freight
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Role-aware vendor jobs read" ON public.vendor_jobs;
DROP POLICY IF EXISTS "Shared job visibility on vendor jobs" ON public.vendor_jobs;
CREATE POLICY "Shared job visibility on vendor jobs"
  ON public.vendor_jobs
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));

DROP POLICY IF EXISTS "Role-aware vendor bids read" ON public.vendor_bids;
DROP POLICY IF EXISTS "Shared job visibility on vendor bids" ON public.vendor_bids;
CREATE POLICY "Shared job visibility on vendor bids"
  ON public.vendor_bids
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','accounting']::app_role[])
    OR vendor_id = auth.uid()
  );

DROP POLICY IF EXISTS "Role-aware bid events read" ON public.vendor_bid_events;
DROP POLICY IF EXISTS "Shared job visibility on vendor bid events" ON public.vendor_bid_events;
CREATE POLICY "Shared job visibility on vendor bid events"
  ON public.vendor_bid_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','accounting']::app_role[])
    OR EXISTS (
      SELECT 1
      FROM public.vendor_bids vb
      WHERE vb.id = bid_id
        AND vb.vendor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Commission payouts read" ON public.commission_payouts;
DROP POLICY IF EXISTS "Shared job visibility on commission payouts" ON public.commission_payouts;
CREATE POLICY "Shared job visibility on commission payouts"
  ON public.commission_payouts
  FOR SELECT
  TO authenticated
  USING (public.can_access_job_id(job_id));
