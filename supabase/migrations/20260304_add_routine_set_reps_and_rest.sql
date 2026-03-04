-- Add days to routines, per-set reps/weights array and rest seconds to routine_exercises

ALTER TABLE public.routines
  ADD COLUMN days jsonb DEFAULT '[]'::jsonb;

-- set_reps takes priority over default_reps when present

ALTER TABLE public.routine_exercises
  ADD COLUMN IF NOT EXISTS default_reps integer NOT NULL DEFAULT 10;

ALTER TABLE public.routine_exercises
  ADD COLUMN default_rest_seconds integer NOT NULL DEFAULT 90;

ALTER TABLE public.routine_exercises
  ADD COLUMN set_reps jsonb;

ALTER TABLE public.routine_exercises
  ADD COLUMN set_weights jsonb;
