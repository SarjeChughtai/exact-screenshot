
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow all access to quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow all access to deals" ON public.deals;
DROP POLICY IF EXISTS "Allow all access to internal_costs" ON public.internal_costs;
DROP POLICY IF EXISTS "Allow all access to payments" ON public.payments;
DROP POLICY IF EXISTS "Allow all access to production" ON public.production;
DROP POLICY IF EXISTS "Allow all access to freight" ON public.freight;

-- Replace with authenticated-only policies
CREATE POLICY "Authenticated users can read quotes" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quotes" ON public.quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete quotes" ON public.quotes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert deals" ON public.deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update deals" ON public.deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete deals" ON public.deals FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read internal_costs" ON public.internal_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert internal_costs" ON public.internal_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update internal_costs" ON public.internal_costs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete internal_costs" ON public.internal_costs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete payments" ON public.payments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read production" ON public.production FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert production" ON public.production FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update production" ON public.production FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete production" ON public.production FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read freight" ON public.freight FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert freight" ON public.freight FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update freight" ON public.freight FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete freight" ON public.freight FOR DELETE TO authenticated USING (true);
