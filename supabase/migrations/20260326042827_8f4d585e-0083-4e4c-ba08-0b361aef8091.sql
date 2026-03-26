
-- Create enums matching TypeScript types
CREATE TYPE public.quote_status AS ENUM ('Draft', 'Sent', 'Follow Up', 'Won', 'Lost', 'Expired');
CREATE TYPE public.deal_status AS ENUM ('Lead', 'Quoted', 'Pending Payment', 'In Progress', 'In Production', 'Shipped', 'Delivered', 'Complete', 'Cancelled', 'On Hold');
CREATE TYPE public.payment_status AS ENUM ('PAID', 'PARTIAL', 'UNPAID');
CREATE TYPE public.freight_status AS ENUM ('Pending', 'Booked', 'In Transit', 'Delivered');
CREATE TYPE public.production_stage AS ENUM ('Submitted', 'Acknowledged', 'In Production', 'QC Complete', 'Ship Ready', 'Shipped', 'Delivered');
CREATE TYPE public.payment_direction AS ENUM ('Client Payment IN', 'Vendor Payment OUT', 'Refund IN', 'Refund OUT');
CREATE TYPE public.payment_type AS ENUM ('Deposit', 'Progress Payment', 'Final Payment', 'Freight', 'Insulation', 'Drawings', 'Other');
CREATE TYPE public.foundation_type AS ENUM ('slab', 'frost_wall');

-- Quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  job_id TEXT NOT NULL DEFAULT '',
  job_name TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  sales_rep TEXT NOT NULL DEFAULT '',
  estimator TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  width NUMERIC NOT NULL DEFAULT 0,
  length NUMERIC NOT NULL DEFAULT 0,
  height NUMERIC NOT NULL DEFAULT 0,
  sqft NUMERIC NOT NULL DEFAULT 0,
  weight NUMERIC NOT NULL DEFAULT 0,
  base_steel_cost NUMERIC NOT NULL DEFAULT 0,
  steel_after_12 NUMERIC NOT NULL DEFAULT 0,
  markup NUMERIC NOT NULL DEFAULT 0,
  adjusted_steel NUMERIC NOT NULL DEFAULT 0,
  engineering NUMERIC NOT NULL DEFAULT 0,
  foundation NUMERIC NOT NULL DEFAULT 0,
  foundation_type public.foundation_type NOT NULL DEFAULT 'slab',
  gutters NUMERIC NOT NULL DEFAULT 0,
  liners NUMERIC NOT NULL DEFAULT 0,
  insulation NUMERIC NOT NULL DEFAULT 0,
  insulation_grade TEXT NOT NULL DEFAULT '',
  freight NUMERIC NOT NULL DEFAULT 0,
  combined_total NUMERIC NOT NULL DEFAULT 0,
  per_sqft NUMERIC NOT NULL DEFAULT 0,
  per_lb NUMERIC NOT NULL DEFAULT 0,
  contingency_pct NUMERIC NOT NULL DEFAULT 5,
  contingency NUMERIC NOT NULL DEFAULT 0,
  gst_hst NUMERIC NOT NULL DEFAULT 0,
  qst NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  status public.quote_status NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL DEFAULT '',
  job_name TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  sales_rep TEXT NOT NULL DEFAULT '',
  estimator TEXT NOT NULL DEFAULT '',
  team_lead TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  width NUMERIC NOT NULL DEFAULT 0,
  length NUMERIC NOT NULL DEFAULT 0,
  height NUMERIC NOT NULL DEFAULT 0,
  sqft NUMERIC NOT NULL DEFAULT 0,
  weight NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_type TEXT NOT NULL DEFAULT '',
  order_type TEXT NOT NULL DEFAULT '',
  date_signed TEXT NOT NULL DEFAULT '',
  deal_status public.deal_status NOT NULL DEFAULT 'Lead',
  payment_status public.payment_status NOT NULL DEFAULT 'UNPAID',
  production_status public.production_stage NOT NULL DEFAULT 'Submitted',
  freight_status public.freight_status NOT NULL DEFAULT 'Pending',
  insulation_status TEXT NOT NULL DEFAULT '',
  delivery_date TEXT NOT NULL DEFAULT '',
  pickup_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- Internal costs table
CREATE TABLE public.internal_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.deals(job_id) ON DELETE CASCADE,
  true_material NUMERIC NOT NULL DEFAULT 0,
  true_structural_drawing NUMERIC NOT NULL DEFAULT 0,
  true_foundation_drawing NUMERIC NOT NULL DEFAULT 0,
  true_freight NUMERIC NOT NULL DEFAULT 0,
  true_insulation NUMERIC NOT NULL DEFAULT 0,
  rep_material NUMERIC NOT NULL DEFAULT 0,
  rep_structural_drawing NUMERIC NOT NULL DEFAULT 0,
  rep_foundation_drawing NUMERIC NOT NULL DEFAULT 0,
  rep_freight NUMERIC NOT NULL DEFAULT 0,
  rep_insulation NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  show_rep_costs BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  job_id TEXT NOT NULL DEFAULT '',
  client_vendor_name TEXT NOT NULL DEFAULT '',
  direction public.payment_direction NOT NULL DEFAULT 'Client Payment IN',
  type public.payment_type NOT NULL DEFAULT 'Deposit',
  amount_excl_tax NUMERIC NOT NULL DEFAULT 0,
  province TEXT NOT NULL DEFAULT '',
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_incl_tax NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT '',
  reference_number TEXT NOT NULL DEFAULT '',
  qb_synced BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production table
CREATE TABLE public.production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.deals(job_id) ON DELETE CASCADE,
  submitted BOOLEAN NOT NULL DEFAULT false,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  in_production BOOLEAN NOT NULL DEFAULT false,
  qc_complete BOOLEAN NOT NULL DEFAULT false,
  ship_ready BOOLEAN NOT NULL DEFAULT false,
  shipped BOOLEAN NOT NULL DEFAULT false,
  delivered BOOLEAN NOT NULL DEFAULT false,
  drawings_status TEXT NOT NULL DEFAULT '',
  insulation_status TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- Freight table
CREATE TABLE public.freight (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES public.deals(job_id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  building_size TEXT NOT NULL DEFAULT '',
  weight NUMERIC NOT NULL DEFAULT 0,
  pickup_address TEXT NOT NULL DEFAULT '',
  delivery_address TEXT NOT NULL DEFAULT '',
  est_distance NUMERIC NOT NULL DEFAULT 0,
  est_freight NUMERIC NOT NULL DEFAULT 0,
  actual_freight NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  carrier TEXT NOT NULL DEFAULT '',
  status public.freight_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

-- RLS: Allow all authenticated users full access for now (auth not yet implemented)
-- We'll use permissive policies that allow everything until auth is added

CREATE POLICY "Allow all access to quotes" ON public.quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to deals" ON public.deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to internal_costs" ON public.internal_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to production" ON public.production FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to freight" ON public.freight FOR ALL USING (true) WITH CHECK (true);
