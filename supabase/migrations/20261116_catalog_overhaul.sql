-- Exercise catalog overhaul: schema for the RepDB import.
--
-- ADDITIVE ONLY. Older app builds keep working unchanged:
--   * new exercises_catalog columns are nullable; old builds select('*') and ignore them, except
--     exercise_type, which their catalog loader already prefers over the bodyweight flags when present;
--   * primary_muscles / secondary_muscles keep the legacy vocabulary old builds understand. The new
--     anatomical data lives in new tables;
--   * resolve_exercise_identity only gains a fallback for hidden rows; the trigger still never fails an insert.
-- No data is changed here. The data import (catalog rows, renames, aliases, muscle targets) is
-- scripts/catalog/import_repdb.py, applied separately after this file.

begin;

-- ─── exercises_catalog: RepDB columns ────────────────────────────────────
alter table public.exercises_catalog
  add column if not exists repdb_id text,
  add column if not exists is_hidden boolean default false,
  add column if not exists exercise_type text
    constraint exercises_catalog_exercise_type_valid
    check (exercise_type in ('weighted', 'bodyweight', 'weighted+bodyweight', 'duration')),
  add column if not exists description text,
  add column if not exists instructions jsonb,
  add column if not exists tips jsonb,
  add column if not exists is_unilateral boolean,
  add column if not exists body_part text;

create unique index if not exists exercises_catalog_repdb_id_key
  on public.exercises_catalog (repdb_id) where repdb_id is not null;

comment on column public.exercises_catalog.repdb_id is 'RepDB exercise this row was matched to or imported from (provenance). NULL = our own exercise.';
comment on column public.exercises_catalog.is_hidden is 'Hidden from the exercise picker and search. Still resolves for history. NULL = visible.';
comment on column public.exercises_catalog.exercise_type is 'weighted | bodyweight | weighted+bodyweight | duration. NULL = derive from is_bodyweight / allows_external_weight.';
comment on column public.exercises_catalog.description is 'Short description (RepDB).';
comment on column public.exercises_catalog.instructions is 'Step-by-step instructions, JSON array of strings (RepDB).';
comment on column public.exercises_catalog.tips is 'Coaching tips, JSON array of strings (RepDB).';
comment on column public.exercises_catalog.is_unilateral is 'Trained one side at a time.';
comment on column public.exercises_catalog.body_part is 'RepDB body part: chest, back, shoulders, upper_arms, lower_arms, core, upper_legs, lower_legs, full_body.';
comment on column public.exercises_catalog.primary_muscles is 'Legacy muscle names read by every app build (see MUSCLE_ALIASES). Anatomical detail: exercise_muscle_targets.';

-- ─── Muscles ─────────────────────────────────────────────────────────────
create table if not exists public.muscles (
  id         text primary key,
  label      text not null,
  body_group text not null
    constraint muscles_body_group_valid check (body_group in ('chest', 'back', 'shoulders', 'arms', 'core', 'legs')),
  sort       smallint not null
);

comment on table public.muscles is 'Anatomical muscles (RepDB vocabulary). Referenced by exercise_muscle_targets and muscle_map_regions.';

