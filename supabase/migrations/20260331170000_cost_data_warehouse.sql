-- Cost data warehouse for estimator inputs and uploaded supplier documents

CREATE TABLE IF NOT EXISTS public.stored_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_file_id uuid REFERENCES public.quote_files(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id text,
  project_id text,
  client_id text,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'uploaded'
    CHECK (source_type IN ('uploaded', 'seed_json', 'seed_csv', 'seed_xlsx', 'seed_zip', 'legacy_backfill')),
  source_filename text,
  source_file_extension text,
  file_name text NOT NULL DEFAULT '',
  file_size numeric,
  file_type text NOT NULL DEFAULT 'unknown',
  storage_path text NOT NULL DEFAULT '',
  extracted_document_type text,
  parser_name text,
  parser_version text,
  parse_error text,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'needs_review', 'approved', 'corrected', 'rejected', 'unparsed')),
  parsed_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_successfully boolean DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS quote_file_id uuid REFERENCES public.quote_files(id) ON DELETE SET NULL;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'uploaded';
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS source_filename text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS source_file_extension text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS extracted_document_type text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS parser_name text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS parser_version text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS parse_error text;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.stored_documents
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.stored_documents
  DROP CONSTRAINT IF EXISTS stored_documents_source_type_check;
ALTER TABLE public.stored_documents
  ADD CONSTRAINT stored_documents_source_type_check
  CHECK (source_type IN ('uploaded', 'seed_json', 'seed_csv', 'seed_xlsx', 'seed_zip', 'legacy_backfill'));

ALTER TABLE public.stored_documents
  DROP CONSTRAINT IF EXISTS stored_documents_review_status_check;
ALTER TABLE public.stored_documents
  ADD CONSTRAINT stored_documents_review_status_check
  CHECK (review_status IN ('pending', 'needs_review', 'approved', 'corrected', 'rejected', 'unparsed'));

CREATE INDEX IF NOT EXISTS stored_documents_quote_file_id_idx ON public.stored_documents(quote_file_id);
CREATE INDEX IF NOT EXISTS stored_documents_job_id_idx ON public.stored_documents(job_id);
CREATE INDEX IF NOT EXISTS stored_documents_project_id_idx ON public.stored_documents(project_id);

CREATE TABLE IF NOT EXISTS public.steel_cost_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stored_document_id uuid REFERENCES public.stored_documents(id) ON DELETE SET NULL,
  quote_file_id uuid REFERENCES public.quote_files(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id text,
  project_id text,
  client_id text,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  width_ft numeric,
  length_ft numeric,
  eave_height_ft numeric,
  roof_slope numeric,
  floor_area_sqft numeric,
  total_weight_lb numeric,
  total_cost numeric,
  cost_per_sqft numeric,
  weight_per_sqft numeric,
  price_per_lb numeric,
  snow_load_psf numeric,
  wind_load_psf numeric,
  wind_code text,
  province text,
  city text,
  seismic_cat text,
  data_source text,
  source_type text NOT NULL DEFAULT 'uploaded',
  source_file_name text,
  source_file_path text,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'needs_review', 'approved', 'corrected', 'rejected', 'unparsed')),
  parser_version text,
  raw_extraction jsonb,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  date_added date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS stored_document_id uuid REFERENCES public.stored_documents(id) ON DELETE SET NULL;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS quote_file_id uuid REFERENCES public.quote_files(id) ON DELETE SET NULL;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS job_id text;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'uploaded';
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS parser_version text;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS raw_extraction jsonb;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS components jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.steel_cost_data
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.steel_cost_data
  DROP CONSTRAINT IF EXISTS steel_cost_data_review_status_check;
ALTER TABLE public.steel_cost_data
  ADD CONSTRAINT steel_cost_data_review_status_check
  CHECK (review_status IN ('pending', 'needs_review', 'approved', 'corrected', 'rejected', 'unparsed'));

CREATE INDEX IF NOT EXISTS steel_cost_data_quote_file_id_idx ON public.steel_cost_data(quote_file_id);
CREATE INDEX IF NOT EXISTS steel_cost_data_job_id_idx ON public.steel_cost_data(job_id);
CREATE INDEX IF NOT EXISTS steel_cost_data_project_id_idx ON public.steel_cost_data(project_id);

