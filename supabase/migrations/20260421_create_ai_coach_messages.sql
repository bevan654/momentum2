CREATE TABLE IF NOT EXISTS public.ai_coach_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_coach_messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ai_coach_messages_user_created_idx
  ON public.ai_coach_messages (user_id, created_at ASC);

ALTER TABLE public.ai_coach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own coach messages" ON public.ai_coach_messages;
CREATE POLICY "Users manage own coach messages"
  ON public.ai_coach_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
