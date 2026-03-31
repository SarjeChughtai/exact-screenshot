-- Quote Files: tracks uploaded steel cost and insulation files
CREATE TABLE IF NOT EXISTS quote_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  client_id text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT 'unknown' CHECK (file_type IN ('mbs', 'insulation', 'unknown')),
  file_name text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL DEFAULT '',
  gdrive_file_id text,
  gdrive_status text NOT NULL DEFAULT 'pending' CHECK (gdrive_status IN ('pending', 'uploaded', 'failed', 'skipped')),
  uploaded_by uuid REFERENCES auth.users(id),
  building_label text NOT NULL DEFAULT 'Building 1',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies for quote_files
ALTER TABLE quote_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "Authenticated users can view quote files"
  ON quote_files FOR SELECT
  TO authenticated
  USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated users can insert quote files"
  ON quote_files FOR INSERT
  TO authenticated
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated users can update quote files"
  ON quote_files FOR UPDATE
  TO authenticated
  USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated users can delete quote files"
  ON quote_files FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Storage bucket for quote files (steel cost + insulation PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-files',
  'quote-files',
  false,
  20971520, -- 20MB limit
  ARRAY['application/pdf', 'text/csv', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/read/delete their own files
DO $$ BEGIN
CREATE POLICY "Authenticated users can upload quote files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quote-files');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated users can read quote files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'quote-files');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
CREATE POLICY "Authenticated users can delete own quote files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'quote-files' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;;
