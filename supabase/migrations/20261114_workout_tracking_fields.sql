-- Workout tracking fields + exercise identity links.
--
-- ADDITIVE ONLY. Older app builds keep working unchanged:
--   * every new column is nullable with no default, so existing INSERT payloads
--     (which never mention them) behave exactly as before;
--   * CHECK constraints only apply to the new columns, which old builds never send;
--   * the identity trigger can never fail an insert (errors are swallowed).
-- No existing column is renamed, retyped, made NOT NULL or dropped.

begin;

-- ─── sets: per-set detail ─────────────────────────────────────────────────
alter table public.sets
  add column if not exists rir numeric(3,1)
    constraint sets_rir_range check (rir >= 0 and rir <= 10),
  add column if not exists completed_at timestamptz,
  add column if not exists rest_seconds integer
    constraint sets_rest_seconds_nonneg check (rest_seconds >= 0),
  add column if not exists target_kg numeric,
  add column if not exists target_reps integer
    constraint sets_target_reps_nonneg check (target_reps >= 0),
  add column if not exists target_source text
    constraint sets_target_source_valid check (target_source in ('routine', 'program', 'progression', 'previous')),
  add column if not exists side text
    constraint sets_side_valid check (side in ('left', 'right')),
  add column if not exists duration_seconds integer
    constraint sets_duration_seconds_nonneg check (duration_seconds >= 0),
  add column if not exists distance_m numeric
    constraint sets_distance_m_nonneg check (distance_m >= 0);

comment on column public.sets.rir is 'Reps in reserve (0-10, 5 = "5 or more"). Optional. RPE = 10 - rir.';
comment on column public.sets.completed_at is 'When the set was ticked off on the device.';
comment on column public.sets.rest_seconds is 'Rest actually taken before this set, measured by the rest timer.';
comment on column public.sets.target_kg is 'Planned weight for this set (see target_source).';
comment on column public.sets.target_reps is 'Planned reps for this set (see target_source).';
comment on column public.sets.target_source is 'Where the target came from: routine | program | progression | previous.';
comment on column public.sets.side is 'Unilateral sets: left | right (one row per side). NULL = both sides.';
comment on column public.sets.duration_seconds is 'Timed/cardio sets. Legacy cardio rows keep their old kg/reps encoding.';
comment on column public.sets.distance_m is 'Cardio distance in metres.';

-- ─── exercises: identity + structure ─────────────────────────────────────
alter table public.exercises
  add column if not exists catalog_id text
    references public.exercises_catalog(id) on delete set null,
  add column if not exists user_exercise_id uuid
    references public.user_exercises(id) on delete set null,
  add column if not exists superset_group smallint
    constraint exercises_superset_group_nonneg check (superset_group >= 0),
  add column if not exists rest_target_seconds integer
    constraint exercises_rest_target_nonneg check (rest_target_seconds >= 0);

comment on column public.exercises.catalog_id is 'Catalog exercise this row refers to (resolved from name). NULL = custom or unknown.';
comment on column public.exercises.user_exercise_id is 'User custom exercise this row refers to (resolved from name).';
comment on column public.exercises.superset_group is 'Exercises in the same workout sharing a value were supersetted.';
comment on column public.exercises.rest_target_seconds is 'Planned rest between sets for this exercise.';

create index if not exists idx_exercises_catalog_id
  on public.exercises (catalog_id) where catalog_id is not null;
create index if not exists idx_exercises_user_exercise_id
  on public.exercises (user_exercise_id) where user_exercise_id is not null;

-- ─── workouts: session detail ────────────────────────────────────────────
-- Program days are deleted and re-created whenever a program is edited, so a
-- program_day_id FK would be nulled by the next edit. (program_id, program_week,
-- program_day_of_week) is stable instead; the label is a snapshot.
alter table public.workouts
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists timezone text,
  add column if not exists utc_offset_min smallint
    constraint workouts_utc_offset_range check (utc_offset_min between -840 and 840),
  add column if not exists program_day_of_week smallint
    constraint workouts_program_dow_range check (program_day_of_week between 0 and 6),
  add column if not exists program_day_label text,
  add column if not exists routine_id uuid
    references public.routines(id) on delete set null,
  add column if not exists bodyweight_kg numeric
    constraint workouts_bodyweight_range check (bodyweight_kg > 0 and bodyweight_kg < 500),
  add column if not exists source text
    constraint workouts_source_valid check (source in ('empty', 'routine', 'program', 'ghost'));

alter table public.workouts
  drop constraint if exists workouts_ended_after_started,
  add constraint workouts_ended_after_started
    check (started_at is null or ended_at is null or ended_at >= started_at);

