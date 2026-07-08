-- Schedules the daily ai-workout-notifications sweep via pg_cron + pg_net.
--
-- The edge function checks a shared secret (x-cron-secret header) instead of a
-- user JWT, since it's invoked by cron rather than an authenticated client. The
-- secret is generated once here and stored in Supabase Vault so it never
-- appears in migration history or git. After running this migration, copy the
-- same value into the function's own environment:
--
--   select decrypted_secret from vault.decrypted_secrets
--   where name = 'ai_notification_cron_secret';
--   -- then: supabase secrets set CRON_SECRET=<that value>
--   -- and:  supabase secrets set DEEPSEEK_API_KEY=<your DeepSeek key>

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ai_notification_cron_secret'
  ) THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'ai_notification_cron_secret');
  END IF;
END $$;

SELECT cron.schedule(
  'ai-workout-notifications-daily',
  '0 13 * * *', -- 13:00 UTC daily. No per-user timezone column exists yet on
                -- profiles, so this is a single fixed time for everyone —
                -- revisit once timezone is tracked.
  $$
  SELECT net.http_post(
    url := 'https://mckuaytsjvjuvobtxaou.supabase.co/functions/v1/ai-workout-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ai_notification_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
