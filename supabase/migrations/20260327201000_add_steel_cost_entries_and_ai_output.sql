-- Add ai_output column to quote_files to record raw AI extraction result
ALTER TABLE quote_files ADD COLUMN IF NOT EXISTS ai_output jsonb;
ALTER TABLE quote_files ADD COLUMN IF NOT EXISTS extraction_source text NOT NULL DEFAULT 'unknown'
  CHECK (extraction_source IN ('ai', 'regex', 'unknown'));

-- Steel cost entries: historical database of extracted steel cost data from supplier PDFs
CREATE TABLE IF NOT EXISTS steel_cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_file_id uuid REFERENCES quote_files(id) ON DELETE SET NULL,
  job_id text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  client_id text NOT NULL DEFAULT '',
  building_label text NOT NULL DEFAULT 'Building 1',
  document_type text NOT NULL DEFAULT 'unknown',
  file_name text NOT NULL DEFAULT '',
  weight_lbs numeric NOT NULL DEFAULT 0,
  cost_per_lb numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  width numeric,
  length numeric,
  height numeric,
  roof_pitch numeric,
  province text,
  city text,
  components jsonb DEFAULT '[]'::jsonb,
  insulation_total numeric NOT NULL DEFAULT 0,
  insulation_grade text,
  extraction_source text NOT NULL DEFAULT 'ai' CHECK (extraction_source IN ('ai', 'regex')),
  ai_raw_output jsonb,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for steel_cost_entries
ALTER TABLE steel_cost_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view steel cost entries"
  ON steel_cost_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert steel cost entries"
  ON steel_cost_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update steel cost entries"
  ON steel_cost_entries FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete steel cost entries"
  ON steel_cost_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);