insert into public.muscles (id, label, body_group, sort) values
  ('pectoralis_major',          'Pectoralis Major',            'chest',      10),
  ('serratus_anterior',         'Serratus Anterior',           'chest',      20),
  ('anterior_deltoid',          'Front Delts',                 'shoulders',  30),
  ('lateral_deltoid',           'Side Delts',                  'shoulders',  40),
  ('posterior_deltoid',         'Rear Delts',                  'shoulders',  50),
  ('supraspinatus',             'Supraspinatus',               'shoulders',  60),
  ('infraspinatus_teres_minor', 'Infraspinatus & Teres Minor', 'shoulders',  70),
  ('latissimus_dorsi',          'Lats',                        'back',       80),
  ('rhomboids',                 'Rhomboids',                   'back',       90),
  ('trapezius',                 'Traps',                       'back',      100),
  ('erector_spinae',            'Erector Spinae',              'back',      110),
  ('quadratus_lumborum',        'Quadratus Lumborum',          'back',      120),
  ('biceps_brachii',            'Biceps',                      'arms',      130),
  ('brachialis',                'Brachialis',                  'arms',      140),
  ('brachioradialis',           'Brachioradialis',             'arms',      150),
  ('triceps_brachii',           'Triceps',                     'arms',      160),
  ('forearm_flexors',           'Forearm Flexors',             'arms',      170),
  ('forearm_extensors',         'Forearm Extensors',           'arms',      180),
  ('forearms',                  'Forearms',                    'arms',      190),
  ('rectus_abdominis',          'Abs',                         'core',      200),
  ('transverse_abdominis',      'Transverse Abdominis',        'core',      210),
  ('obliques',                  'Obliques',                    'core',      220),
  ('quadriceps',                'Quads',                       'legs',      230),
  ('hamstrings',                'Hamstrings',                  'legs',      240),
  ('gluteus_maximus',           'Glutes',                      'legs',      250),
  ('gluteus_medius',            'Glute Medius',                'legs',      260),
  ('abductors',                 'Abductors',                   'legs',      270),
  ('adductors',                 'Adductors',                   'legs',      280),
  ('hip_flexors',               'Hip Flexors',                 'legs',      290),
  ('gastrocnemius',             'Gastrocnemius',               'legs',      300),
  ('soleus',                    'Soleus',                      'legs',      310),
  ('tibialis_anterior',         'Tibialis Anterior',           'legs',      320)
on conflict (id) do nothing;

create table if not exists public.exercise_muscle_targets (
  catalog_id text    not null references public.exercises_catalog(id) on delete cascade,
  muscle_id  text    not null references public.muscles(id) on update cascade,
  role       text    not null constraint exercise_muscle_targets_role_valid check (role in ('primary', 'secondary')),
  weight     numeric not null constraint exercise_muscle_targets_weight_range check (weight >= 0 and weight <= 1),
  primary key (catalog_id, muscle_id)
);

create index if not exists idx_exercise_muscle_targets_muscle_id on public.exercise_muscle_targets (muscle_id);

comment on table public.exercise_muscle_targets is 'Muscles an exercise trains. Written by scripts/catalog/import_repdb.py.';
comment on column public.exercise_muscle_targets.weight is 'Share of the exercise''s work credited to this muscle (0-1). Import default: primary 1.0, secondary 0.5.';

-- Muscle -> body-map region, per body-map renderer. Region ids belong to the renderer that ships in
-- the app, so each renderer gets its own map_id: a future deep muscle map adds rows under a new
-- map_id without touching muscles, exercise_muscle_targets or the map installed builds use.
-- A muscle may light more than one region.
create table if not exists public.muscle_map_regions (
  map_id    text not null,
  muscle_id text not null references public.muscles(id) on update cascade on delete cascade,
  region    text not null,
  primary key (map_id, muscle_id, region)
);

comment on table public.muscle_map_regions is 'Muscle -> region of a body-map renderer. map_id body_v1 = the BodyHighlighter SVG slugs the app renders today.';

