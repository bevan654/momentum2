-- ============================================================
-- FULL COMMERCIAL GYM EXERCISE CATALOG
-- Safe to run multiple times — skips existing exercises by slug
-- Sources: StrengthLog, Muscle & Strength, ACE, aworkoutroutine
-- ============================================================

insert into public.exercises_catalog (
  id, name, slug, primary_muscles, secondary_muscles, other_muscles,
  equipment, movement_type, force_type, category, difficulty,
  video_demo_url, svg_demo, created_at, updated_at
) values

-- =====================
-- CHEST (9 new)
-- =====================

(gen_random_uuid(),'dips','dips',
 ARRAY['chest','triceps'],ARRAY['shoulders'],ARRAY[]::text[],ARRAY['bodyweight'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'close-grip bench press','close-grip-bench-press',
 ARRAY['triceps','chest'],ARRAY['shoulders'],ARRAY[]::text[],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'dumbbell chest fly','dumbbell-chest-fly',
 ARRAY['chest'],ARRAY['shoulders'],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'incline dumbbell fly','incline-dumbbell-fly',
 ARRAY['upper chest'],ARRAY['shoulders'],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'dumbbell pullover','dumbbell-pullover',
 ARRAY['chest','lats'],ARRAY['triceps'],ARRAY[]::text[],ARRAY['dumbbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'decline push-up','decline-push-up',
 ARRAY['upper chest'],ARRAY['triceps','shoulders'],ARRAY['core'],ARRAY['bodyweight'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'smith machine incline bench press','smith-machine-incline-bench-press',
 ARRAY['upper chest'],ARRAY['triceps','shoulders'],ARRAY[]::text[],ARRAY['machine'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'cable chest fly','cable-chest-fly',
 ARRAY['chest'],ARRAY['shoulders'],ARRAY[]::text[],ARRAY['cable'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'cable chest press','cable-chest-press',
 ARRAY['chest'],ARRAY['triceps','shoulders'],ARRAY[]::text[],ARRAY['cable'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'decline dumbbell press','decline-dumbbell-press',
 ARRAY['chest'],ARRAY['triceps','shoulders'],ARRAY[]::text[],ARRAY['dumbbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

-- =====================
-- BACK (11 new)
-- =====================

(gen_random_uuid(),'barbell shrug','barbell-shrug',
 ARRAY['traps'],ARRAY[]::text[],ARRAY['forearms'],ARRAY['barbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'dumbbell shrug','dumbbell-shrug',
 ARRAY['traps'],ARRAY[]::text[],ARRAY['forearms'],ARRAY['dumbbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'chest-supported dumbbell row','chest-supported-dumbbell-row',
 ARRAY['lats','middle back'],ARRAY['biceps','rear delts'],ARRAY[]::text[],ARRAY['dumbbell'],
 'compound','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'good morning','good-morning',
 ARRAY['hamstrings','lower back'],ARRAY['glutes'],ARRAY[]::text[],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'inverted row','inverted-row',
 ARRAY['middle back','lats'],ARRAY['biceps','rear delts'],ARRAY['core'],ARRAY['bodyweight'],
 'compound','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'pendlay row','pendlay-row',
 ARRAY['middle back','lats'],ARRAY['biceps','rear delts'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'rack pull','rack-pull',
 ARRAY['lower back','traps'],ARRAY['glutes','hamstrings'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'stiff-legged deadlift','stiff-legged-deadlift',
 ARRAY['hamstrings','lower back'],ARRAY['glutes'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'trap bar deadlift','trap-bar-deadlift',
 ARRAY['quadriceps','glutes','hamstrings'],ARRAY['lower back','traps'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'back extension','back-extension',
 ARRAY['lower back'],ARRAY['glutes','hamstrings'],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'underhand barbell row','underhand-barbell-row',
 ARRAY['lats','middle back'],ARRAY['biceps'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

-- =====================
-- SHOULDERS (6 new)
-- =====================

(gen_random_uuid(),'overhead press','overhead-press',
 ARRAY['shoulders'],ARRAY['triceps'],ARRAY['upper chest','core'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'behind the neck press','behind-the-neck-press',
 ARRAY['shoulders'],ARRAY['triceps'],ARRAY['traps'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'landmine press','landmine-press',
 ARRAY['shoulders','upper chest'],ARRAY['triceps'],ARRAY['core'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'machine lateral raise','machine-lateral-raise',
 ARRAY['shoulders'],ARRAY['traps'],ARRAY[]::text[],ARRAY['machine'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'reverse dumbbell fly','reverse-dumbbell-fly',
 ARRAY['rear delts'],ARRAY['middle back','traps'],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'band pull-apart','band-pull-apart',
 ARRAY['rear delts'],ARRAY['middle back','traps'],ARRAY[]::text[],ARRAY['other'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

-- =====================
-- BICEPS (6 new)
-- =====================

(gen_random_uuid(),'dumbbell curl','dumbbell-curl',
 ARRAY['biceps'],ARRAY['forearms'],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell preacher curl','barbell-preacher-curl',
 ARRAY['biceps'],ARRAY['brachialis'],ARRAY['forearms'],ARRAY['barbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'concentration curl','concentration-curl',
 ARRAY['biceps'],ARRAY['brachialis'],ARRAY['forearms'],ARRAY['dumbbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'incline dumbbell curl','incline-dumbbell-curl',
 ARRAY['biceps'],ARRAY['brachialis'],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'reverse barbell curl','reverse-barbell-curl',
 ARRAY['forearms','biceps'],ARRAY['brachialis'],ARRAY[]::text[],ARRAY['barbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'spider curl','spider-curl',
 ARRAY['biceps'],ARRAY['brachialis'],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','pull','strength',2,NULL,NULL,now(),now()),

-- =====================
-- TRICEPS (5 new)
-- =====================

(gen_random_uuid(),'bench dip','bench-dip',
 ARRAY['triceps'],ARRAY['chest','shoulders'],ARRAY[]::text[],ARRAY['bodyweight'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'close-grip push-up','close-grip-push-up',
 ARRAY['triceps'],ARRAY['chest','shoulders'],ARRAY['core'],ARRAY['bodyweight'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'overhead cable triceps extension','overhead-cable-triceps-extension',
 ARRAY['triceps'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['cable'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'tricep kickback','tricep-kickback',
 ARRAY['triceps'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['dumbbell'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'rope tricep pushdown','rope-tricep-pushdown',
 ARRAY['triceps'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['cable'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

-- =====================
-- LEGS (8 new)
-- =====================

(gen_random_uuid(),'barbell lunge','barbell-lunge',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings'],ARRAY['core'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'goblet squat','goblet-squat',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings'],ARRAY['core'],ARRAY['dumbbell'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'glute ham raise','glute-ham-raise',
 ARRAY['hamstrings','glutes'],ARRAY['lower back'],ARRAY[]::text[],ARRAY['bodyweight'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'lying leg curl','lying-leg-curl',
 ARRAY['hamstrings'],ARRAY['calves'],ARRAY['glutes'],ARRAY['machine'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'safety bar squat','safety-bar-squat',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings'],ARRAY['core','upper back'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'single leg deadlift','single-leg-deadlift',
 ARRAY['hamstrings','glutes'],ARRAY['lower back'],ARRAY['core'],ARRAY['dumbbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'step up','step-up',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings'],ARRAY['calves'],ARRAY['dumbbell'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'box jump','box-jump',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings','calves'],ARRAY[]::text[],ARRAY['bodyweight'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

-- =====================
-- GLUTES (1 new)
-- =====================

(gen_random_uuid(),'cable pull through','cable-pull-through',
 ARRAY['glutes','hamstrings'],ARRAY['lower back'],ARRAY[]::text[],ARRAY['cable'],
 'compound','pull','strength',1,NULL,NULL,now(),now()),

-- =====================
-- CORE / ABS (11 new)
-- =====================

(gen_random_uuid(),'bicycle crunch','bicycle-crunch',
 ARRAY['abs','obliques'],ARRAY[]::text[],ARRAY['hip flexors'],ARRAY['bodyweight'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'crunch','crunch',
 ARRAY['abs'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'dead bug','dead-bug',
 ARRAY['abs','core'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'hanging knee raise','hanging-knee-raise',
 ARRAY['abs','hip flexors'],ARRAY['obliques'],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'cable wood chop','cable-wood-chop',
 ARRAY['obliques','abs'],ARRAY['shoulders'],ARRAY['core'],ARRAY['cable'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'lying leg raise','lying-leg-raise',
 ARRAY['abs','hip flexors'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'machine crunch','machine-crunch',
 ARRAY['abs'],ARRAY['obliques'],ARRAY[]::text[],ARRAY['machine'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'mountain climbers','mountain-climbers',
 ARRAY['abs','hip flexors'],ARRAY['shoulders','core'],ARRAY[]::text[],ARRAY['bodyweight'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'pallof press','pallof-press',
 ARRAY['core','obliques'],ARRAY['abs'],ARRAY['shoulders'],ARRAY['cable'],
 'isolation','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'side plank','side-plank',
 ARRAY['obliques','core'],ARRAY['abs'],ARRAY['shoulders'],ARRAY['bodyweight'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'sit-up','sit-up',
 ARRAY['abs'],ARRAY['hip flexors'],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'rotary torso machine','rotary-torso-machine',
 ARRAY['obliques'],ARRAY['abs'],ARRAY[]::text[],ARRAY['machine'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

-- =====================
-- CALVES (1 new)
-- =====================

(gen_random_uuid(),'donkey calf raise','donkey-calf-raise',
 ARRAY['calves'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['machine'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

-- =====================
-- FOREARMS (2 new)
-- =====================

(gen_random_uuid(),'barbell wrist curl','barbell-wrist-curl',
 ARRAY['forearms'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['barbell'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'reverse wrist curl','reverse-wrist-curl',
 ARRAY['forearms'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['barbell'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

-- =====================
-- FUNCTIONAL / ATHLETIC (2 new)
-- =====================

(gen_random_uuid(),'medicine ball slam','medicine-ball-slam',
 ARRAY['abs','shoulders'],ARRAY['lats','core'],ARRAY[]::text[],ARRAY['other'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'thruster','thruster',
 ARRAY['quadriceps','shoulders'],ARRAY['glutes','triceps'],ARRAY['core'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

-- =====================
-- ADDITIONAL EXERCISES (25 new)
-- =====================

(gen_random_uuid(),'abcoaster','abcoaster',
 ARRAY['abs'],ARRAY['obliques'],ARRAY['hip flexors'],ARRAY['machine'],
 'isolation','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'air bike','air-bike',
 ARRAY['quadriceps','hamstrings'],ARRAY['glutes','core'],ARRAY['shoulders'],ARRAY['machine'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'alternating arm kettlebell swing','alternating-arm-kettlebell-swing',
 ARRAY['glutes','hamstrings'],ARRAY['lower back','shoulders'],ARRAY['core'],ARRAY['kettlebell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'archer pull-ups','archer-pull-ups',
 ARRAY['lats'],ARRAY['biceps','middle back'],ARRAY['forearms','core'],ARRAY['bodyweight'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'archer push-ups','archer-push-ups',
 ARRAY['chest'],ARRAY['triceps','shoulders'],ARRAY['core'],ARRAY['bodyweight'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'assisted chin-ups','assisted-chin-ups',
 ARRAY['lats','biceps'],ARRAY['middle back'],ARRAY['forearms'],ARRAY['machine'],
 'compound','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'assisted muscle-ups','assisted-muscle-ups',
 ARRAY['lats','chest'],ARRAY['biceps','triceps'],ARRAY['shoulders','core'],ARRAY['machine'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'band assisted pull-ups','band-assisted-pull-ups',
 ARRAY['lats'],ARRAY['biceps','middle back'],ARRAY['forearms'],ARRAY['other'],
 'compound','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell calf raise','barbell-calf-raise',
 ARRAY['calves'],ARRAY[]::text[],ARRAY[]::text[],ARRAY['barbell'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell concentration curl','barbell-concentration-curl',
 ARRAY['biceps'],ARRAY['brachialis'],ARRAY['forearms'],ARRAY['barbell'],
 'isolation','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell flexion row','barbell-flexion-row',
 ARRAY['middle back','lats'],ARRAY['biceps','rear delts'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell front raise','barbell-front-raise',
 ARRAY['shoulders'],ARRAY['upper chest'],ARRAY[]::text[],ARRAY['barbell'],
 'isolation','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell glute bridge','barbell-glute-bridge',
 ARRAY['glutes'],ARRAY['hamstrings'],ARRAY['core'],ARRAY['barbell'],
 'compound','push','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell hack squat','barbell-hack-squat',
 ARRAY['quadriceps'],ARRAY['glutes','hamstrings'],ARRAY['lower back'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell power shrug','barbell-power-shrug',
 ARRAY['traps'],ARRAY['shoulders'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell pullover','barbell-pullover',
 ARRAY['chest','lats'],ARRAY['triceps'],ARRAY[]::text[],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'barbell reverse lunge','barbell-reverse-lunge',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings'],ARRAY['core'],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'bayesian curl','bayesian-curl',
 ARRAY['biceps'],ARRAY['brachialis'],ARRAY[]::text[],ARRAY['cable'],
 'isolation','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'behind the back barbell shrug','behind-the-back-barbell-shrug',
 ARRAY['traps'],ARRAY['shoulders'],ARRAY['forearms'],ARRAY['barbell'],
 'isolation','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'behind the back deadlift','behind-the-back-deadlift',
 ARRAY['quadriceps','glutes'],ARRAY['hamstrings','traps'],ARRAY['forearms'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'bench pin press','bench-pin-press',
 ARRAY['chest','triceps'],ARRAY['shoulders'],ARRAY[]::text[],ARRAY['barbell'],
 'compound','push','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'bench pull','bench-pull',
 ARRAY['middle back','lats'],ARRAY['biceps','rear delts'],ARRAY[]::text[],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'bent arm barbell pullover','bent-arm-barbell-pullover',
 ARRAY['chest','lats'],ARRAY['triceps'],ARRAY['shoulders'],ARRAY['barbell'],
 'compound','pull','strength',2,NULL,NULL,now(),now()),

(gen_random_uuid(),'bent over dumbbell row','bent-over-dumbbell-row',
 ARRAY['middle back','lats'],ARRAY['biceps','rear delts'],ARRAY['forearms'],ARRAY['dumbbell'],
 'compound','pull','strength',1,NULL,NULL,now(),now()),

(gen_random_uuid(),'bent over folded twists','bent-over-folded-twists',
 ARRAY['obliques','abs'],ARRAY['lower back'],ARRAY[]::text[],ARRAY['bodyweight'],
 'isolation','push','strength',1,NULL,NULL,now(),now())
on conflict (slug) do nothing;
