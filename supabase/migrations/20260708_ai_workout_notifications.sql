-- AI-generated workout notifications: adds a generic 'ai_nudge' notification type
-- (the specific signal — streak_risk / neglected_muscle / overload_nudge / comeback —
-- lives in notifications.data.subtype and ai_notification_log.subtype) plus a log
-- table the daily cron sweep uses to cap sends to one per user per day and to
-- compute per-signal cooldowns from history.

DO $$
DECLARE
  enum_type text;
BEGIN
  SELECT udt_name INTO enum_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type';

  IF enum_type IS NULL THEN
    RAISE EXCEPTION 'Could not resolve notifications.type enum name';
  END IF;

  EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_type, 'ai_nudge');
END $$;

CREATE TABLE IF NOT EXISTS public.ai_notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subtype text NOT NULL CHECK (subtype IN ('streak_risk', 'neglected_muscle', 'overload_nudge', 'comeback')),
  sent_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_notification_log_pkey PRIMARY KEY (id),
  CONSTRAINT ai_notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ai_notification_log_one_per_day UNIQUE (user_id, sent_date)
);

CREATE INDEX IF NOT EXISTS ai_notification_log_user_subtype_idx
  ON public.ai_notification_log (user_id, subtype, sent_date DESC);

ALTER TABLE public.ai_notification_log ENABLE ROW LEVEL SECURITY;

-- Owner-read only; all writes go through the edge function via the service role,
-- which bypasses RLS entirely.
CREATE POLICY ai_notification_log_select_own ON public.ai_notification_log
  FOR SELECT USING (auth.uid() = user_id);
