-- upsert_workout: write a whole workout (workout, exercises, sets) in one transaction.
--
-- Until now the app saved a workout with three separate inserts. A failure
-- between them left a workout with no exercises, or exercises with no sets
-- (the sets error was only logged), and a retry after a timeout that had
-- actually reached the server inserted everything twice.
--
-- The app now generates the workout id when the workout starts and calls this
-- function with it. All rows are written or none are, and calling it again
-- with the same id is safe:
--   mode 'create'  (finishing a workout): if the id is already saved, nothing
--                  is changed and created = false is returned, so a retry
--                  after a lost response doesn't duplicate the workout.
--   mode 'replace' (finishing again after Undo): the workout's fields are
--                  updated and its exercises and sets are replaced. If the id
--                  isn't saved yet (Undo deleted it) it's inserted.
--   mode 'edit'    (editing a saved workout from history): only duration and
--                  the totals change on the workout; exercises and sets are
--                  replaced. An exercise or set sent with orig_id (its id
--                  before the edit) keeps the fields the editor doesn't show:
--                  notes, superset group, rest target, RIR, completed_at,
--                  rest, targets, side, duration, distance. The workout must
--                  already exist.
--
-- ADDITIVE ONLY. Nothing existing changes: older app builds keep inserting
-- into workouts → exercises → sets directly, under the same RLS policies.
--
-- Not to be confused with save_workout(uuid, jsonb, jsonb) and
-- update_workout(uuid, integer, jsonb), which exist in production but not in
-- this repo, and which no app build calls. They're left untouched.
--
-- SECURITY INVOKER: the function runs as the caller, so the owner-only RLS
-- policies on workouts, exercises and sets apply to every statement here, just
-- as they do to the old direct inserts. user_id is always auth.uid().

begin;

