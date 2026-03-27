-- GHL Contacts table
CREATE TABLE public.ghl_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_id text UNIQUE NOT NULL,
  name text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  company text DEFAULT '',
  tags text[] DEFAULT '{}',
  raw_data jsonb DEFAULT '{}',
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE public.ghl_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ghl_contacts" ON public.ghl_contacts
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can insert ghl_contacts" ON public.ghl_contacts
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can update ghl_contacts" ON public.ghl_contacts
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can delete ghl_contacts" ON public.ghl_contacts
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

-- GHL Opportunities table
CREATE TABLE public.ghl_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_id text UNIQUE NOT NULL,
  name text DEFAULT '',
  pipeline_name text DEFAULT '',
  stage_name text DEFAULT '',
  status text DEFAULT '',
  monetary_value numeric DEFAULT 0,
  contact_ghl_id text DEFAULT '',
  raw_data jsonb DEFAULT '{}',
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE public.ghl_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ghl_opportunities" ON public.ghl_opportunities
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can insert ghl_opportunities" ON public.ghl_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can update ghl_opportunities" ON public.ghl_opportunities
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can delete ghl_opportunities" ON public.ghl_opportunities
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));