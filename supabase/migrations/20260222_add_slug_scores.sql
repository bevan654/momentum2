ALTER TABLE public.user_ranks ADD COLUMN IF NOT EXISTS slug_scores jsonb NOT NULL DEFAULT '{}'::jsonb;