create or replace function public.upsert_workout(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_mode text := coalesce(p->>'mode', 'create');
  v_exists boolean;
  v_routine_id uuid;
  v_program_id uuid;
  v_ex jsonb;
  v_ord bigint;
  v_ex_id uuid;
  v_old_ex jsonb := '{}'::jsonb;    -- edit mode: exercises before the edit, by id
  v_old_sets jsonb := '{}'::jsonb;  -- edit mode: sets before the edit, by id
  v_o jsonb;
begin
  if v_uid is null then
    raise exception 'upsert_workout: not signed in' using errcode = '28000';
  end if;
  if v_mode not in ('create', 'replace', 'edit') then
    raise exception 'upsert_workout: unknown mode %', v_mode using errcode = '22023';
  end if;
  v_id := nullif(p->>'id', '')::uuid;
  if v_id is null then
    raise exception 'upsert_workout: id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p->'exercises') is distinct from 'array' or jsonb_array_length(p->'exercises') = 0 then
    raise exception 'upsert_workout: at least one exercise is required' using errcode = '22023';
  end if;

  -- RLS hides other users' workouts, so this only finds the caller's own. An id
  -- that belongs to someone else fails on the primary key below instead.
  select true into v_exists from public.workouts where id = v_id for update;
  v_exists := coalesce(v_exists, false);

  if v_exists and v_mode = 'create' then
    return jsonb_build_object('id', v_id, 'created', false);
  end if;
  if not v_exists and v_mode = 'edit' then
    raise exception 'upsert_workout: workout not found' using errcode = 'P0002';
  end if;

  if v_mode = 'edit' then
    -- Rows before the edit, so fields the editor doesn't carry can be kept.
    select coalesce(jsonb_object_agg(e.id::text, to_jsonb(e)), '{}'::jsonb) into v_old_ex
      from public.exercises e where e.workout_id = v_id;
    select coalesce(jsonb_object_agg(s.id::text, to_jsonb(s)), '{}'::jsonb) into v_old_sets
      from public.sets s join public.exercises e on e.id = s.exercise_id where e.workout_id = v_id;

    update public.workouts set
      duration        = (p->>'duration')::integer,
      total_exercises = (p->>'total_exercises')::integer,
      total_sets      = (p->>'total_sets')::integer
    where id = v_id;
    delete from public.exercises where workout_id = v_id;
  end if;

  -- Links that may point at a deleted routine or program are dropped rather
  -- than failing the save on the foreign key.
  select r.id into v_routine_id from public.routines r
    where r.id = nullif(p->>'routine_id', '')::uuid;
  select pr.id into v_program_id from public.programs pr
    where pr.id = nullif(p->>'program_id', '')::uuid;

  if v_mode = 'edit' then
    null; -- handled above
  elsif v_exists then
    update public.workouts set
      duration            = (p->>'duration')::integer,
      total_exercises     = (p->>'total_exercises')::integer,
      total_sets          = (p->>'total_sets')::integer,
      ghost_username      = nullif(p->>'ghost_username', ''),
      program_id          = v_program_id,
      program_week        = case when v_program_id is null then null else (p->>'program_week')::integer end,
      started_at          = (p->>'started_at')::timestamptz,
      ended_at            = (p->>'ended_at')::timestamptz,
      timezone            = nullif(p->>'timezone', ''),
      utc_offset_min      = (p->>'utc_offset_min')::smallint,
      program_day_of_week = case when v_program_id is null then null else (p->>'program_day_of_week')::smallint end,
      program_day_label   = case when v_program_id is null then null else nullif(p->>'program_day_label', '') end,
      routine_id          = v_routine_id,
      bodyweight_kg       = (p->>'bodyweight_kg')::numeric,
      source              = nullif(p->>'source', '')
    where id = v_id;

    -- Sets go with their exercises (on delete cascade).
    delete from public.exercises where workout_id = v_id;
  else
    insert into public.workouts (
      id, user_id, duration, total_exercises, total_sets, ghost_username,
      program_id, program_week, started_at, ended_at, timezone, utc_offset_min,
      program_day_of_week, program_day_label, routine_id, bodyweight_kg, source
    ) values (
      v_id, v_uid,
      (p->>'duration')::integer,
      (p->>'total_exercises')::integer,
      (p->>'total_sets')::integer,
      nullif(p->>'ghost_username', ''),
      v_program_id,
      case when v_program_id is null then null else (p->>'program_week')::integer end,
      (p->>'started_at')::timestamptz,
      (p->>'ended_at')::timestamptz,
      nullif(p->>'timezone', ''),
      (p->>'utc_offset_min')::smallint,
      case when v_program_id is null then null else (p->>'program_day_of_week')::smallint end,
      case when v_program_id is null then null else nullif(p->>'program_day_label', '') end,
      v_routine_id,
      (p->>'bodyweight_kg')::numeric,
      nullif(p->>'source', '')
    );
  end if;

  for v_ex, v_ord in
    select e.value, e.ordinality from jsonb_array_elements(p->'exercises') with ordinality as e
  loop
    -- In edit mode, fields the editor doesn't carry come from the exercise before the edit.
    v_o := case when v_mode = 'edit' then v_old_ex->(v_ex->>'orig_id') end;

    insert into public.exercises (
      workout_id, name, exercise_order, exercise_type, notes, note_color,
      superset_group, rest_target_seconds
    ) values (
      v_id,
      v_ex->>'name',
      v_ord,
      coalesce(nullif(v_ex->>'exercise_type', ''), v_o->>'exercise_type', 'weighted'),
      coalesce(nullif(v_ex->>'notes', ''), v_o->>'notes'),
      coalesce(nullif(v_ex->>'note_color', ''), v_o->>'note_color'),
      coalesce((v_ex->>'superset_group')::smallint, (v_o->>'superset_group')::smallint),
      coalesce((v_ex->>'rest_target_seconds')::integer, (v_o->>'rest_target_seconds')::integer)
    )
    returning id into v_ex_id;

    insert into public.sets (
      exercise_id, set_number, kg, reps, completed, set_type, parent_set_number,
      rir, completed_at, rest_seconds, target_kg, target_reps, target_source,
      side, duration_seconds, distance_m
    )
    select
      v_ex_id, s.set_number, coalesce(s.kg, 0), coalesce(s.reps, 0), coalesce(s.completed, false),
      coalesce(s.set_type, 'working'), s.parent_set_number,
      coalesce(s.rir, (o.v->>'rir')::numeric),
      case when coalesce(s.completed, false) then coalesce(s.completed_at, (o.v->>'completed_at')::timestamptz) end,
      case when coalesce(s.completed, false) then coalesce(s.rest_seconds, (o.v->>'rest_seconds')::integer) end,
      coalesce(s.target_kg, (o.v->>'target_kg')::numeric),
      coalesce(s.target_reps, (o.v->>'target_reps')::integer),
      coalesce(s.target_source, o.v->>'target_source'),
      coalesce(s.side, o.v->>'side'),
      coalesce(s.duration_seconds, (o.v->>'duration_seconds')::integer),
      coalesce(s.distance_m, (o.v->>'distance_m')::numeric)
    from jsonb_to_recordset(coalesce(v_ex->'sets', '[]'::jsonb)) as s(
      set_number integer, kg numeric, reps integer, completed boolean, set_type text,
      parent_set_number integer, rir numeric, completed_at timestamptz, rest_seconds integer,
      target_kg numeric, target_reps integer, target_source text, side text,
      duration_seconds integer, distance_m numeric, orig_id text
    )
    -- Edit mode: the same set before the edit, if the editor kept it
    left join lateral (
      select case when v_mode = 'edit' then v_old_sets->s.orig_id end as v
    ) o on true;
  end loop;

  return jsonb_build_object('id', v_id, 'created', not v_exists);
end;
$$;

comment on function public.upsert_workout(jsonb) is
  'Saves a whole workout atomically and idempotently (by client-generated id). See migration 20261119_upsert_workout_rpc.sql.';

revoke all on function public.upsert_workout(jsonb) from public, anon;
grant execute on function public.upsert_workout(jsonb) to authenticated;

comment on column public.sets.rest_seconds is
  'Seconds between the previous set being ticked off and this one (rest plus this set''s own time). NULL for the first set or a gap over an hour.';

commit;
