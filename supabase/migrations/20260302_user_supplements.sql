-- User supplement configurations (multi-supplement system)
-- Each user can have multiple supplements with custom goals, units, icons, and colors.

CREATE TABLE IF NOT EXISTS public.user_supplements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        text        NOT NULL,
  name       text        NOT NULL,
  daily_goal numeric     NOT NULL DEFAULT 5,
  unit       text        NOT NULL DEFAULT 'g',
  icon       text        NOT NULL DEFAULT 'flash-outline',
  color      text        NOT NULL DEFAULT '#FBBF24',
  increments jsonb       NOT NULL DEFAULT '[5, 1]',
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

-- RLS policies
ALTER TABLE public.user_supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplement configs"
  ON public.user_supplements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplement configs"
  ON public.user_supplements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplement configs"
  ON public.user_supplements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement configs"
  ON public.user_supplements FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_supplements_user_id ON public.user_supplements(user_id);
