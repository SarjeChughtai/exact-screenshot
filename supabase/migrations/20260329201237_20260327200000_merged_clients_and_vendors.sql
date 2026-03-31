CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  client_id text UNIQUE,
  client_name text NOT NULL DEFAULT '',
  job_ids text[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
CREATE POLICY "Authenticated full access on clients" ON public.clients
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT 'ON',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
CREATE POLICY "Authenticated full access on vendors" ON public.vendors
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Enhance payments table with client/vendor FK fields and tax override
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_override_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS vendor_province_override TEXT;;
