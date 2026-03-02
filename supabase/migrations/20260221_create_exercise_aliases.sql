CREATE TABLE IF NOT EXISTS exercise_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL UNIQUE,        -- e.g. "Pull Up (Assisted)"
  canonical_name TEXT NOT NULL,       -- e.g. "assisted pull up" (must match exercises_catalog.name)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: allow all authenticated users to read
ALTER TABLE exercise_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read aliases" ON exercise_aliases FOR SELECT USING (true);

-- Ensure name is unique for ON CONFLICT
ALTER TABLE exercises_catalog ADD CONSTRAINT exercises_catalog_name_unique UNIQUE (name);

-- Seed new catalog exercises
INSERT INTO exercises_catalog (id, name, slug, primary_muscles, secondary_muscles, other_muscles, equipment, movement_type, force_type, category, difficulty, is_main_lift, ranking_weight, is_bodyweight, allows_external_weight) VALUES
  (gen_random_uuid(), 'cable face pull', 'cable-face-pull', '["rear delts"]', '["middle back","traps"]', '[]', '["cable"]', 'compound', 'pull', 'strength', 1, false, 0.5, false, true),
  (gen_random_uuid(), 'incline dumbbell bench press', 'incline-dumbbell-bench-press', '["upper chest"]', '["triceps","shoulders"]', '[]', '["dumbbell"]', 'compound', 'push', 'strength', 1, false, 0.7, false, true),
  (gen_random_uuid(), 'dumbbell hammer curl', 'dumbbell-hammer-curl', '["biceps"]', '["brachialis","forearms"]', '[]', '["dumbbell"]', 'isolation', 'pull', 'strength', 1, false, 0.6, false, true),
  (gen_random_uuid(), 'smith machine overhead press', 'smith-machine-overhead-press', '["shoulders"]', '["triceps"]', '["upper chest"]', '["machine"]', 'compound', 'push', 'strength', 1, false, 0.6, false, true),
  (gen_random_uuid(), 'dumbbell preacher curl', 'dumbbell-preacher-curl', '["biceps"]', '["brachialis"]', '["forearms"]', '["dumbbell"]', 'isolation', 'pull', 'strength', 1, false, 0.6, false, true),
  (gen_random_uuid(), 'reverse grip triceps extension', 'reverse-grip-triceps-extension', '["triceps"]', '[]', '[]', '["cable"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'cable hammer curl', 'cable-hammer-curl', '["biceps"]', '["brachialis","forearms"]', '[]', '["cable"]', 'isolation', 'pull', 'strength', 1, false, 0.5, false, true),
  (gen_random_uuid(), 'push up', 'push-up', '["chest"]', '["triceps","shoulders"]', '["core"]', '["bodyweight"]', 'compound', 'push', 'strength', 1, false, 0.6, true, true),
  (gen_random_uuid(), 'strict curl', 'strict-curl', '["biceps"]', '["forearms"]', '[]', '["barbell"]', 'isolation', 'pull', 'strength', 2, false, 0.5, false, true),
  (gen_random_uuid(), 'calf press on leg press', 'calf-press-on-leg-press', '["calves"]', '[]', '[]', '["machine"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'leaning triceps extension', 'leaning-triceps-extension', '["triceps"]', '[]', '[]', '["cable"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'straight arm pulldown', 'straight-arm-pulldown', '["lats"]', '["rear delts"]', '["triceps"]', '["cable"]', 'isolation', 'pull', 'strength', 1, false, 0.5, false, true),
  (gen_random_uuid(), 'dumbbell arnold press', 'dumbbell-arnold-press', '["shoulders"]', '["triceps"]', '["upper chest"]', '["dumbbell"]', 'compound', 'push', 'strength', 2, false, 0.7, false, true),
  (gen_random_uuid(), 'dumbbell front raise', 'dumbbell-front-raise', '["shoulders"]', '["upper chest"]', '[]', '["dumbbell"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'barbell upright row', 'barbell-upright-row', '["shoulders","traps"]', '["biceps"]', '[]', '["barbell"]', 'compound', 'pull', 'strength', 1, false, 0.6, false, true),
  (gen_random_uuid(), 'dumbbell lunge', 'dumbbell-lunge', '["quadriceps","glutes"]', '["hamstrings"]', '["core"]', '["dumbbell"]', 'compound', 'push', 'strength', 1, false, 0.7, false, true),
  (gen_random_uuid(), 'cable curl', 'cable-curl', '["biceps"]', '["forearms"]', '[]', '["cable"]', 'isolation', 'pull', 'strength', 1, false, 0.5, false, true),
  (gen_random_uuid(), 'machine bicep curl', 'machine-bicep-curl', '["biceps"]', '["brachialis"]', '["forearms"]', '["machine"]', 'isolation', 'pull', 'strength', 1, false, 0.5, false, true),
  (gen_random_uuid(), 'dumbbell triceps extension', 'dumbbell-triceps-extension', '["triceps"]', '[]', '[]', '["dumbbell"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'barbell curl', 'barbell-curl', '["biceps"]', '["forearms"]', '[]', '["barbell"]', 'isolation', 'pull', 'strength', 1, false, 0.6, false, true),
  (gen_random_uuid(), 'cable triceps extension', 'cable-triceps-extension', '["triceps"]', '[]', '[]', '["cable"]', 'isolation', 'push', 'strength', 1, false, 0.5, false, true),
  (gen_random_uuid(), 'iso lateral chest press', 'iso-lateral-chest-press', '["chest"]', '["triceps","shoulders"]', '[]', '["machine"]', 'compound', 'push', 'strength', 1, false, 0.6, false, true),
  (gen_random_uuid(), 'single arm triceps extension', 'single-arm-triceps-extension', '["triceps"]', '[]', '[]', '["dumbbell"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'band chest fly', 'band-chest-fly', '["chest"]', '["shoulders"]', '[]', '["other"]', 'isolation', 'push', 'strength', 1, false, 0.3, false, false),
  (gen_random_uuid(), 'barbell bent over row', 'barbell-bent-over-row', '["lats","middle back"]', '["biceps","rear delts"]', '["forearms"]', '["barbell"]', 'compound', 'pull', 'strength', 2, false, 0.7, false, true),
  (gen_random_uuid(), 'ben''s', 'ben-s', '["upper back"]', '["rear delts"]', '[]', '["machine"]', 'compound', 'pull', 'strength', 1, false, 0.3, false, true),
  (gen_random_uuid(), 'running', 'running', '["quadriceps","calves"]', '["hamstrings","glutes"]', '[]', '["machine"]', 'compound', 'push', 'strength', 1, false, 0.3, true, false)
ON CONFLICT (name) DO NOTHING;

-- Seed initial aliases
INSERT INTO exercise_aliases (alias, canonical_name) VALUES
  -- Original aliases
  ('Pull Up (Assisted)', 'pull ups'),
  ('Shrug (Dumbbell)', 'dumbbell shrug'),
  ('Chest Press (Machine)', 'machine chest press'),
  ('Shoulder Press (Plate Loaded)', 'iso lateral shoulder press'),
  ('Plate Loaded Row', 'iso lateral machine row'),
  ('Seated Row (Cable)', 'seated cable row'),
  -- Matched to existing catalog
  ('Seated Wide-Grip Row (Cable)', 'seated wide grip cable row'),
  ('Reverse Fly (Machine)', 'rear delt fly'),
  ('Bent Over One Arm Row (Dumbbell)', 'bent over dumbbell row'),
  ('Flat Leg Raise', 'lying leg raise'),
  ('Incline Bench Press (Smith Machine)', 'smith machine incline bench press'),
  ('Cable Crossover', 'cable chest fly'),
  ('Tricep Pushdown Individual (Rope)', 'rope tricep pushdown'),
  ('Shoulder Press (Machine)', 'machine shoulder press'),
  ('Bicep Curl (Dumbbell)', 'dumbbell curl'),
  ('Over Head Triceps', 'overhead cable triceps extension'),
  ('Hip Adductor (Machine)', 'hip adduction machine'),
  ('Bent Over Row - Underhand (Barbell)', 'underhand barbell row'),
  ('Seated Leg Curl (Machine)', 'seated leg curl'),
  ('Chest Dip (Assisted)', 'assisted dips'),
  ('Lat Pulldown (Cable)', 'lat pulldown single pulley'),
  ('Bench Press (Barbell)', 'bench press'),
  ('Seated Row (Machine)', 'seated machine row'),
  ('Leg Extension (Machine)', 'leg extension'),
  -- New catalog exercises (alias from Strong/Liftoff format)
  ('Face Pull (Cable)', 'cable face pull'),
  ('Incline Bench Press (Dumbbell)', 'incline dumbbell bench press'),
  ('Hammer Curl (Dumbbell)', 'dumbbell hammer curl'),
  ('Overhead Press (Smith Machine)', 'smith machine overhead press'),
  ('Preacher Curl (Dumbbell)', 'dumbbell preacher curl'),
  ('Reverse Grip Triceps Extension ', 'reverse grip triceps extension'),
  ('Hammer Curl (Cable)', 'cable hammer curl'),
  ('Push Up', 'push up'),
  ('Biceps Strict Curls', 'strict curl'),
  ('Calf Press on Seated Leg Press', 'calf press on leg press'),
  ('Triceps Extension Leaning Forward ', 'leaning triceps extension'),
  ('Straight Arm Pull down ', 'straight arm pulldown'),
  ('Arnold Press (Dumbbell)', 'dumbbell arnold press'),
  ('Front Raise (Dumbbell)', 'dumbbell front raise'),
  ('Upright Row (Barbell)', 'barbell upright row'),
  ('Lunge (Dumbbell)', 'dumbbell lunge'),
  ('Bicep Curl (Cable)', 'cable curl'),
  ('Bicep Curl (Machine)', 'machine bicep curl'),
  ('Triceps Extension (Dumbbell)', 'dumbbell triceps extension'),
  ('Bicep Curl (Barbell)', 'barbell curl'),
  ('Triceps Extension (Cable)', 'cable triceps extension'),
  ('Iso-Lateral Chest Press (Machine)', 'iso lateral chest press'),
  ('Single Arm Triceps Extension', 'single arm triceps extension'),
  ('Chest Fly (Band)', 'band chest fly'),
  ('Bent Over Row (Barbell)', 'barbell bent over row'),
  ('Ben''s', 'ben''s'),
  ('Running', 'running'),
  -- Case / variant aliases
  ('Leg Extension', 'leg extension'),
  ('Single Leg Extension', 'leg extension')
ON CONFLICT (alias) DO NOTHING;