CREATE TABLE IF NOT EXISTS public.insulation_cost_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stored_document_id uuid REFERENCES public.stored_documents(id) ON DELETE SET NULL,
  quote_file_id uuid REFERENCES public.quote_files(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id text,
  project_id text,
  client_id text,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  width_ft numeric,
  length_ft numeric,
  eave_height_ft numeric,
  roof_slope numeric,
  floor_area_sqft numeric,
  location text,
  roof_r_value text,
  wall_r_value text,
  grade text,
  roof_area_sqft numeric,
  wall_area_sqft numeric,
  total_insulated_sqft numeric,
  material_cost numeric,
  freight_cost numeric,
  fuel_surcharge numeric,
  total_delivery numeric,
  total_cost numeric,
  material_per_sqft numeric,
  total_per_sqft numeric,
  weight_lb numeric,
  ship_branch text,
  quote_number text,
  quote_date date,
  data_source text,
  source_type text NOT NULL DEFAULT 'uploaded',
  source_file_name text,
  source_file_path text,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'needs_review', 'approved', 'corrected', 'rejected', 'unparsed')),
  parser_version text,
  raw_extraction jsonb,
  accessories jsonb NOT NULL DEFAULT '[]'::jsonb,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  date_added date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS stored_document_id uuid REFERENCES public.stored_documents(id) ON DELETE SET NULL;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS quote_file_id uuid REFERENCES public.quote_files(id) ON DELETE SET NULL;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS job_id text;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS client_id text;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS roof_slope numeric;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'uploaded';
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS parser_version text;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS raw_extraction jsonb;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS accessories jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.insulation_cost_data
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.insulation_cost_data
  DROP CONSTRAINT IF EXISTS insulation_cost_data_review_status_check;
ALTER TABLE public.insulation_cost_data
  ADD CONSTRAINT insulation_cost_data_review_status_check
  CHECK (review_status IN ('pending', 'needs_review', 'approved', 'corrected', 'rejected', 'unparsed'));

CREATE INDEX IF NOT EXISTS insulation_cost_data_quote_file_id_idx ON public.insulation_cost_data(quote_file_id);
CREATE INDEX IF NOT EXISTS insulation_cost_data_job_id_idx ON public.insulation_cost_data(job_id);
CREATE INDEX IF NOT EXISTS insulation_cost_data_project_id_idx ON public.insulation_cost_data(project_id);

ALTER TABLE public.stored_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steel_cost_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insulation_cost_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view stored documents" ON public.stored_documents;
CREATE POLICY "Authenticated users can view stored documents"
  ON public.stored_documents FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert stored documents" ON public.stored_documents;
CREATE POLICY "Authenticated users can insert stored documents"
  ON public.stored_documents FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update stored documents" ON public.stored_documents;
CREATE POLICY "Authenticated users can update stored documents"
  ON public.stored_documents FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete stored documents" ON public.stored_documents;
CREATE POLICY "Authenticated users can delete stored documents"
  ON public.stored_documents FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Authenticated users can view steel cost data" ON public.steel_cost_data;
CREATE POLICY "Authenticated users can view steel cost data"
  ON public.steel_cost_data FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert steel cost data" ON public.steel_cost_data;
CREATE POLICY "Authenticated users can insert steel cost data"
  ON public.steel_cost_data FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update steel cost data" ON public.steel_cost_data;
CREATE POLICY "Authenticated users can update steel cost data"
  ON public.steel_cost_data FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete steel cost data" ON public.steel_cost_data;
CREATE POLICY "Authenticated users can delete steel cost data"
  ON public.steel_cost_data FOR DELETE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view insulation cost data" ON public.insulation_cost_data;
CREATE POLICY "Authenticated users can view insulation cost data"
  ON public.insulation_cost_data FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert insulation cost data" ON public.insulation_cost_data;
CREATE POLICY "Authenticated users can insert insulation cost data"
  ON public.insulation_cost_data FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update insulation cost data" ON public.insulation_cost_data;
CREATE POLICY "Authenticated users can update insulation cost data"
  ON public.insulation_cost_data FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete insulation cost data" ON public.insulation_cost_data;
