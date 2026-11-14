-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Generated from the live schema (production + supabase/migrations up to 20261118).
-- Column comments are shown as trailing -- notes.

CREATE TABLE public.activity_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_id uuid,
  duration integer NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  exercise_names text[] NOT NULL DEFAULT '{}'::text[],
  total_exercises integer NOT NULL DEFAULT 0,
  total_sets integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ghost_username text,
  ghost_result text,
  ghost_exercises jsonb,
  program_id uuid,
  program_name text,
  program_week integer,
  program_total_weeks integer,
  program_day_label text,
  routine_name text,
  exercise_details jsonb,
  friends_only boolean NOT NULL DEFAULT false,  -- When true, this post is hidden from the global feed and shown only to the author and their friends.
  title text,  -- Optional user-supplied title shown above the workout stats on the feed card.
  caption text,  -- Optional free-text caption displayed below the workout stats on the feed card.
  CONSTRAINT activity_feed_pkey PRIMARY KEY (id),
  CONSTRAINT activity_feed_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  CONSTRAINT activity_feed_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT activity_feed_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
);

CREATE TABLE public.ai_coach_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_coach_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ai_coach_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_coach_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE public.ai_food_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  search_query text NOT NULL,
  name text NOT NULL,
  brand text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  serving_size numeric NOT NULL DEFAULT 100,
  serving_unit text NOT NULL DEFAULT 'g'::text,
  vitamin_a real,
  vitamin_c real,
  vitamin_d real,
  vitamin_e real,
  vitamin_k real,
  vitamin_b6 real,
  vitamin_b12 real,
  folate real,
  calcium real,
  iron real,
  magnesium real,
  potassium real,
  zinc real,
  sodium real,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_food_cache_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ai_notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subtype text NOT NULL,
  sent_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc'::text))::date,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_notification_log_one_per_day UNIQUE (user_id, sent_date),
  CONSTRAINT ai_notification_log_pkey PRIMARY KEY (id),
  CONSTRAINT ai_notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_notification_log_subtype_check CHECK ((subtype = ANY (ARRAY['streak_risk'::text, 'neglected_muscle'::text, 'overload_nudge'::text, 'comeback'::text])))
);

CREATE TABLE public.ai_usage (
  id bigint NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_pkey PRIMARY KEY (id),
  CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.app_config (
  id integer NOT NULL DEFAULT 1,
  min_supported_version text NOT NULL,
  ios_min_supported_version text,
  android_min_supported_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_config_pkey PRIMARY KEY (id),
  CONSTRAINT singleton CHECK ((id = 1))
);

CREATE TABLE public.barcode_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  name text NOT NULL,
  brand text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  serving_size numeric NOT NULL DEFAULT 100,
  serving_unit text NOT NULL DEFAULT 'g'::text,
  vitamin_a real,
  vitamin_c real,
  vitamin_d real,
  vitamin_e real,
  vitamin_k real,
  vitamin_b6 real,
  vitamin_b12 real,
  folate real,
  calcium real,
  iron real,
  magnesium real,
  potassium real,
  zinc real,
  sodium real,
  scanned_by uuid,
  scan_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  caffeine real,
  CONSTRAINT barcode_foods_barcode_key UNIQUE (barcode),
  CONSTRAINT barcode_foods_pkey PRIMARY KEY (id),
  CONSTRAINT barcode_foods_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.body_fat_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  value numeric NOT NULL,
  method text NOT NULL DEFAULT 'tape'::text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT body_fat_entries_pkey PRIMARY KEY (id),
  CONSTRAINT body_fat_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid,
  text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activity_feed(id) ON DELETE CASCADE,
  CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT comments_text_check CHECK (((char_length(text) >= 1) AND (char_length(text) <= 1000)))
);

CREATE TABLE public.content_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_user_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT content_reports_pkey PRIMARY KEY (id),
  CONSTRAINT content_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT content_reports_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT content_reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'harassment'::text, 'hate_speech'::text, 'sexual_content'::text, 'violence'::text, 'self_harm'::text, 'impersonation'::text, 'other'::text]))),
  CONSTRAINT content_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'actioned'::text, 'dismissed'::text]))),
  CONSTRAINT content_reports_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'activity'::text, 'comment'::text, 'message'::text, 'nudge'::text])))
);

