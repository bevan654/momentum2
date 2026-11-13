-- Force-update gate config. Single-row table read by every client on launch.
-- The hook in src/hooks/useForceUpdate.ts blocks the app when the installed
-- version is below `min_supported_version` (or its platform-specific override).

CREATE TABLE IF NOT EXISTS app_config (
  id INT PRIMARY KEY DEFAULT 1,
  min_supported_version TEXT NOT NULL,
  ios_min_supported_version TEXT,
  android_min_supported_version TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Public read so unauthenticated clients (e.g. on the auth screen) can also
-- fetch this. No write policy — update via the Supabase dashboard or service role.
DROP POLICY IF EXISTS "Public read app_config" ON app_config;
CREATE POLICY "Public read app_config"
  ON app_config FOR SELECT
  USING (true);

-- Seed the row. Bump these values to force users onto a newer build.
INSERT INTO app_config (id, min_supported_version, ios_min_supported_version, android_min_supported_version)
VALUES (1, '1.0.35', '1.0.35', '1.0.35')
ON CONFLICT (id) DO NOTHING;