CREATE POLICY "Authenticated users can delete insulation cost data"
  ON public.insulation_cost_data FOR DELETE TO authenticated
  USING (true);

DROP VIEW IF EXISTS public.steel_tier_averages;
CREATE VIEW public.steel_tier_averages AS
SELECT
  CASE
    WHEN floor_area_sqft IS NULL THEN 'Unknown'
    WHEN floor_area_sqft < 3000 THEN '<3000'
    WHEN floor_area_sqft < 5000 THEN '3000-4999'
    WHEN floor_area_sqft < 7500 THEN '5000-7499'
    WHEN floor_area_sqft < 10000 THEN '7500-9999'
    ELSE '10000+'
  END AS tier,
  MIN(floor_area_sqft) AS min_sqft,
  COUNT(*)::integer AS count,
  AVG(cost_per_sqft) AS avg_cost_sqft,
  AVG(weight_per_sqft) AS avg_wt_sqft,
  MIN(cost_per_sqft) AS min_cost_sqft,
  MAX(cost_per_sqft) AS max_cost_sqft,
  AVG(price_per_lb) AS avg_price_lb
FROM public.steel_cost_data
WHERE total_cost IS NOT NULL
GROUP BY 1;

DROP VIEW IF EXISTS public.insulation_grade_averages;
CREATE VIEW public.insulation_grade_averages AS
SELECT
  COALESCE(NULLIF(grade, ''), 'Unknown') AS grade,
  COUNT(*)::integer AS count,
  AVG(material_per_sqft) AS avg_material_per_sqft,
  AVG(total_per_sqft) AS avg_total_per_sqft,
  AVG(total_delivery) AS avg_delivery,
  MIN(total_per_sqft) AS min_total_per_sqft,
  MAX(total_per_sqft) AS max_total_per_sqft
FROM public.insulation_cost_data
WHERE total_cost IS NOT NULL
GROUP BY 1;

INSERT INTO public.steel_cost_data (
  quote_file_id,
  job_id,
  project_id,
  client_id,
  width_ft,
  length_ft,
  eave_height_ft,
  roof_slope,
  floor_area_sqft,
  total_weight_lb,
  total_cost,
  cost_per_sqft,
  weight_per_sqft,
  price_per_lb,
  province,
  city,
  data_source,
  source_type,
  source_file_name,
  review_status,
  raw_extraction,
  components,
  added_by,
  date_added
)
SELECT
  sce.quote_file_id,
  NULLIF(sce.job_id, ''),
  NULLIF(sce.job_id, ''),
  NULLIF(sce.client_id, ''),
  sce.width,
  sce.length,
  sce.height,
  sce.roof_pitch,
  CASE
    WHEN sce.width IS NOT NULL AND sce.length IS NOT NULL THEN sce.width * sce.length
    ELSE NULL
  END,
  NULLIF(sce.weight_lbs, 0),
  NULLIF(sce.total_cost, 0),
  CASE
    WHEN sce.width IS NOT NULL AND sce.length IS NOT NULL AND (sce.width * sce.length) <> 0
      THEN sce.total_cost / (sce.width * sce.length)
    ELSE NULL
  END,
  CASE
    WHEN sce.width IS NOT NULL AND sce.length IS NOT NULL AND (sce.width * sce.length) <> 0
      THEN sce.weight_lbs / (sce.width * sce.length)
    ELSE NULL
  END,
  NULLIF(sce.cost_per_lb, 0),
  sce.province,
  sce.city,
  sce.document_type,
  'legacy_backfill',
  sce.file_name,
  'approved',
  sce.ai_raw_output,
  COALESCE(sce.components, '[]'::jsonb),
  sce.uploaded_by,
  sce.created_at::date
FROM public.steel_cost_entries sce
WHERE NOT EXISTS (
  SELECT 1
  FROM public.steel_cost_data scd
  WHERE scd.quote_file_id IS NOT DISTINCT FROM sce.quote_file_id
    AND COALESCE(scd.source_file_name, '') = COALESCE(sce.file_name, '')
    AND COALESCE(scd.job_id, '') = COALESCE(sce.job_id, '')
);
