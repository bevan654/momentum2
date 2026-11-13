-- Safe data clean-up. Nothing is deleted: every changed value is written to
-- public.data_change_log (old + new) before it is updated, so any change can
-- be reverted. See the REVERT block at the bottom.
--
-- What changes (batch '20261115_cleanup'):
--   1. Exercise names that differ from a catalog name only by case/whitespace
--      are set to the catalog name (catalog names are stored lowercase), in
--      exercises, routine_exercises and program_day_exercises. Skipped when the
--      owner has their own custom exercise with exactly the current name, so a
--      custom exercise never loses its history.
--   2. Names with stray leading/trailing spaces are trimmed (same skip rule).
--   3. Obviously invalid values:
--      - sets with kg > 1500 or reps > 10000 (typed garbage, e.g. 96,868,668 kg):
--        kg and reps set to 0 so they stop inflating volume;
--      - workouts with duration > 6 h (broken start time): duration set to 0,
--        the value the app already uses for "unknown"; same for their feed posts.
--
-- Deliberately NOT changed: exercise_type 'weighted_bodyweight' (62 legacy rows).
-- get_exercise_strength_leaderboard and get_popular_exercises only recognise
-- that spelling, so renaming it would change leaderboard results.

begin;

create table if not exists public.data_change_log (
  id          bigserial primary key,
  batch       text        not null,
  table_name  text        not null,
  row_id      uuid        not null,
  column_name text        not null,
  old_value   jsonb,
  new_value   jsonb,
  reason      text        not null,
  changed_at  timestamptz not null default now()
);

comment on table public.data_change_log is
  'Audit log of data clean-ups. Holds the original value of every changed column so changes can be reverted. Service role only.';

alter table public.data_change_log enable row level security;
revoke all on table public.data_change_log from anon, authenticated;
revoke all on sequence public.data_change_log_id_seq from anon, authenticated;

-- ─── 1 + 2. Exercise names ───────────────────────────────────────────────
create temp table _name_fix (
  tbl text, id uuid, old_name text, new_name text, reason text
) on commit drop;

-- exercises (owner = workouts.user_id)
insert into _name_fix
select 'exercises', e.id, e.name, c.name, 'name case/spacing -> catalog'
from public.exercises e
join public.workouts w on w.id = e.workout_id
join public.exercises_catalog c on c.name = lower(btrim(e.name))
where e.name <> c.name
  and not exists (select 1 from public.user_exercises u where u.user_id = w.user_id and u.name = e.name);

insert into _name_fix
select 'exercises', e.id, e.name, btrim(e.name), 'trim whitespace'
from public.exercises e
join public.workouts w on w.id = e.workout_id
where e.name <> btrim(e.name)
  and not exists (select 1 from public.exercises_catalog c where c.name = lower(btrim(e.name)))
  and not exists (select 1 from public.user_exercises u where u.user_id = w.user_id and u.name = e.name);

-- routine_exercises (owner = routines.user_id)
insert into _name_fix
select 'routine_exercises', re.id, re.name, c.name, 'name case/spacing -> catalog'
from public.routine_exercises re
join public.routines r on r.id = re.routine_id
join public.exercises_catalog c on c.name = lower(btrim(re.name))
where re.name <> c.name
  and not exists (select 1 from public.user_exercises u where u.user_id = r.user_id and u.name = re.name);

insert into _name_fix
select 'routine_exercises', re.id, re.name, btrim(re.name), 'trim whitespace'
from public.routine_exercises re
join public.routines r on r.id = re.routine_id
where re.name <> btrim(re.name)
  and not exists (select 1 from public.exercises_catalog c where c.name = lower(btrim(re.name)))
  and not exists (select 1 from public.user_exercises u where u.user_id = r.user_id and u.name = re.name);

-- program_day_exercises (owner = programs.user_id)
insert into _name_fix
select 'program_day_exercises', pe.id, pe.name, c.name, 'name case/spacing -> catalog'
from public.program_day_exercises pe
join public.program_days d on d.id = pe.program_day_id
join public.programs p on p.id = d.program_id
join public.exercises_catalog c on c.name = lower(btrim(pe.name))
where pe.name <> c.name
  and not exists (select 1 from public.user_exercises u where u.user_id = p.user_id and u.name = pe.name);

insert into _name_fix
select 'program_day_exercises', pe.id, pe.name, btrim(pe.name), 'trim whitespace'
from public.program_day_exercises pe
join public.program_days d on d.id = pe.program_day_id
join public.programs p on p.id = d.program_id
where pe.name <> btrim(pe.name)
  and not exists (select 1 from public.exercises_catalog c where c.name = lower(btrim(pe.name)))
  and not exists (select 1 from public.user_exercises u where u.user_id = p.user_id and u.name = pe.name);

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261115_cleanup', tbl, id, 'name', to_jsonb(old_name), to_jsonb(new_name), reason
from _name_fix;

update public.exercises t set name = f.new_name
from _name_fix f where f.tbl = 'exercises' and t.id = f.id;
update public.routine_exercises t set name = f.new_name
from _name_fix f where f.tbl = 'routine_exercises' and t.id = f.id;
update public.program_day_exercises t set name = f.new_name
from _name_fix f where f.tbl = 'program_day_exercises' and t.id = f.id;

-- ─── 3a. Garbage set values ──────────────────────────────────────────────
create temp table _junk_sets on commit drop as
select id, kg, reps from public.sets where kg > 1500 or reps > 10000;

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261115_cleanup', 'sets', id, 'kg', to_jsonb(kg), to_jsonb(0), 'implausible value (kg > 1500 or reps > 10000)' from _junk_sets
union all
select '20261115_cleanup', 'sets', id, 'reps', to_jsonb(reps), to_jsonb(0), 'implausible value (kg > 1500 or reps > 10000)' from _junk_sets;

update public.sets s set kg = 0, reps = 0 from _junk_sets j where s.id = j.id;

-- ─── 3b. Impossible durations ────────────────────────────────────────────
create temp table _long_workouts on commit drop as
select id, duration from public.workouts where duration > 6 * 3600;

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261115_cleanup', 'workouts', id, 'duration', to_jsonb(duration), to_jsonb(0), 'duration over 6 hours (broken start time)'
from _long_workouts
union all
select '20261115_cleanup', 'activity_feed', f.id, 'duration', to_jsonb(f.duration), to_jsonb(0), 'duration over 6 hours (broken start time)'
from public.activity_feed f join _long_workouts w on w.id = f.workout_id
where f.duration <> 0;

update public.workouts w set duration = 0 from _long_workouts l where w.id = l.id;
update public.activity_feed f set duration = 0 from _long_workouts l where f.workout_id = l.id and f.duration <> 0;

commit;

-- ─── REVERT (run manually, as service role, only if needed) ──────────────
-- Restores every value this batch changed, in reverse order:
--
-- do $$
-- declare r record;
-- begin
--   for r in select * from public.data_change_log where batch = '20261115_cleanup' order by id desc loop
--     execute format('update public.%I set %I = (%L::jsonb #>> ''{}'')::%s where id = %L',
--       r.table_name, r.column_name, r.old_value,
--       (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
--         where a.attrelid = ('public.' || r.table_name)::regclass and a.attname = r.column_name),
--       r.row_id);
--   end loop;
-- end $$;
