-- Add program context columns to activity_feed
ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_name text,
  ADD COLUMN IF NOT EXISTS program_week integer,
  ADD COLUMN IF NOT EXISTS program_total_weeks integer,
  ADD COLUMN IF NOT EXISTS program_day_label text;