CREATE TABLE public.data_change_log (
  id bigint NOT NULL DEFAULT nextval('data_change_log_id_seq'::regclass),
  batch text NOT NULL,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  column_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT data_change_log_pkey PRIMARY KEY (id)
);

CREATE TABLE public.exercise_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  canonical_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exercise_aliases_alias_key UNIQUE (alias),
  CONSTRAINT exercise_aliases_pkey PRIMARY KEY (id)
);

CREATE TABLE public.exercise_muscle_targets (
  catalog_id text NOT NULL,
  muscle_id text NOT NULL,
  role text NOT NULL,
  weight numeric NOT NULL,  -- Share of the exercise's work credited to this muscle (0-1). Import default: primary 1.0, secondary 0.5.
  CONSTRAINT exercise_muscle_targets_pkey PRIMARY KEY (catalog_id, muscle_id),
  CONSTRAINT exercise_muscle_targets_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES exercises_catalog(id) ON DELETE CASCADE,
  CONSTRAINT exercise_muscle_targets_muscle_id_fkey FOREIGN KEY (muscle_id) REFERENCES muscles(id) ON UPDATE CASCADE,
  CONSTRAINT exercise_muscle_targets_role_valid CHECK ((role = ANY (ARRAY['primary'::text, 'secondary'::text]))),
  CONSTRAINT exercise_muscle_targets_weight_range CHECK (((weight >= (0)::numeric) AND (weight <= (1)::numeric)))
);

CREATE TABLE public.exercise_region_targets (
  catalog_id text NOT NULL,  -- Catalog exercise.
  map_id text NOT NULL,  -- Renderer and version whose region ids these are, e.g. momentum-muscle-map@0.1.0.
  region text NOT NULL,  -- Unsided region slug of that map, at part or muscle level (e.g. pectoralis_major_clavicular). Never a non-muscle region.
  weight numeric(3,2) NOT NULL,  -- How hard the exercise works the region, 0-1; the strongest region of each exercise is 1. Prime movers 0.9-1, major synergists 0.4-0.7, minor/stabilisers 0.15-0.3.
  source text NOT NULL,  -- hand = tuned by hand (scripts/catalog/region_overrides.json); rule = derived from exercise_muscle_targets plus name keyword rules.
  CONSTRAINT exercise_region_targets_pkey PRIMARY KEY (catalog_id, map_id, region),
  CONSTRAINT exercise_region_targets_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES exercises_catalog(id) ON DELETE CASCADE,
  CONSTRAINT exercise_region_targets_region_unsided CHECK (((region ~ '^[a-z][a-z0-9_]*$'::text) AND (region !~ '_(left|right)$'::text))),
  CONSTRAINT exercise_region_targets_source_valid CHECK ((source = ANY (ARRAY['hand'::text, 'rule'::text]))),
  CONSTRAINT exercise_region_targets_weight_range CHECK (((weight > (0)::numeric) AND (weight <= (1)::numeric)))
);

CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workout_id uuid,
  name text,
  exercise_order integer,
  created_at timestamp with time zone DEFAULT now(),
  exercise_type text NOT NULL DEFAULT 'weighted'::text,
  notes text,
  note_color text,
  catalog_id text,  -- Catalog exercise this row refers to (resolved from name). NULL = custom or unknown.
  user_exercise_id uuid,  -- User custom exercise this row refers to (resolved from name).
  superset_group smallint,  -- Exercises in the same workout sharing a value were supersetted.
  rest_target_seconds integer,  -- Planned rest between sets for this exercise.
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES exercises_catalog(id) ON DELETE SET NULL,
  CONSTRAINT exercises_user_exercise_id_fkey FOREIGN KEY (user_exercise_id) REFERENCES user_exercises(id) ON DELETE SET NULL,
  CONSTRAINT exercises_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
  CONSTRAINT exercises_rest_target_nonneg CHECK ((rest_target_seconds >= 0)),
  CONSTRAINT exercises_superset_group_nonneg CHECK ((superset_group >= 0))
);

