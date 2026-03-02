-- Align user_exercises with exercises_catalog structure.
-- Existing columns kept: id, user_id, name, category, exercise_type, created_at

-- Add slug (unique per user, generated from name)
ALTER TABLE public.user_exercises
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.user_exercises
  SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE slug IS NULL;

ALTER TABLE public.user_exercises
  ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.user_exercises
  ADD CONSTRAINT user_exercises_user_slug_unique UNIQUE (user_id, slug);

-- Add muscle group arrays
ALTER TABLE public.user_exercises
  ADD COLUMN IF NOT EXISTS primary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS secondary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS other_muscles text[] NOT NULL DEFAULT '{}'::text[];

-- Add equipment & metadata
ALTER TABLE public.user_exercises
  ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS movement_type text,
  ADD COLUMN IF NOT EXISTS force_type text,
  ADD COLUMN IF NOT EXISTS difficulty smallint;

-- Add media fields
ALTER TABLE public.user_exercises
  ADD COLUMN IF NOT EXISTS video_demo_url text,
  ADD COLUMN IF NOT EXISTS svg_demo text;

-- Add updated_at
ALTER TABLE public.user_exercises
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.handle_user_exercises_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_exercises_updated_at ON public.user_exercises;
CREATE TRIGGER set_user_exercises_updated_at
  BEFORE UPDATE ON public.user_exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_exercises_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_exercises_user_id ON public.user_exercises (user_id);
CREATE INDEX IF NOT EXISTS idx_user_exercises_user_name ON public.user_exercises (user_id, name);
