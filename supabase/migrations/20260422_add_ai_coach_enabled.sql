ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.ai_coach_enabled IS
  'Feature flag: controls whether the user sees the AI coach in the Lab tab and can call the ai-coach edge function.';