CREATE TABLE public.exercises_catalog (
  id text NOT NULL,
  name text,
  slug text,
  primary_muscles jsonb,  -- Legacy muscle names read by every app build (see MUSCLE_ALIASES). Anatomical detail: exercise_muscle_targets.
  secondary_muscles jsonb,
  other_muscles jsonb,
  equipment jsonb,
  movement_type text,
  force_type text,
  category text,
  difficulty bigint,
  video_demo_url text,
  svg_demo text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_main_lift boolean,
  ranking_weight double precision,
  is_bodyweight boolean,
  allows_external_weight boolean,
  repdb_id text,  -- RepDB exercise this row was matched to or imported from (provenance). NULL = our own exercise.
  is_hidden boolean DEFAULT false,  -- Hidden from the exercise picker and search. Still resolves for history. NULL = visible.
  exercise_type text,  -- weighted | bodyweight | weighted+bodyweight | duration. NULL = derive from is_bodyweight / allows_external_weight.
  description text,  -- Short description (RepDB).
  instructions jsonb,  -- Step-by-step instructions, JSON array of strings (RepDB).
  tips jsonb,  -- Coaching tips, JSON array of strings (RepDB).
  is_unilateral boolean,  -- Trained one side at a time.
  body_part text,  -- RepDB body part: chest, back, shoulders, upper_arms, lower_arms, core, upper_legs, lower_legs, full_body.
  CONSTRAINT exercises_catalog_name_unique UNIQUE (name),
  CONSTRAINT exercises_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_catalog_exercise_type_valid CHECK ((exercise_type = ANY (ARRAY['weighted'::text, 'bodyweight'::text, 'weighted+bodyweight'::text, 'duration'::text])))
);

CREATE TABLE public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flag text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_user_flag_key UNIQUE (user_id, flag),
  CONSTRAINT feature_flags_pkey PRIMARY KEY (id),
  CONSTRAINT feature_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.food_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric NOT NULL DEFAULT 0,
  sugar numeric NOT NULL DEFAULT 0,
  serving_size numeric NOT NULL DEFAULT 100,
  serving_unit text NOT NULL DEFAULT 'g'::text,
  confidence text NOT NULL DEFAULT 'verified'::text,
  popularity integer NOT NULL DEFAULT 0,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  vitamin_a real,
  vitamin_c real,
  vitamin_d real,
  vitamin_e real,
  vitamin_k real,
  vitamin_b6 real,
  vitamin_b12 real,
  folate real,
  calcium real,
  iron real,
  magnesium real,
  potassium real,
  zinc real,
  sodium real,
  CONSTRAINT food_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT food_catalog_confidence_check CHECK ((confidence = ANY (ARRAY['verified'::text, 'user_submitted'::text, 'estimated'::text])))
);

CREATE TABLE public.food_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  meal_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  brand text,
  food_catalog_id uuid,
  serving_size numeric,
  serving_unit text,
  quantity numeric NOT NULL DEFAULT 1,
  fiber real,
  sugar real,
  vitamin_a real,
  vitamin_c real,
  vitamin_d real,
  vitamin_e real,
  vitamin_k real,
  vitamin_b6 real,
  vitamin_b12 real,
  folate real,
  calcium real,
  iron real,
  magnesium real,
  potassium real,
  zinc real,
  sodium real,
  is_planned boolean NOT NULL DEFAULT false,
  meal_group_id uuid,
  meal_group_name text,
  caffeine real,
  CONSTRAINT food_entries_pkey PRIMARY KEY (id),
  CONSTRAINT food_entries_food_catalog_id_fkey FOREIGN KEY (food_catalog_id) REFERENCES food_catalog(id) ON DELETE SET NULL,
  CONSTRAINT food_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT food_entries_meal_type_check CHECK ((meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'meal_1'::text, 'meal_2'::text, 'meal_3'::text, 'meal_4'::text, 'meal_5'::text, 'meal_6'::text, 'meal_7'::text, 'meal_8'::text])))
);

CREATE TABLE public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status friendship_status NOT NULL DEFAULT 'pending'::friendship_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT friendships_user_id_friend_id_key UNIQUE (user_id, friend_id),
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.leaderboard_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type leaderboard_type NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  week_start date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_entries_user_id_type_week_start_key UNIQUE (user_id, type, week_start),
  CONSTRAINT leaderboard_entries_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.leaderboard_rank_snapshots (
  user_id uuid NOT NULL,
  board_type text NOT NULL,
  rank integer NOT NULL,
  value numeric NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_rank_snapshots_pkey PRIMARY KEY (user_id, board_type),
  CONSTRAINT leaderboard_rank_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT leaderboard_rank_snapshots_board_type_check CHECK ((board_type = ANY (ARRAY['strength'::text, 'bench'::text, 'squat'::text, 'deadlift'::text, 'streak'::text, 'streak_best'::text])))
);

