CREATE TABLE public.qbo_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qbo_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read qbo_tokens"
ON public.qbo_tokens FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can insert qbo_tokens"
ON public.qbo_tokens FOR INSERT TO authenticated
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can update qbo_tokens"
ON public.qbo_tokens FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));

CREATE POLICY "Admins can delete qbo_tokens"
ON public.qbo_tokens FOR DELETE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role]));