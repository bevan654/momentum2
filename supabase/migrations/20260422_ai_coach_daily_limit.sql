ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_daily_limit INTEGER DEFAULT 7;

COMMENT ON COLUMN public.profiles.ai_coach_daily_limit IS
  'Daily AI coach message cap per rolling 24h. NULL = unlimited. Default 7.';
