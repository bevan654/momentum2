CREATE TABLE IF NOT EXISTS public.user_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank_name text NOT NULL DEFAULT 'Novice',
  overall_score numeric NOT NULL DEFAULT 0,
  rank_progress numeric NOT NULL DEFAULT 0,
  diversity_bonus numeric NOT NULL DEFAULT 0,
  total_workouts int NOT NULL DEFAULT 0,
  is_provisional boolean NOT NULL DEFAULT true,
  best_sets jsonb NOT NULL DEFAULT '{}'::jsonb,
  muscle_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_ranks_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ranks_user_id ON public.user_ranks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ranks_rank_name ON public.user_ranks(rank_name);
CREATE INDEX IF NOT EXISTS idx_user_ranks_overall_score ON public.user_ranks(overall_score DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_user_ranks_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_ranks_updated_at
  BEFORE UPDATE ON public.user_ranks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_ranks_updated_at();

-- RLS: users can read/write own row, admin has full access
ALTER TABLE public.user_ranks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rank"
  ON public.user_ranks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own rank"
  ON public.user_ranks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rank"
  ON public.user_ranks FOR UPDATE
  USING (auth.uid() = user_id);
