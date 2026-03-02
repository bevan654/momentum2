-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.activity_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_id uuid,
  duration integer NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  exercise_names ARRAY NOT NULL DEFAULT '{}'::text[],
  total_exercises integer NOT NULL DEFAULT 0,
  total_sets integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_feed_pkey PRIMARY KEY (id),
  CONSTRAINT activity_feed_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT activity_feed_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.workouts(id)
);
CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workout_id uuid,
  name text,
  exercise_order integer,
  created_at timestamp with time zone DEFAULT now(),
  exercise_type text NOT NULL DEFAULT 'weighted'::text,
  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT exercises_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES public.workouts(id)
);
CREATE TABLE public.exercises_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  primary_muscles ARRAY NOT NULL DEFAULT '{}'::text[],
  secondary_muscles ARRAY NOT NULL DEFAULT '{}'::text[],
  other_muscles ARRAY NOT NULL DEFAULT '{}'::text[],
  equipment ARRAY NOT NULL DEFAULT '{}'::text[],
  movement_type text,
  force_type text,
  category text,
  difficulty smallint,
  video_demo_url text,
  svg_demo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercises_catalog_pkey PRIMARY KEY (id)
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
  scanned_by uuid NOT NULL,
  scan_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT barcode_foods_pkey PRIMARY KEY (id),
  CONSTRAINT barcode_foods_barcode_key UNIQUE (barcode),
  CONSTRAINT barcode_foods_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id)
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
  confidence text NOT NULL DEFAULT 'verified'::text CHECK (confidence = ANY (ARRAY['verified'::text, 'user_submitted'::text, 'estimated'::text])),
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
  CONSTRAINT food_catalog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.food_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  meal_type text NOT NULL CHECK (meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'meal_1'::text, 'meal_2'::text, 'meal_3'::text, 'meal_4'::text, 'meal_5'::text, 'meal_6'::text, 'meal_7'::text, 'meal_8'::text])),
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
  CONSTRAINT food_entries_pkey PRIMARY KEY (id),
  CONSTRAINT food_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT food_entries_food_catalog_id_fkey FOREIGN KEY (food_catalog_id) REFERENCES public.food_catalog(id)
);
CREATE TABLE public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::friendship_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id)
);
CREATE TABLE public.leaderboard_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  week_start date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_entries_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  CONSTRAINT meal_config_pkey PRIMARY KEY (id),
  CONSTRAINT meal_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.nudges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nudges_pkey PRIMARY KEY (id),
  CONSTRAINT nudges_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id),
  CONSTRAINT nudges_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id)
);
CREATE TABLE public.nutrition_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  calorie_goal numeric NOT NULL DEFAULT 2000,
  protein_goal numeric NOT NULL DEFAULT 150,
  carbs_goal numeric NOT NULL DEFAULT 250,
  fat_goal numeric NOT NULL DEFAULT 65,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nutrition_goals_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  username text UNIQUE,
  height numeric,
  age integer,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text])),
  university text NOT NULL DEFAULT ''::text,
  dob date,
  push_token text,
  is_locked boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activity_feed(id),
  CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.routine_exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  routine_id uuid NOT NULL,
  name text NOT NULL,
  exercise_order integer NOT NULL,
  default_sets integer NOT NULL DEFAULT 3,
  exercise_type text NOT NULL DEFAULT 'weighted'::text,
  CONSTRAINT routine_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT routine_exercises_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES public.routines(id)
);
CREATE TABLE public.routines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT routines_pkey PRIMARY KEY (id),
  CONSTRAINT routines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
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
  CONSTRAINT sets_pkey PRIMARY KEY (id),
  CONSTRAINT sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);
CREATE TABLE public.supplement_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT supplement_entries_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.supplement_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  water_goal numeric NOT NULL DEFAULT 2500,
  creatine_goal numeric NOT NULL DEFAULT 5,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT supplement_goals_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_created_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  serving_size numeric NOT NULL DEFAULT 1,
  serving_unit text NOT NULL DEFAULT 'serving'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_created_foods_pkey PRIMARY KEY (id),
  CONSTRAINT user_created_foods_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
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
  CONSTRAINT user_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT user_exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_exercises_user_slug_unique UNIQUE (user_id, slug)
);
CREATE TABLE public.weight_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  weight numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT weight_entries_pkey PRIMARY KEY (id),
  CONSTRAINT weight_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.workouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  duration integer,
  total_exercises integer,
  total_sets integer,
  CONSTRAINT workouts_pkey PRIMARY KEY (id),
  CONSTRAINT workouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_streaks (
  user_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_workout_date date,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);