CREATE TABLE public.meal_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slot text NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'restaurant-outline'::text,
  time_start text NOT NULL DEFAULT '08:00'::text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT meal_config_user_id_slot_key UNIQUE (user_id, slot),
  CONSTRAINT meal_config_pkey PRIMARY KEY (id),
  CONSTRAINT meal_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.measurement_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body_part text NOT NULL,
  side text,
  pump_state text NOT NULL DEFAULT 'no_pump'::text,
  value numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT measurement_entries_pkey PRIMARY KEY (id),
  CONSTRAINT measurement_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.muscle_map_regions (
  map_id text NOT NULL,
  muscle_id text NOT NULL,
  region text NOT NULL,
  CONSTRAINT muscle_map_regions_pkey PRIMARY KEY (map_id, muscle_id, region),
  CONSTRAINT muscle_map_regions_muscle_id_fkey FOREIGN KEY (muscle_id) REFERENCES muscles(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE public.muscles (
  id text NOT NULL,
  label text NOT NULL,
  body_group text NOT NULL,
  sort smallint NOT NULL,
  CONSTRAINT muscles_pkey PRIMARY KEY (id),
  CONSTRAINT muscles_body_group_valid CHECK ((body_group = ANY (ARRAY['chest'::text, 'back'::text, 'shoulders'::text, 'arms'::text, 'core'::text, 'legs'::text])))
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nudges_pkey PRIMARY KEY (id),
  CONSTRAINT nudges_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT nudges_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.nutrition_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calorie_goal numeric NOT NULL DEFAULT 2000,
  protein_goal numeric NOT NULL DEFAULT 150,
  carbs_goal numeric NOT NULL DEFAULT 250,
  fat_goal numeric NOT NULL DEFAULT 65,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nutrition_goals_user_id_key UNIQUE (user_id),
  CONSTRAINT nutrition_goals_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  share_workouts boolean NOT NULL DEFAULT true,
  show_streak boolean NOT NULL DEFAULT true,
  notifications_enabled boolean NOT NULL DEFAULT true,
  leaderboard_opt_in boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  starting_weight numeric,
  username text,
  height numeric,
  age integer,
  gender text,
  dob date,
  push_token text,
  is_locked boolean NOT NULL DEFAULT false,
  last_seen timestamp with time zone DEFAULT now(),
  is_working_out boolean DEFAULT false,
  goal_weight numeric,
  ai_coach_enabled boolean NOT NULL DEFAULT false,  -- Feature flag: controls whether the user sees the AI coach in the Lab tab and can call the ai-coach edge function.
  ai_coach_daily_limit integer DEFAULT 7,
  CONSTRAINT profiles_username_key UNIQUE (username),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);

CREATE TABLE public.program_day_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_day_id uuid NOT NULL,
  name text NOT NULL,
  exercise_order integer NOT NULL DEFAULT 1,
  default_sets integer DEFAULT 3,
  default_reps integer DEFAULT 10,
  default_rest_seconds integer DEFAULT 90,
  set_reps integer[],
  set_weights numeric[],
  exercise_type text DEFAULT 'weighted'::text,
  CONSTRAINT program_day_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT program_day_exercises_program_day_id_fkey FOREIGN KEY (program_day_id) REFERENCES program_days(id) ON DELETE CASCADE
);

CREATE TABLE public.program_days (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  label text NOT NULL DEFAULT 'Workout'::text,
  CONSTRAINT program_days_program_id_day_of_week_key UNIQUE (program_id, day_of_week),
  CONSTRAINT program_days_pkey PRIMARY KEY (id),
  CONSTRAINT program_days_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
  CONSTRAINT program_days_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

CREATE TABLE public.programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  start_date date,
  end_date date,
  CONSTRAINT programs_pkey PRIMARY KEY (id),
  CONSTRAINT programs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT programs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'abandoned'::text])))
);

