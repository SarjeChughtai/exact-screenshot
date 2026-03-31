ALTER TABLE public.quote_files
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS parse_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS corrected_data jsonb DEFAULT NULL;;
