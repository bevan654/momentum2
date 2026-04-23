-- Seeds the developer/Apple-review account with realistic data across the app.
-- Target user id: f2ec58c9-63d2-4325-ad5b-cfd364e64732  (email: admin@bevan.quest)
-- Safe to re-run: wipes this user's prior data first.
-- Run in the Supabase dashboard SQL editor.

-- Ensure required columns exist (safe if already applied)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_coach_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_coach_daily_limit INTEGER DEFAULT 7;

DO $$
DECLARE
  uid UUID := 'f2ec58c9-63d2-4325-ad5b-cfd364e64732';
  wo_id UUID;
  ex_id UUID;
  base_date DATE;
  i INT;
  day_offset INT;
  kg NUMERIC;
  session_idx INT;
  split_type TEXT;
  ex_rec RECORD;
BEGIN
  /* ───── 1. wipe existing data for this user ───── */
  DELETE FROM sets       WHERE exercise_id IN (SELECT id FROM exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = uid));
  DELETE FROM exercises  WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = uid);
  DELETE FROM workouts   WHERE user_id = uid;
  DELETE FROM routine_exercises WHERE routine_id IN (SELECT id FROM routines WHERE user_id = uid);
  DELETE FROM routines   WHERE user_id = uid;
  DELETE FROM food_entries        WHERE user_id = uid;
  DELETE FROM supplement_entries  WHERE user_id = uid;
  DELETE FROM weight_entries      WHERE user_id = uid;
  DELETE FROM body_fat_entries    WHERE user_id = uid;
  DELETE FROM measurement_entries WHERE user_id = uid;
  DELETE FROM meal_config         WHERE user_id = uid;
  DELETE FROM ai_coach_messages   WHERE user_id = uid;
  DELETE FROM user_streaks        WHERE user_id = uid;
  DELETE FROM nutrition_goals     WHERE user_id = uid;
  DELETE FROM supplement_goals    WHERE user_id = uid;

  /* ───── 2. profile tweaks ───── */
  UPDATE profiles
     SET ai_coach_enabled = TRUE,
         ai_coach_daily_limit = NULL,     -- unlimited for review
         dob = '1970-05-15',
         starting_weight = 60,
         goal_weight = 65,
         height = 175,
         age = 28,
         gender = 'male'
   WHERE id = uid;

  /* ───── 3. goals ───── */
  INSERT INTO nutrition_goals (user_id, calorie_goal, protein_goal, carbs_goal, fat_goal)
    VALUES (uid, 3000, 180, 330, 90);
  INSERT INTO supplement_goals (user_id, water_goal, creatine_goal)
    VALUES (uid, 3000, 5);

  /* ───── 4. meal config ───── */
  INSERT INTO meal_config (user_id, slot, label, icon, time_start, sort_order) VALUES
    (uid, 'breakfast', 'Breakfast', 'sunny-outline',     '08:00', 0),
    (uid, 'lunch',     'Lunch',     'restaurant-outline','13:00', 1),
    (uid, 'snack',     'Snack',     'cafe-outline',      '16:00', 2),
    (uid, 'dinner',    'Dinner',    'moon-outline',      '19:30', 3);

  /* ───── 5. routines (Push / Pull / Legs) ───── */
  INSERT INTO routines (user_id, name) VALUES (uid, 'Push Day')
    RETURNING id INTO wo_id;
  INSERT INTO routine_exercises (routine_id, name, exercise_order, default_sets) VALUES
    (wo_id, 'Bench Press',          1, 4),
    (wo_id, 'Overhead Press',       2, 4),
    (wo_id, 'Incline Dumbbell Press',3, 3),
    (wo_id, 'Lateral Raise',        4, 3),
    (wo_id, 'Tricep Pushdown',      5, 3);

  INSERT INTO routines (user_id, name) VALUES (uid, 'Pull Day')
    RETURNING id INTO wo_id;
  INSERT INTO routine_exercises (routine_id, name, exercise_order, default_sets) VALUES
    (wo_id, 'Deadlift',     1, 4),
    (wo_id, 'Pull-Up',      2, 4),
    (wo_id, 'Barbell Row',  3, 4),
    (wo_id, 'Face Pull',    4, 3),
    (wo_id, 'Bicep Curl',   5, 3);

  INSERT INTO routines (user_id, name) VALUES (uid, 'Leg Day')
    RETURNING id INTO wo_id;
  INSERT INTO routine_exercises (routine_id, name, exercise_order, default_sets) VALUES
    (wo_id, 'Squat',              1, 4),
    (wo_id, 'Romanian Deadlift',  2, 4),
    (wo_id, 'Leg Press',          3, 3),
    (wo_id, 'Leg Curl',           4, 3),
    (wo_id, 'Standing Calf Raise',5, 4);

  /* ───── 6. workouts: 12 sessions over last ~4 weeks, PPL cycle ───── */
  -- session_idx 0 = most recent, 11 = oldest
  -- spacing: ~2 days between sessions (so 12 * 2.3 ≈ 28 days window)
  FOR session_idx IN 0..11 LOOP
    day_offset := session_idx * 2 + (session_idx / 3);  -- spread over ~28 days
    base_date := (NOW() - (day_offset || ' days')::INTERVAL)::DATE;
    split_type := CASE (session_idx % 3) WHEN 0 THEN 'push' WHEN 1 THEN 'pull' ELSE 'legs' END;

    INSERT INTO workouts (user_id, created_at, duration, total_exercises, total_sets)
      VALUES (
        uid,
        (base_date + TIME '17:30' + ((session_idx % 4) * INTERVAL '15 min')) AT TIME ZONE 'UTC',
        3000 + (session_idx * 37) % 900,   -- 50-65 min
        5,
        20
      )
      RETURNING id INTO wo_id;

    IF split_type = 'push' THEN
      -- progressive overload: newer sessions (low session_idx) = more weight
      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Bench Press',            1, 'weighted') RETURNING id INTO ex_id;
      kg := 85 - (session_idx * 2.5);  -- starts at 85kg recent, drops to ~55kg oldest
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, GREATEST(kg - 20, 40), 10, TRUE, 'warmup'),
        (ex_id, 2, kg,       5, TRUE, 'working'),
        (ex_id, 3, kg,       5, TRUE, 'working'),
        (ex_id, 4, kg - 2.5, 6, TRUE, 'working'),
        (ex_id, 5, kg - 5,   8, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Overhead Press', 2, 'weighted') RETURNING id INTO ex_id;
      kg := 55 - (session_idx * 1.5);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg,       6, TRUE, 'working'),
        (ex_id, 2, kg,       6, TRUE, 'working'),
        (ex_id, 3, kg - 2.5, 8, TRUE, 'working'),
        (ex_id, 4, kg - 5,  10, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Incline Dumbbell Press', 3, 'weighted') RETURNING id INTO ex_id;
      kg := 28 - (session_idx * 0.5);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg,  8, TRUE, 'working'),
        (ex_id, 2, kg,  8, TRUE, 'working'),
        (ex_id, 3, kg, 10, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Lateral Raise', 4, 'weighted') RETURNING id INTO ex_id;
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, 10, 12, TRUE, 'working'),
        (ex_id, 2, 10, 12, TRUE, 'working'),
        (ex_id, 3, 10, 15, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Tricep Pushdown', 5, 'weighted') RETURNING id INTO ex_id;
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, 25, 12, TRUE, 'working'),
        (ex_id, 2, 25, 12, TRUE, 'working'),
        (ex_id, 3, 22.5, 15, TRUE, 'working');

    ELSIF split_type = 'pull' THEN
      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Deadlift', 1, 'weighted') RETURNING id INTO ex_id;
      kg := 130 - (session_idx * 3);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg - 30, 8, TRUE, 'warmup'),
        (ex_id, 2, kg, 5, TRUE, 'working'),
        (ex_id, 3, kg, 5, TRUE, 'working'),
        (ex_id, 4, kg - 10, 6, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Pull-Up', 2, 'weighted') RETURNING id INTO ex_id;
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, 0, 10 - (session_idx / 6), TRUE, 'working'),
        (ex_id, 2, 0,  9 - (session_idx / 6), TRUE, 'working'),
        (ex_id, 3, 0,  8 - (session_idx / 6), TRUE, 'working'),
        (ex_id, 4, 0,  7 - (session_idx / 6), TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Barbell Row', 3, 'weighted') RETURNING id INTO ex_id;
      kg := 70 - (session_idx * 1.5);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg,      8, TRUE, 'working'),
        (ex_id, 2, kg,      8, TRUE, 'working'),
        (ex_id, 3, kg - 5, 10, TRUE, 'working'),
        (ex_id, 4, kg - 10, 12, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Face Pull', 4, 'weighted') RETURNING id INTO ex_id;
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, 20, 15, TRUE, 'working'),
        (ex_id, 2, 20, 15, TRUE, 'working'),
        (ex_id, 3, 22.5, 12, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Bicep Curl', 5, 'weighted') RETURNING id INTO ex_id;
      kg := 16 - (session_idx * 0.25);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg, 10, TRUE, 'working'),
        (ex_id, 2, kg, 10, TRUE, 'working'),
        (ex_id, 3, kg - 2, 12, TRUE, 'working');

    ELSE  -- legs
      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Squat', 1, 'weighted') RETURNING id INTO ex_id;
      kg := 110 - (session_idx * 2.5);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg - 40, 10, TRUE, 'warmup'),
        (ex_id, 2, kg, 5, TRUE, 'working'),
        (ex_id, 3, kg, 5, TRUE, 'working'),
        (ex_id, 4, kg - 5, 6, TRUE, 'working'),
        (ex_id, 5, kg - 10, 8, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Romanian Deadlift', 2, 'weighted') RETURNING id INTO ex_id;
      kg := 90 - (session_idx * 1.5);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg, 8, TRUE, 'working'),
        (ex_id, 2, kg, 8, TRUE, 'working'),
        (ex_id, 3, kg - 5, 10, TRUE, 'working'),
        (ex_id, 4, kg - 10, 12, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Leg Press', 3, 'weighted') RETURNING id INTO ex_id;
      kg := 180 - (session_idx * 4);
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, kg,      10, TRUE, 'working'),
        (ex_id, 2, kg,      10, TRUE, 'working'),
        (ex_id, 3, kg - 10, 12, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Leg Curl', 4, 'weighted') RETURNING id INTO ex_id;
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, 40, 10, TRUE, 'working'),
        (ex_id, 2, 40, 10, TRUE, 'working'),
        (ex_id, 3, 35, 12, TRUE, 'working');

      INSERT INTO exercises (workout_id, name, exercise_order, exercise_type) VALUES
        (wo_id, 'Standing Calf Raise', 5, 'weighted') RETURNING id INTO ex_id;
      INSERT INTO sets (exercise_id, set_number, kg, reps, completed, set_type) VALUES
        (ex_id, 1, 80, 12, TRUE, 'working'),
        (ex_id, 2, 80, 12, TRUE, 'working'),
        (ex_id, 3, 80, 15, TRUE, 'working'),
        (ex_id, 4, 70, 20, TRUE, 'working');
    END IF;
  END LOOP;

  /* ───── 7. weight entries (weekly over 6 weeks, gradual bulk) ───── */
  INSERT INTO weight_entries (user_id, weight, date, created_at) VALUES
    (uid, 60.0, (NOW() - INTERVAL '42 days')::DATE, NOW() - INTERVAL '42 days'),
    (uid, 60.3, (NOW() - INTERVAL '35 days')::DATE, NOW() - INTERVAL '35 days'),
    (uid, 60.6, (NOW() - INTERVAL '28 days')::DATE, NOW() - INTERVAL '28 days'),
    (uid, 60.9, (NOW() - INTERVAL '21 days')::DATE, NOW() - INTERVAL '21 days'),
    (uid, 61.1, (NOW() - INTERVAL '14 days')::DATE, NOW() - INTERVAL '14 days'),
    (uid, 61.4, (NOW() - INTERVAL '7  days')::DATE, NOW() - INTERVAL '7 days'),
    (uid, 61.7,  CURRENT_DATE,                        NOW());

  /* ───── 8. body fat entries (3 monthly) ───── */
  INSERT INTO body_fat_entries (user_id, value, method, date) VALUES
    (uid, 14.5, 'tape', (NOW() - INTERVAL '60 days')::DATE),
    (uid, 14.8, 'tape', (NOW() - INTERVAL '30 days')::DATE),
    (uid, 15.1, 'tape',  CURRENT_DATE);

  /* ───── 9. measurements ───── */
  INSERT INTO measurement_entries (user_id, body_part, side, value, date) VALUES
    (uid, 'chest', NULL, 101.5, CURRENT_DATE),
    (uid, 'waist', NULL, 78.0,  CURRENT_DATE),
    (uid, 'arm',  'left',  37.5, CURRENT_DATE),
    (uid, 'arm',  'right', 38.0, CURRENT_DATE),
    (uid, 'thigh','left',  57.0, CURRENT_DATE),
    (uid, 'thigh','right', 57.2, CURRENT_DATE);

  /* ───── 10. water + creatine (last 10 days) ───── */
  FOR i IN 0..9 LOOP
    INSERT INTO supplement_entries (user_id, type, amount, date, created_at) VALUES
      (uid, 'water',    500, (CURRENT_DATE - i), NOW() - (i || ' days')::INTERVAL + INTERVAL '8 hours'),
      (uid, 'water',    500, (CURRENT_DATE - i), NOW() - (i || ' days')::INTERVAL + INTERVAL '11 hours'),
      (uid, 'water',    750, (CURRENT_DATE - i), NOW() - (i || ' days')::INTERVAL + INTERVAL '14 hours'),
      (uid, 'water',    500, (CURRENT_DATE - i), NOW() - (i || ' days')::INTERVAL + INTERVAL '17 hours'),
      (uid, 'water',    750, (CURRENT_DATE - i), NOW() - (i || ' days')::INTERVAL + INTERVAL '20 hours'),
      (uid, 'creatine',   5, (CURRENT_DATE - i), NOW() - (i || ' days')::INTERVAL + INTERVAL '9 hours');
  END LOOP;

  /* ───── 11. food entries (last 7 days × 4 meals) ───── */
  FOR i IN 0..6 LOOP
    INSERT INTO food_entries (user_id, name, calories, protein, carbs, fat, fiber, meal_type, quantity, serving_size, serving_unit, created_at) VALUES
      (uid, 'Oats with banana and whey', 520, 35, 78, 9,  8, 'breakfast', 1, 1, 'bowl',   NOW() - (i || ' days')::INTERVAL + INTERVAL '8 hours'),
      (uid, 'Greek yogurt',              180, 20, 12, 4,  0, 'breakfast', 1, 200, 'g',    NOW() - (i || ' days')::INTERVAL + INTERVAL '8 hours 30 min'),
      (uid, 'Chicken breast, rice, veg', 680, 55, 72, 14, 6, 'lunch',     1, 1, 'plate',  NOW() - (i || ' days')::INTERVAL + INTERVAL '13 hours'),
      (uid, 'Protein shake',             240, 40,  6, 3,  1, 'snack',     1, 1, 'shake',  NOW() - (i || ' days')::INTERVAL + INTERVAL '16 hours'),
      (uid, 'Salmon, sweet potato',      720, 45, 58, 28, 7, 'dinner',    1, 1, 'plate',  NOW() - (i || ' days')::INTERVAL + INTERVAL '19 hours 30 min'),
      (uid, 'Almonds',                   180,  7,  6, 15, 4, 'snack',     1, 30, 'g',     NOW() - (i || ' days')::INTERVAL + INTERVAL '21 hours');
  END LOOP;

  /* ───── 12. user_streaks ───── */
  INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_workout_date)
    VALUES (uid, 5, 8, CURRENT_DATE);

  /* ───── 13. sample AI coach conversation ───── */
  INSERT INTO ai_coach_messages (user_id, role, content, created_at) VALUES
    (uid, 'user',      'Analyse my training this week',
       NOW() - INTERVAL '2 days' - INTERVAL '3 hours'),
    (uid, 'assistant', 'Strong week — 4 sessions, ~18,200kg total volume. Bench hit 85×5 (new PR territory), squat 110×5 is holding steady. Pull volume slightly below push, consider adding a set of rows next pull day.',
       NOW() - INTERVAL '2 days' - INTERVAL '3 hours' + INTERVAL '3 seconds'),
    (uid, 'user',      'What should I train tomorrow?',
       NOW() - INTERVAL '1 days'),
    (uid, 'assistant', 'Legs — your last leg day was 4 days ago. Prescription: Squat 4×5 @ 110kg, RDL 4×8 @ 90kg, Leg Press 3×10, Leg Curl 3×10, Calf Raise 4×12.',
       NOW() - INTERVAL '1 days' + INTERVAL '3 seconds');

END $$;

-- Sanity check
SELECT
  (SELECT COUNT(*) FROM workouts       WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732') AS workouts,
  (SELECT COUNT(*) FROM exercises      WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732')) AS exercises,
  (SELECT COUNT(*) FROM sets           WHERE exercise_id IN (SELECT id FROM exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732'))) AS total_sets,
  (SELECT COUNT(*) FROM routines       WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732') AS routines,
  (SELECT COUNT(*) FROM food_entries   WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732') AS food_entries,
  (SELECT COUNT(*) FROM weight_entries WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732') AS weights,
  (SELECT COUNT(*) FROM supplement_entries WHERE user_id = 'f2ec58c9-63d2-4325-ad5b-cfd364e64732') AS supplements;