CREATE TABLE public.protein_powder_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  powder_id uuid,
  food_entry_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  amount numeric NOT NULL DEFAULT 1,
  CONSTRAINT protein_powder_log_pkey PRIMARY KEY (id),
  CONSTRAINT protein_powder_log_food_entry_id_fkey FOREIGN KEY (food_entry_id) REFERENCES food_entries(id) ON DELETE SET NULL,
  CONSTRAINT protein_powder_log_powder_id_fkey FOREIGN KEY (powder_id) REFERENCES protein_powders(id) ON DELETE SET NULL,
  CONSTRAINT protein_powder_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.protein_powders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT protein_powders_pkey PRIMARY KEY (id),
  CONSTRAINT protein_powders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type reaction_type,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  emoji text,
  CONSTRAINT reactions_activity_id_user_id_key UNIQUE (activity_id, user_id),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activity_feed(id) ON DELETE CASCADE,
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.routine_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL,
  name text NOT NULL,
  exercise_order integer NOT NULL,
  default_sets integer NOT NULL DEFAULT 3,
  exercise_type text NOT NULL DEFAULT 'weighted'::text,
  default_reps integer NOT NULL DEFAULT 10,
  default_rest_seconds integer NOT NULL DEFAULT 90,
  set_reps jsonb,
  set_weights jsonb,
  CONSTRAINT routine_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT routine_exercises_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE TABLE public.routines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  days jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT routines_pkey PRIMARY KEY (id),
  CONSTRAINT routines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.sets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercise_id uuid,
  set_number integer,
  kg numeric,
  reps integer,
  completed boolean DEFAULT false,
  set_type text,
  created_at timestamp with time zone DEFAULT now(),
  parent_set_number integer,
  rir numeric(3,1),  -- Reps in reserve (0-10, 5 = "5 or more"). Optional. RPE = 10 - rir.
  completed_at timestamp with time zone,  -- When the set was ticked off on the device.
  rest_seconds integer,  -- Rest actually taken before this set, measured by the rest timer.
  target_kg numeric,  -- Planned weight for this set (see target_source).
  target_reps integer,  -- Planned reps for this set (see target_source).
  target_source text,  -- Where the target came from: routine | program | progression | previous.
  side text,  -- Unilateral sets: left | right (one row per side). NULL = both sides.
  duration_seconds integer,  -- Timed/cardio sets. Legacy cardio rows keep their old kg/reps encoding.
  distance_m numeric,  -- Cardio distance in metres.
  CONSTRAINT sets_pkey PRIMARY KEY (id),
  CONSTRAINT sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
  CONSTRAINT sets_distance_m_nonneg CHECK ((distance_m >= (0)::numeric)),
  CONSTRAINT sets_duration_seconds_nonneg CHECK ((duration_seconds >= 0)),
  CONSTRAINT sets_rest_seconds_nonneg CHECK ((rest_seconds >= 0)),
  CONSTRAINT sets_rir_range CHECK (((rir >= (0)::numeric) AND (rir <= (10)::numeric))),
  CONSTRAINT sets_side_valid CHECK ((side = ANY (ARRAY['left'::text, 'right'::text]))),
  CONSTRAINT sets_target_reps_nonneg CHECK ((target_reps >= 0)),
  CONSTRAINT sets_target_source_valid CHECK ((target_source = ANY (ARRAY['routine'::text, 'program'::text, 'progression'::text, 'previous'::text])))
);

