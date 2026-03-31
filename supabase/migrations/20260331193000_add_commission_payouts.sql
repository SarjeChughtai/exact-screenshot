CREATE TABLE IF NOT EXISTS public.commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL REFERENCES public.deals(job_id) ON DELETE CASCADE,
  recipient_role text NOT NULL CHECK (recipient_role IN ('sales_rep', 'estimator')),
  recipient_name text NOT NULL DEFAULT '',
  payout_stage text NOT NULL CHECK (payout_stage IN ('sales_rep_stage_1', 'sales_rep_stage_2', 'sales_rep_stage_3', 'estimator_stage_2')),
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  eligible_on_date date,
  paid_on date NOT NULL,
  payment_method text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  confirmed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_payouts_unique_stage UNIQUE (job_id, recipient_role, payout_stage)
);

CREATE INDEX IF NOT EXISTS idx_commission_payouts_job_id
  ON public.commission_payouts (job_id);

CREATE INDEX IF NOT EXISTS idx_commission_payouts_recipient
  ON public.commission_payouts (recipient_role, recipient_name);

ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commission payouts read"
ON public.commission_payouts
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]));

CREATE POLICY "Commission payouts insert"
ON public.commission_payouts
FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]));

CREATE POLICY "Commission payouts update"
ON public.commission_payouts
FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'accounting'::app_role))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]));

CREATE POLICY "Commission payouts delete"
ON public.commission_payouts
FOR DELETE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'owner'::app_role, 'accounting'::app_role]));
