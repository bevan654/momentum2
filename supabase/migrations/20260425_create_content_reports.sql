-- User-submitted reports of objectionable content / users.
-- Required by Apple App Store Guideline 1.2 (UGC apps must offer a report mechanism).

CREATE TABLE IF NOT EXISTS public.content_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type     text        NOT NULL CHECK (target_type IN ('user', 'activity', 'comment', 'message', 'nudge', 'ai_message')),
  target_id       uuid        NOT NULL,
  target_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason          text        NOT NULL CHECK (reason IN (
    'spam',
    'harassment',
    'hate_speech',
    'sexual_content',
    'violence',
    'self_harm',
    'impersonation',
    'other'
  )),
  details         text,
  status          text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON public.content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_target_user
  ON public.content_reports (target_user_id) WHERE target_user_id IS NOT NULL;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit reports for themselves.
CREATE POLICY "Users can submit reports"
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Reporters can read their own submissions (so the app can show "already reported" state).
CREATE POLICY "Users can read own reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);
