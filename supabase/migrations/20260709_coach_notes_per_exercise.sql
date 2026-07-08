-- Coach's Take now gives feedback per exercise instead of one paragraph for
-- the whole session. Replaces the single coach_summary text column with a
-- structured array (name, note, deltaPct, isPR, hasKg — deltaPct/isPR/hasKg
-- are computed deterministically server-side, never by the model).
-- No real user data has accumulated in coach_summary yet (shipped same day),
-- so a clean replace is safe.
ALTER TABLE public.workouts
  DROP COLUMN IF EXISTS coach_summary,
  ADD COLUMN IF NOT EXISTS coach_notes jsonb;
