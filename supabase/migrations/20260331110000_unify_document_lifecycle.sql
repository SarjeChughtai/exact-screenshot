ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'estimator';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE public.document_type AS ENUM ('rfq', 'dealer_rfq', 'internal_quote', 'external_quote');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_status') THEN
    CREATE TYPE public.workflow_status AS ENUM (
      'draft',
      'submitted',
      'estimate_needed',
      'estimating',
      'estimate_complete',
      'internal_quote_in_progress',
      'internal_quote_ready',
      'external_quote_ready',
      'quote_sent',
      'won',
      'lost',
      'converted_to_deal',
      'cancelled'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.job_registry (
  id integer PRIMARY KEY CHECK (id = 1),
  next_job_id integer NOT NULL DEFAULT 1200,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.job_registry (id, next_job_id)
VALUES (1, 1200)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.allocate_job_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_next integer;
BEGIN
  INSERT INTO public.job_registry (id, next_job_id)
  VALUES (1, 1200)
  ON CONFLICT (id) DO NOTHING;

  SELECT next_job_id
  INTO current_next
  FROM public.job_registry
  WHERE id = 1
  FOR UPDATE;

  IF current_next IS NULL THEN
    current_next := 1200;
  END IF;

  IF current_next > 9999 THEN
    RAISE EXCEPTION 'Job ID allocation exhausted at 9999';
  END IF;

  UPDATE public.job_registry
  SET next_job_id = current_next + 1,
      updated_at = now()
  WHERE id = 1;

  RETURN lpad(current_next::text, 4, '0');
END;
$$;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS document_type public.document_type,
  ADD COLUMN IF NOT EXISTS workflow_status public.workflow_status,
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_estimator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_operations_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdf_storage_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_file_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.quotes
SET document_type = CASE WHEN status = 'Sent' THEN 'rfq'::public.document_type ELSE 'external_quote'::public.document_type END
WHERE document_type IS NULL;

UPDATE public.quotes
SET workflow_status = CASE
  WHEN status = 'Draft' THEN 'draft'::public.workflow_status
  WHEN status = 'Sent' THEN 'estimate_needed'::public.workflow_status
  WHEN status = 'Follow Up' THEN 'external_quote_ready'::public.workflow_status
  WHEN status = 'Won' THEN 'won'::public.workflow_status
  WHEN status = 'Lost' THEN 'lost'::public.workflow_status
  WHEN status = 'Expired' THEN 'cancelled'::public.workflow_status
  ELSE 'draft'::public.workflow_status
END
WHERE workflow_status IS NULL;

ALTER TABLE public.quotes
  ALTER COLUMN document_type SET DEFAULT 'external_quote',
  ALTER COLUMN document_type SET NOT NULL,
  ALTER COLUMN workflow_status SET DEFAULT 'draft',
  ALTER COLUMN workflow_status SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  client_id text NOT NULL DEFAULT '',
  sales_rep text NOT NULL DEFAULT '',
  width numeric NOT NULL DEFAULT 0,
  length numeric NOT NULL DEFAULT 0,
  height numeric NOT NULL DEFAULT 0,
  pitch numeric NOT NULL DEFAULT 0,
  province text NOT NULL DEFAULT 'ON',
  grand_total numeric NOT NULL DEFAULT 0,
  sqft numeric NOT NULL DEFAULT 0,
  estimated_total numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  audit_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_files
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_category text NOT NULL DEFAULT 'support_file';

ALTER TABLE public.quote_files
  DROP CONSTRAINT IF EXISTS quote_files_file_category_check;

ALTER TABLE public.quote_files
  ADD CONSTRAINT quote_files_file_category_check
  CHECK (file_category IN ('generated_pdf', 'cost_file', 'support_file'));

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  email_notifications boolean NOT NULL DEFAULT true,
  sms_notifications boolean NOT NULL DEFAULT false,
  can_view_all_freight_board boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.app_settings (key, value)
VALUES
  ('deal_statuses', '["Lead","Quoted","Pending Payment","In Progress","In Production","Shipped","Delivered","Complete","Cancelled","On Hold"]'::jsonb),
  ('client_payment_statuses', '["1st Deposit","2nd Production","3rd Delivery"]'::jsonb),
  ('factory_payment_statuses', '["1st Deposit","2nd Production","3rd Delivery"]'::jsonb),
  ('production_statuses', '["Drawings to be Signed","MBS File Requested","Sent to Engineering","Drawings Stamped","Sent to Production","Ready for Pickup","Delivered"]'::jsonb),
  ('insulation_statuses', '["Requested","Ordered","Delivered","N/A"]'::jsonb),
  ('freight_statuses', '["RFQ","Quoted","Booked","Delivered"]'::jsonb),
  ('pricing', '{"supplierIncreasePct":12,"minimumMargin":3000,"minimumMarginThreshold":30000,"drawingsMarkup":500,"internalMarginOnEstimator":5,"frostWallMultiplier":1.65,"gutterPerLF":10,"linerPerSqft":3.25,"freightBaseRate":4,"freightMinimum":4000,"showMarkupOnEstimator":true}'::jsonb),
  ('internal_markup_tiers', '[{"threshold":30000,"rate":0.20},{"threshold":60000,"rate":0.15},{"threshold":100000,"rate":0.12},{"threshold":150000,"rate":0.10},{"threshold":200000,"rate":0.08},{"threshold":"Infinity","rate":0.05}]'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS cx_payment_stage_override text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS factory_payment_stage_override text NOT NULL DEFAULT '';

ALTER TABLE public.freight
  ADD COLUMN IF NOT EXISTS assigned_freight_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS province text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.vendor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'materials',
  description text,
  specifications jsonb,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_by_date text,
  closing_date text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  awarded_bid_id uuid
);

CREATE TABLE IF NOT EXISTS public.vendor_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.vendor_jobs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  amount numeric,
  lead_time_days integer,
  details text,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'vendor_jobs'
      AND constraint_name = 'fk_awarded_bid'
  ) THEN
    ALTER TABLE public.vendor_jobs
      ADD CONSTRAINT fk_awarded_bid
      FOREIGN KEY (awarded_bid_id) REFERENCES public.vendor_bids(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.vendor_bid_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.vendor_bids(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  previous_values jsonb,
  next_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

UPDATE public.vendor_bids
SET status = CASE lower(coalesce(status, 'submitted'))
  WHEN 'submitted' THEN 'submitted'
  WHEN 'updated' THEN 'updated'
  WHEN 'cancelled' THEN 'cancelled'
  WHEN 'awarded' THEN 'awarded'
  WHEN 'accepted' THEN 'awarded'
  WHEN 'rejected' THEN 'rejected'
  WHEN 'withdrawn' THEN 'cancelled'
  ELSE 'submitted'
END;

ALTER TABLE public.vendor_bids
  DROP CONSTRAINT IF EXISTS vendor_bids_status_check;

ALTER TABLE public.vendor_bids
  ADD CONSTRAINT vendor_bids_status_check
  CHECK (status IN ('submitted', 'updated', 'cancelled', 'awarded', 'rejected'));

ALTER TABLE public.vendor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_freight_row(_assigned_freight_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
    OR (
      public.has_role(auth.uid(), 'freight')
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.user_id = auth.uid()
            AND up.can_view_all_freight_board = true
        )
        OR _assigned_freight_user_id = auth.uid()
      )
    );
$$;

DROP POLICY IF EXISTS "Auth users can read freight" ON public.freight;
DROP POLICY IF EXISTS "Auth users can insert freight" ON public.freight;
DROP POLICY IF EXISTS "Auth users can update freight" ON public.freight;
DROP POLICY IF EXISTS "Admins can delete freight" ON public.freight;

CREATE POLICY "Role-aware freight read"
  ON public.freight FOR SELECT
  TO authenticated
  USING (public.can_view_freight_row(assigned_freight_user_id));

CREATE POLICY "Role-aware freight insert"
  ON public.freight FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
    OR (
      public.has_role(auth.uid(), 'freight')
      AND assigned_freight_user_id = auth.uid()
    )
  );

CREATE POLICY "Role-aware freight update"
  ON public.freight FOR UPDATE
  TO authenticated
  USING (public.can_view_freight_row(assigned_freight_user_id))
  WITH CHECK (public.can_view_freight_row(assigned_freight_user_id));

CREATE POLICY "Role-aware freight delete"
  ON public.freight FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

CREATE POLICY "Users can read their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[])
  );

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[])
  );

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[])
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[])
  );

CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can write app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner']::app_role[]));

CREATE POLICY "Role-aware estimates read"
  ON public.estimates FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep','operations','estimator','dealer']::app_role[]));

CREATE POLICY "Role-aware estimates insert"
  ON public.estimates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep','operations','estimator','dealer']::app_role[]));

CREATE POLICY "Role-aware estimates update"
  ON public.estimates FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep','operations','estimator','dealer']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','sales_rep','operations','estimator','dealer']::app_role[]));

CREATE POLICY "Role-aware vendor jobs read"
  ON public.vendor_jobs FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','freight','manufacturer','construction']::app_role[]));

CREATE POLICY "Operations manage vendor jobs"
  ON public.vendor_jobs FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Role-aware vendor bids read"
  ON public.vendor_bids FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
    OR vendor_id = auth.uid()
  );

CREATE POLICY "Vendors insert bids"
  ON public.vendor_bids FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['freight','manufacturer','construction']::app_role[])
  );

CREATE POLICY "Vendors update own bids"
  ON public.vendor_bids FOR UPDATE
  TO authenticated
  USING (
    vendor_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
  )
  WITH CHECK (
    vendor_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[])
  );

CREATE POLICY "Role-aware bid events read"
  ON public.vendor_bid_events FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','owner','operations']::app_role[]));

CREATE POLICY "Role-aware bid events insert"
  ON public.vendor_bid_events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','owner','operations','freight','manufacturer','construction']::app_role[])
  );
