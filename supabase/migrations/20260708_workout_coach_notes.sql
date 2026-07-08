-- Persists the AI "coach's take" generated right after a workout finishes, so
-- reopening that same workout later (WorkoutHistoryScreen, ActivityCard, etc.)
-- shows the same note instead of silently having nothing — or worse, silently
-- regenerating a different one on every view.
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS coach_headline text,
  ADD COLUMN IF NOT EXISTS coach_summary text;