comment on column public.workouts.started_at is 'Session start (device clock). NULL for workouts logged before this column existed.';
comment on column public.workouts.ended_at is 'Session end (device clock).';
comment on column public.workouts.timezone is 'IANA timezone of the device, e.g. Australia/Adelaide.';
comment on column public.workouts.utc_offset_min is 'UTC offset in minutes at started_at (e.g. 630 for +10:30).';
comment on column public.workouts.program_day_of_week is 'Program day (0 = Monday) when started from a program. Stable across program edits.';
comment on column public.workouts.program_day_label is 'Program day label at the time of the workout (snapshot).';
comment on column public.workouts.routine_id is 'Routine the workout was started from.';
comment on column public.workouts.bodyweight_kg is 'Latest weigh-in at the time of the workout.';
comment on column public.workouts.source is 'How the workout was started: empty | routine | program | ghost.';

create index if not exists idx_workouts_routine_id
  on public.workouts (routine_id) where routine_id is not null;

-- ─── Exercise identity resolution ────────────────────────────────────────
-- Order: the user's own custom exercise with this exact name (what they picked),
-- then the catalog (names are stored lowercase), then a catalog alias, then a
-- custom exercise ignoring case/whitespace.
create or replace function public.resolve_exercise_identity(p_name text, p_user_id uuid)
returns table (catalog_id text, user_exercise_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with k as (select lower(btrim(p_name)) as key)
  select
    case when exact_custom.id is null then coalesce(cat.id, ali.id) end,
    coalesce(exact_custom.id, case when cat.id is null and ali.id is null then loose_custom.id end)
  from k
  left join lateral (
    select u.id from public.user_exercises u
    where u.user_id = p_user_id and u.name = p_name
    limit 1
  ) exact_custom on true
  left join lateral (
    select c.id from public.exercises_catalog c where c.name = k.key limit 1
  ) cat on true
  left join lateral (
    select c.id from public.exercise_aliases a
    join public.exercises_catalog c on c.name = lower(btrim(a.canonical_name))
    where lower(btrim(a.alias)) = k.key
    limit 1
  ) ali on true
  left join lateral (
    select u.id from public.user_exercises u
    where u.user_id = p_user_id and lower(btrim(u.name)) = k.key
    order by u.created_at
    limit 1
  ) loose_custom on true
$$;

-- Internal helper: not callable through the API (it can see other users' customs).
revoke all on function public.resolve_exercise_identity(text, uuid) from public, anon, authenticated;

create or replace function public.link_exercise_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_cat text;
  v_custom uuid;
begin
  -- Never block a workout save: any failure just leaves the links empty.
  begin
    if tg_op = 'UPDATE' and new.name is not distinct from old.name then
      return new;
    end if;
    if new.catalog_id is not null or new.user_exercise_id is not null then
      if tg_op = 'INSERT' then
        return new; -- client supplied the link explicitly
      end if;
    end if;
    select w.user_id into v_user from public.workouts w where w.id = new.workout_id;
    select r.catalog_id, r.user_exercise_id into v_cat, v_custom
      from public.resolve_exercise_identity(new.name, v_user) r;
    new.catalog_id := v_cat;
    new.user_exercise_id := v_custom;
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.link_exercise_identity() from public, anon, authenticated;

drop trigger if exists exercises_link_identity on public.exercises;
create trigger exercises_link_identity
  before insert or update of name on public.exercises
  for each row execute function public.link_exercise_identity();

-- Backfill links for existing rows (sets only the two new columns).
with resolved as (
  select e.id, r.catalog_id, r.user_exercise_id
  from public.exercises e
  join public.workouts w on w.id = e.workout_id
  cross join lateral public.resolve_exercise_identity(e.name, w.user_id) r
  where e.catalog_id is null
    and e.user_exercise_id is null
)
update public.exercises e
set catalog_id = resolved.catalog_id,
    user_exercise_id = resolved.user_exercise_id
from resolved
where resolved.id = e.id
  and (resolved.catalog_id is not null or resolved.user_exercise_id is not null);

-- ─── Index / constraint tidy-up ──────────────────────────────────────────
-- Covered by idx_workouts_user_created (user_id, created_at desc).
drop index if exists public.idx_workouts_user_id;
-- Covered by idx_activity_feed_user_created (user_id, created_at desc).
drop index if exists public.idx_activity_feed_user_id;
-- Identical to program_days_program_id_day_of_week_key, which stays.
alter table public.program_days drop constraint if exists program_days_unique;
-- Foreign keys without an index (used on every routine/program load).
create index if not exists idx_routine_exercises_routine_id on public.routine_exercises (routine_id);
create index if not exists idx_program_day_exercises_program_day_id on public.program_day_exercises (program_day_id);

commit;