-- body_v1 mirrors the app's current mapping (MUSCLE_ALIASES -> CANONICAL_TO_SVG_SLUG in src/constants/muscles.ts).
insert into public.muscle_map_regions (map_id, muscle_id, region) values
  ('body_v1', 'pectoralis_major',          'chest'),
  ('body_v1', 'serratus_anterior',         'abs'),
  ('body_v1', 'anterior_deltoid',          'deltoids'),
  ('body_v1', 'lateral_deltoid',           'deltoids'),
  ('body_v1', 'posterior_deltoid',         'rear-deltoids'),
  ('body_v1', 'supraspinatus',             'deltoids'),
  ('body_v1', 'infraspinatus_teres_minor', 'rear-deltoids'),
  ('body_v1', 'latissimus_dorsi',          'upper-back'),
  ('body_v1', 'rhomboids',                 'upper-back'),
  ('body_v1', 'trapezius',                 'trapezius'),
  ('body_v1', 'erector_spinae',            'lower-back'),
  ('body_v1', 'quadratus_lumborum',        'lower-back'),
  ('body_v1', 'biceps_brachii',            'biceps'),
  ('body_v1', 'brachialis',                'biceps'),
  ('body_v1', 'brachioradialis',           'forearm'),
  ('body_v1', 'triceps_brachii',           'triceps'),
  ('body_v1', 'forearm_flexors',           'forearm'),
  ('body_v1', 'forearm_extensors',         'forearm'),
  ('body_v1', 'forearms',                  'forearm'),
  ('body_v1', 'rectus_abdominis',          'abs'),
  ('body_v1', 'transverse_abdominis',      'abs'),
  ('body_v1', 'obliques',                  'obliques'),
  ('body_v1', 'quadriceps',                'quadriceps'),
  ('body_v1', 'hamstrings',                'hamstring'),
  ('body_v1', 'gluteus_maximus',           'gluteal'),
  ('body_v1', 'gluteus_medius',            'gluteal'),
  ('body_v1', 'abductors',                 'gluteal'),
  ('body_v1', 'adductors',                 'adductors'),
  ('body_v1', 'hip_flexors',               'quadriceps'),
  ('body_v1', 'gastrocnemius',             'calves'),
  ('body_v1', 'soleus',                    'calves'),
  ('body_v1', 'tibialis_anterior',         'calves')
on conflict do nothing;

-- ─── RLS: readable by signed-in users, written by the service role only (as exercises_catalog) ───
alter table public.muscles enable row level security;
alter table public.exercise_muscle_targets enable row level security;
alter table public.muscle_map_regions enable row level security;

drop policy if exists "Allow authenticated read access" on public.muscles;
create policy "Allow authenticated read access" on public.muscles for select to authenticated using (true);
drop policy if exists "Allow authenticated read access" on public.exercise_muscle_targets;
create policy "Allow authenticated read access" on public.exercise_muscle_targets for select to authenticated using (true);
drop policy if exists "Allow authenticated read access" on public.muscle_map_regions;
create policy "Allow authenticated read access" on public.muscle_map_regions for select to authenticated using (true);

-- TRUNCATE is not covered by RLS.
revoke insert, update, delete, truncate on public.muscles, public.exercise_muscle_targets, public.muscle_map_regions
  from anon, authenticated;

-- ─── Identity resolution: hidden rows ────────────────────────────────────
-- Order: the user's own custom exercise with this exact name, then a visible catalog row, then a catalog
-- alias, then a hidden catalog row, then a custom exercise ignoring case/whitespace. A row hidden because
-- it was merged into another keeps its name, and its old name is an alias of the survivor, so old builds
-- that still send that name link to the survivor. Other hidden rows still resolve to themselves.
create or replace function public.resolve_exercise_identity(p_name text, p_user_id uuid)
returns table (catalog_id text, user_exercise_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with k as (select lower(btrim(p_name)) as key)
  select
    case when exact_custom.id is null then coalesce(cat.id, ali.id, hidden.id) end,
    coalesce(exact_custom.id,
             case when cat.id is null and ali.id is null and hidden.id is null then loose_custom.id end)
  from k
  left join lateral (
    select u.id from public.user_exercises u
    where u.user_id = p_user_id and u.name = p_name
    limit 1
  ) exact_custom on true
  left join lateral (
    select c.id from public.exercises_catalog c
    where c.name = k.key and not coalesce(c.is_hidden, false)
    limit 1
  ) cat on true
  left join lateral (
    select c.id from public.exercise_aliases a
    join public.exercises_catalog c on c.name = lower(btrim(a.canonical_name))
    where lower(btrim(a.alias)) = k.key
    limit 1
  ) ali on true
  left join lateral (
    select c.id from public.exercises_catalog c
    where c.name = k.key and coalesce(c.is_hidden, false)
    limit 1
  ) hidden on true
  left join lateral (
    select u.id from public.user_exercises u
    where u.user_id = p_user_id and lower(btrim(u.name)) = k.key
    order by u.created_at
    limit 1
  ) loose_custom on true
$$;

revoke all on function public.resolve_exercise_identity(text, uuid) from public, anon, authenticated;

commit;
