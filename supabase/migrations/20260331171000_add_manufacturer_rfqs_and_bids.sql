-- Add 'manufacturer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manufacturer';

-- Manufacturer RFQs: posted by admin/owner/operations for manufacturers to bid on
CREATE TABLE IF NOT EXISTS public.manufacturer_rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text,
  title text NOT NULL,
  building_spec text DEFAULT '',
  width numeric DEFAULT 0,
  length numeric DEFAULT 0,
  height numeric DEFAULT 0,
  weight numeric DEFAULT 0,
  province text DEFAULT '',
  city text DEFAULT '',
  delivery_address text DEFAULT '',
  required_by_date text DEFAULT '',
  notes text DEFAULT '',
  status text DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Awarded', 'Cancelled')),
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  closing_date text DEFAULT '',
  awarded_bid_id text DEFAULT ''
);

-- Manufacturer Bids: submitted by manufacturer users on RFQs
CREATE TABLE IF NOT EXISTS public.manufacturer_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.manufacturer_rfqs(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL,
  manufacturer_name text DEFAULT '',
  price_per_lb numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  lead_time_days integer DEFAULT 0,
  notes text DEFAULT '',
  status text DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Accepted', 'Rejected', 'Withdrawn')),
  submitted_at timestamptz DEFAULT now()
);

ALTER TABLE public.manufacturer_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturer_bids ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Authenticated users full access to manufacturer_rfqs"
  ON public.manufacturer_rfqs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated users full access to manufacturer_bids"
  ON public.manufacturer_bids FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_manufacturer_rfqs_status ON public.manufacturer_rfqs(status);
CREATE INDEX IF NOT EXISTS idx_manufacturer_bids_rfq_id ON public.manufacturer_bids(rfq_id);
CREATE INDEX IF NOT EXISTS idx_manufacturer_bids_manufacturer_id ON public.manufacturer_bids(manufacturer_id);
