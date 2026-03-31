-- Drop the overly specific manufacturer tables that were empty
DROP TABLE IF EXISTS public.manufacturer_bids CASCADE;
DROP TABLE IF EXISTS public.manufacturer_rfqs CASCADE;

-- Create generic vendor jobs
CREATE TABLE IF NOT EXISTS public.vendor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('freight', 'manufacturer', 'construction')),
  job_id text,
  description text DEFAULT '',
  specifications jsonb DEFAULT '{}'::jsonb,
  required_by_date text DEFAULT '',
  closing_date text DEFAULT '',
  status text DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Awarded', 'Cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  awarded_bid_id uuid
);

-- Create generic vendor bids
CREATE TABLE IF NOT EXISTS public.vendor_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.vendor_jobs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  lead_time_days integer DEFAULT 0,
  details text DEFAULT '',
  status text DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Accepted', 'Rejected', 'Withdrawn')),
  submitted_at timestamptz DEFAULT now()
);

-- Note: Circular FK conceptually since vendor_jobs.awarded_bid_id points to vendor_bids.id
ALTER TABLE public.vendor_jobs ADD CONSTRAINT fk_awarded_bid FOREIGN KEY (awarded_bid_id) REFERENCES public.vendor_bids(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.vendor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bids ENABLE ROW LEVEL SECURITY;

-- vendor_jobs Policies
DO $$ BEGIN
CREATE POLICY "Internal full access vendor_jobs"
  ON public.vendor_jobs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Vendors can view open matching jobs"
  ON public.vendor_jobs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'freight'::app_role) AND category = 'freight' OR
    has_role(auth.uid(), 'manufacturer'::app_role) AND category = 'manufacturer' OR
    has_role(auth.uid(), 'construction'::app_role) AND category = 'construction'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- vendor_bids Policies
DO $$ BEGIN
CREATE POLICY "Internal full access vendor_bids"
  ON public.vendor_bids FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'operations'::app_role, 'accounting'::app_role, 'sales_rep'::app_role]));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Vendors can view own bids"
  ON public.vendor_bids FOR SELECT TO authenticated
  USING (vendor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Vendors can insert own bids"
  ON public.vendor_bids FOR INSERT TO authenticated
  WITH CHECK (vendor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Vendors can update own bids"
  ON public.vendor_bids FOR UPDATE TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;;
