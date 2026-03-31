DROP POLICY IF EXISTS "Authenticated users full access to manufacturer_rfqs" ON public.manufacturer_rfqs;
DROP POLICY IF EXISTS "Authenticated users full access to manufacturer_bids" ON public.manufacturer_bids;

DROP POLICY IF EXISTS "Manufacturer RFQs read" ON public.manufacturer_rfqs;
CREATE POLICY "Manufacturer RFQs read"
  ON public.manufacturer_rfqs
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','accounting']::app_role[])
    OR (
      public.has_role(auth.uid(), 'manufacturer'::app_role)
      AND (
        status = 'Open'
        OR EXISTS (
          SELECT 1
          FROM public.manufacturer_bids mb
          WHERE mb.rfq_id = id
            AND mb.manufacturer_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Manufacturer RFQs insert" ON public.manufacturer_rfqs;
CREATE POLICY "Manufacturer RFQs insert"
  ON public.manufacturer_rfqs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

DROP POLICY IF EXISTS "Manufacturer RFQs update" ON public.manufacturer_rfqs;
CREATE POLICY "Manufacturer RFQs update"
  ON public.manufacturer_rfqs
  FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

DROP POLICY IF EXISTS "Manufacturer RFQs delete" ON public.manufacturer_rfqs;
CREATE POLICY "Manufacturer RFQs delete"
  ON public.manufacturer_rfqs
  FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

DROP POLICY IF EXISTS "Manufacturer bids read" ON public.manufacturer_bids;
CREATE POLICY "Manufacturer bids read"
  ON public.manufacturer_bids
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','accounting']::app_role[])
    OR manufacturer_id = auth.uid()
  );

DROP POLICY IF EXISTS "Manufacturer bids insert" ON public.manufacturer_bids;
CREATE POLICY "Manufacturer bids insert"
  ON public.manufacturer_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    manufacturer_id = auth.uid()
    AND public.has_role(auth.uid(), 'manufacturer'::app_role)
  );

DROP POLICY IF EXISTS "Manufacturer bids update" ON public.manufacturer_bids;
CREATE POLICY "Manufacturer bids update"
  ON public.manufacturer_bids
  FOR UPDATE
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
    OR (
      manufacturer_id = auth.uid()
      AND public.has_role(auth.uid(), 'manufacturer'::app_role)
    )
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
    OR (
      manufacturer_id = auth.uid()
      AND public.has_role(auth.uid(), 'manufacturer'::app_role)
    )
  );

DROP POLICY IF EXISTS "Manufacturer bids delete" ON public.manufacturer_bids;
CREATE POLICY "Manufacturer bids delete"
  ON public.manufacturer_bids
  FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));
