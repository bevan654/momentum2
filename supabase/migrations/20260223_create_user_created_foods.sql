-- Table for foods manually created by users (Quick Add with a name).
-- Builds a community database of user-submitted foods over time.
CREATE TABLE public.user_created_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  serving_size numeric NOT NULL DEFAULT 1,
  serving_unit text NOT NULL DEFAULT 'serving'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_created_foods_pkey PRIMARY KEY (id),
  CONSTRAINT user_created_foods_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- Index for searching by name
CREATE INDEX user_created_foods_name_idx ON public.user_created_foods USING gin (name gin_trgm_ops);

-- Enable RLS
ALTER TABLE public.user_created_foods ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (shared community table)
CREATE POLICY "Anyone can read user created foods"
  ON public.user_created_foods FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own foods
CREATE POLICY "Users can insert own created foods"
  ON public.user_created_foods FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
