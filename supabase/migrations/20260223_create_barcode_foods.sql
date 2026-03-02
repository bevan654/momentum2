-- Shared table of barcode-scanned foods.
-- Populated automatically whenever any user scans a barcode.
CREATE TABLE public.barcode_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  name text NOT NULL,
  brand text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  serving_size numeric NOT NULL DEFAULT 100,
  serving_unit text NOT NULL DEFAULT 'g'::text,
  vitamin_a real,
  vitamin_c real,
  vitamin_d real,
  vitamin_e real,
  vitamin_k real,
  vitamin_b6 real,
  vitamin_b12 real,
  folate real,
  calcium real,
  iron real,
  magnesium real,
  potassium real,
  zinc real,
  sodium real,
  scanned_by uuid NOT NULL,
  scan_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT barcode_foods_pkey PRIMARY KEY (id),
  CONSTRAINT barcode_foods_barcode_key UNIQUE (barcode),
  CONSTRAINT barcode_foods_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id)
);

-- Index for fast barcode lookups
CREATE INDEX barcode_foods_barcode_idx ON public.barcode_foods (barcode);

-- Enable RLS
ALTER TABLE public.barcode_foods ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read barcode foods (shared community table)
CREATE POLICY "Anyone can read barcode foods"
  ON public.barcode_foods FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert barcode foods
CREATE POLICY "Anyone can insert barcode foods"
  ON public.barcode_foods FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = scanned_by);

-- Allow updating scan_count on existing rows
CREATE POLICY "Anyone can update barcode foods"
  ON public.barcode_foods FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
