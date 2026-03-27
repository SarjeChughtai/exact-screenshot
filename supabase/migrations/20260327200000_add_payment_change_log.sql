-- Create payment_change_log table to track who changed a payment and what changed
CREATE TABLE public.payment_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT 'UPDATE',
  summary TEXT NOT NULL DEFAULT '',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by payment_id
CREATE INDEX payment_change_log_payment_id_idx ON public.payment_change_log (payment_id);

-- RLS
ALTER TABLE public.payment_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated access to payment_change_log"
  ON public.payment_change_log FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