CREATE TABLE public.supplement_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT supplement_entries_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.supplement_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  water_goal numeric NOT NULL DEFAULT 2500,
  creatine_goal numeric NOT NULL DEFAULT 5,
  updated_at timestamp with time zone DEFAULT now(),
  protein_powder_scoop_goal integer NOT NULL DEFAULT 0,
  CONSTRAINT supplement_goals_user_id_key UNIQUE (user_id),
  CONSTRAINT supplement_goals_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.user_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  exercise_type text NOT NULL DEFAULT 'weighted'::text,
  primary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  secondary_muscles text[] NOT NULL DEFAULT '{}'::text[],
  other_muscles text[] NOT NULL DEFAULT '{}'::text[],
  equipment text[] NOT NULL DEFAULT '{}'::text[],
  movement_type text,
  force_type text,
  category text NOT NULL DEFAULT 'Custom'::text,
  difficulty smallint,
  video_demo_url text,
  svg_demo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_exercises_user_slug_unique UNIQUE (user_id, slug),
  CONSTRAINT user_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT user_exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.user_ranks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rank_name text NOT NULL DEFAULT 'Novice'::text,
  overall_score numeric NOT NULL DEFAULT 0,
  rank_progress numeric NOT NULL DEFAULT 0,
  diversity_bonus numeric NOT NULL DEFAULT 0,
  total_workouts integer NOT NULL DEFAULT 0,
  is_provisional boolean NOT NULL DEFAULT true,
  best_sets jsonb NOT NULL DEFAULT '{}'::jsonb,
  muscle_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slug_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT user_ranks_user_id_unique UNIQUE (user_id),
  CONSTRAINT user_ranks_pkey PRIMARY KEY (id),
  CONSTRAINT user_ranks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.user_streaks (
  user_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_workout_date date,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.user_supplements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  daily_goal numeric NOT NULL DEFAULT 5,
  unit text NOT NULL DEFAULT 'g'::text,
  icon text NOT NULL DEFAULT 'flash-outline'::text,
  color text NOT NULL DEFAULT '#FBBF24'::text,
  increments jsonb NOT NULL DEFAULT '[5, 1]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_supplements_user_id_key_key UNIQUE (user_id, key),
  CONSTRAINT user_supplements_pkey PRIMARY KEY (id),
  CONSTRAINT user_supplements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.waitlist (
  id bigint NOT NULL DEFAULT nextval('waitlist_id_seq'::regclass),
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT waitlist_email_key UNIQUE (email),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);

CREATE TABLE public.weight_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weight numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weight_entries_user_id_date_key UNIQUE (user_id, date),
  CONSTRAINT weight_entries_pkey PRIMARY KEY (id),
  CONSTRAINT weight_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.workout_finish_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_id uuid,
  response text NOT NULL,
  campaign text NOT NULL,
  build_version text NOT NULL,
  source text NOT NULL DEFAULT 'post_workout'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workout_finish_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT workout_finish_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_finish_feedback_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL,
  CONSTRAINT workout_finish_feedback_response_check CHECK ((response = ANY (ARRAY['worked_normally'::text, 'had_issue'::text]))),
  CONSTRAINT workout_finish_feedback_source_check CHECK ((source = 'post_workout'::text))
);

CREATE TABLE public.workouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  duration integer,
  total_exercises integer,
  total_sets integer,
  ghost_username text,
  program_id uuid,
  program_week integer,
  photo_path text,  -- Object path in the workout_photos storage bucket (e.g. "{user_id}/{workout_id}.jpg"). Resolve to URL at read time.
  photo_thumb_path text,  -- Optional dedicated thumbnail path. When null, callers should request a resized variant of photo_path via Supabase Image Transformations.
  coach_headline text,
  coach_notes jsonb,
  client_op_id uuid,
  started_at timestamp with time zone,  -- Session start (device clock). NULL for workouts logged before this column existed.
  ended_at timestamp with time zone,  -- Session end (device clock).
  timezone text,  -- IANA timezone of the device, e.g. Australia/Adelaide.
  utc_offset_min smallint,  -- UTC offset in minutes at started_at (e.g. 630 for +10:30).
  program_day_of_week smallint,  -- Program day (0 = Monday) when started from a program. Stable across program edits.
  program_day_label text,  -- Program day label at the time of the workout (snapshot).
  routine_id uuid,  -- Routine the workout was started from.
  bodyweight_kg numeric,  -- Latest weigh-in at the time of the workout.
  source text,  -- How the workout was started: empty | routine | program | ghost.
  CONSTRAINT workouts_pkey PRIMARY KEY (id),
  CONSTRAINT workouts_program_id_fkey FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL,
  CONSTRAINT workouts_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL,
  CONSTRAINT workouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workouts_bodyweight_range CHECK (((bodyweight_kg > (0)::numeric) AND (bodyweight_kg < (500)::numeric))),
  CONSTRAINT workouts_ended_after_started CHECK (((started_at IS NULL) OR (ended_at IS NULL) OR (ended_at >= started_at))),
  CONSTRAINT workouts_program_dow_range CHECK (((program_day_of_week >= 0) AND (program_day_of_week <= 6))),
  CONSTRAINT workouts_source_valid CHECK ((source = ANY (ARRAY['empty'::text, 'routine'::text, 'program'::text, 'ghost'::text]))),
  CONSTRAINT workouts_utc_offset_range CHECK (((utc_offset_min >= '-840'::integer) AND (utc_offset_min <= 840)))
);

