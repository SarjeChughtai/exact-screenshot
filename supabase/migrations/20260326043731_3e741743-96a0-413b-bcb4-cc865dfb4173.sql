
-- Create role enum matching your app's access levels
CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'accounting', 'operations', 'sales_rep', 'freight');

-- Create user_roles table (users can hold multiple roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user has ANY of the listed roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- user_roles policies: admins can manage, users can read own
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Now replace all table policies with role-based ones

-- QUOTES: readable by all authenticated, writable by admin/owner/accounting/sales_rep
DROP POLICY IF EXISTS "Authenticated users can read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can delete quotes" ON public.quotes;

CREATE POLICY "Auth users can read quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting','sales_rep','operations']::app_role[]));

CREATE POLICY "Auth users can insert quotes" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep']::app_role[]));

CREATE POLICY "Auth users can update quotes" ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep']::app_role[]));

CREATE POLICY "Admins can delete quotes" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

-- DEALS: readable by most roles, writable by admin/owner/operations
DROP POLICY IF EXISTS "Authenticated users can read deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can insert deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can update deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can delete deals" ON public.deals;

CREATE POLICY "Auth users can read deals" ON public.deals
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting','operations','sales_rep','freight']::app_role[]));

CREATE POLICY "Auth users can insert deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Auth users can update deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Admins can delete deals" ON public.deals
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

-- INTERNAL_COSTS: admin/owner/accounting/operations only
DROP POLICY IF EXISTS "Authenticated users can read internal_costs" ON public.internal_costs;
DROP POLICY IF EXISTS "Authenticated users can insert internal_costs" ON public.internal_costs;
DROP POLICY IF EXISTS "Authenticated users can update internal_costs" ON public.internal_costs;
DROP POLICY IF EXISTS "Authenticated users can delete internal_costs" ON public.internal_costs;

CREATE POLICY "Auth users can read internal_costs" ON public.internal_costs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting','operations']::app_role[]));

CREATE POLICY "Auth users can insert internal_costs" ON public.internal_costs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Auth users can update internal_costs" ON public.internal_costs
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Admins can delete internal_costs" ON public.internal_costs
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

-- PAYMENTS: admin/owner/accounting
DROP POLICY IF EXISTS "Authenticated users can read payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON public.payments;

CREATE POLICY "Auth users can read payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting']::app_role[]));

CREATE POLICY "Auth users can insert payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting']::app_role[]));

CREATE POLICY "Auth users can update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','accounting']::app_role[]));

CREATE POLICY "Admins can delete payments" ON public.payments
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

-- PRODUCTION: admin/owner/operations
DROP POLICY IF EXISTS "Authenticated users can read production" ON public.production;
DROP POLICY IF EXISTS "Authenticated users can insert production" ON public.production;
DROP POLICY IF EXISTS "Authenticated users can update production" ON public.production;
DROP POLICY IF EXISTS "Authenticated users can delete production" ON public.production;

CREATE POLICY "Auth users can read production" ON public.production
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Auth users can insert production" ON public.production
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Auth users can update production" ON public.production
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Admins can delete production" ON public.production
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

-- FREIGHT: admin/owner/operations/freight
DROP POLICY IF EXISTS "Authenticated users can read freight" ON public.freight;
DROP POLICY IF EXISTS "Authenticated users can insert freight" ON public.freight;
DROP POLICY IF EXISTS "Authenticated users can update freight" ON public.freight;
DROP POLICY IF EXISTS "Authenticated users can delete freight" ON public.freight;

CREATE POLICY "Auth users can read freight" ON public.freight
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','freight']::app_role[]));

CREATE POLICY "Auth users can insert freight" ON public.freight
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','freight']::app_role[]));

CREATE POLICY "Auth users can update freight" ON public.freight
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','freight']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','freight']::app_role[]));

CREATE POLICY "Admins can delete freight" ON public.freight
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));
