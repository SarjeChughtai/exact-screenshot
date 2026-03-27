-- AI Provider Settings: stores user's AI API configuration
CREATE TABLE IF NOT EXISTS ai_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openrouter',
  api_key text NOT NULL DEFAULT '',
  base_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Cost Data: imported cost line items
CREATE TABLE IF NOT EXISTS cost_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  vendor text NOT NULL DEFAULT '',
  date date,
  source_document text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Import History: tracks each import operation
CREATE TABLE IF NOT EXISTS import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL DEFAULT '',
  provider_used text NOT NULL DEFAULT '',
  items_imported integer NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE ai_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- ai_provider_settings: users can manage their own settings
CREATE POLICY "Users can view own AI settings"
  ON ai_provider_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI settings"
  ON ai_provider_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI settings"
  ON ai_provider_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- cost_data: all authenticated users can view, only importers can insert
CREATE POLICY "Authenticated users can view cost data"
  ON cost_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cost data"
  ON cost_data FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = imported_by);

CREATE POLICY "Authenticated users can update cost data"
  ON cost_data FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete cost data"
  ON cost_data FOR DELETE
  TO authenticated
  USING (auth.uid() = imported_by);

-- import_history: users can view all, insert their own
CREATE POLICY "Authenticated users can view import history"
  ON import_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own import history"
  ON import_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
