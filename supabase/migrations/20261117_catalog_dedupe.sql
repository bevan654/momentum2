-- Catalog follow-up to 20261116: merge four duplicate pairs and fix two wrong aliases.
--
-- Same rules as the import: nothing is deleted, every changed value is logged to
-- public.data_change_log (batch '20261117_catalog_dedupe') before it changes, and
-- the batch can be reverted (scripts/catalog/revert_dedupe.sql). Idempotent: a re-run
-- changes nothing. Only our own names are in this file (no RepDB text).
--
--   duplicate (hidden, becomes an alias)  ->  kept exercise
--   dumbbell decline bench press          ->  dumbbell decline press        (0 logged on the duplicate)
--   inverted row                          ->  barbell inverted row          (0 / 0 logged)
--   machine calf raise                    ->  machine standing calf raise   (0 logged on the duplicate)
--   tricep extension                      ->  cable triceps extension       (both cable triceps; history renamed)
--
--   alias fix                             old target -> new target
--   Pull Up (Assisted)                    pull-up -> machine assisted pull-ups
--   Bent Over One Arm Row (Dumbbell)      dumbbell bent-over row -> dumbbell single-arm row
--
-- Older app builds don't know is_hidden and still list the hidden rows, but a name they
-- log resolves (visible catalog -> aliases -> hidden) to the kept exercise.

begin;
set local lock_timeout = '10s';

create temp table _dd_pairs (loser text primary key, survivor text not null) on commit drop;
insert into _dd_pairs values
  ('dumbbell decline bench press', 'dumbbell decline press'),
  ('inverted row',                 'barbell inverted row'),
  ('machine calf raise',           'machine standing calf raise'),
  ('tricep extension',             'cable triceps extension');

create temp table _dd_alias_fix (alias text primary key, new_canonical text not null) on commit drop;
insert into _dd_alias_fix values
  ('Pull Up (Assisted)',               'machine assisted pull-ups'),
  ('Bent Over One Arm Row (Dumbbell)', 'dumbbell single-arm row');

-- Guard: every name must exist exactly as expected, or abort without changing anything.
do $$
declare missing text;
begin
  select string_agg(n, ', ') into missing from (
    select loser n from _dd_pairs union all select survivor from _dd_pairs union all select new_canonical from _dd_alias_fix
  ) x where not exists (select 1 from public.exercises_catalog c where c.name = x.n);
  if missing is not null then
    raise exception 'catalog dedupe aborted: catalog rows missing: %', missing;
  end if;
  if exists (select 1 from _dd_pairs p join public.exercises_catalog c on c.name = p.survivor where c.is_hidden) then
    raise exception 'catalog dedupe aborted: a kept exercise is hidden';
  end if;
end $$;

create temp table _dd_ids on commit drop as
select p.loser, p.survivor, l.id as loser_id, s.id as survivor_id
from _dd_pairs p
join public.exercises_catalog l on l.name = p.loser
join public.exercises_catalog s on s.name = p.survivor;

-- ─── 1. Hide the duplicates ──────────────────────────────────────────────
insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', 'exercises_catalog', c.id::uuid, 'is_hidden', to_jsonb(c.is_hidden), 'true'::jsonb,
       'duplicate of ' || d.survivor
from _dd_ids d join public.exercises_catalog c on c.id = d.loser_id
where c.is_hidden is distinct from true;

update public.exercises_catalog c set is_hidden = true
from _dd_ids d where c.id = d.loser_id and c.is_hidden is distinct from true;

-- ─── 2. Rename history from a duplicate's name to the kept name ──────────
-- Skip rule (stricter than the import): never rename a row that is linked to the owner's
-- custom exercise, or whose owner has a custom exercise named like the old or the new name
-- (ignoring case and surrounding spaces).
create temp table _dd_hist (tbl text, id uuid, old_name text, new_name text) on commit drop;

insert into _dd_hist
select 'exercises', e.id, e.name, d.survivor
from public.exercises e
join public.workouts w on w.id = e.workout_id
join _dd_ids d on lower(btrim(e.name)) = d.loser
where e.name <> d.survivor
  and e.user_exercise_id is null
  and not exists (select 1 from public.user_exercises u where u.user_id = w.user_id and lower(btrim(u.name)) in (d.loser, d.survivor));

insert into _dd_hist
select 'routine_exercises', re.id, re.name, d.survivor
from public.routine_exercises re
join public.routines r on r.id = re.routine_id
join _dd_ids d on lower(btrim(re.name)) = d.loser
where re.name <> d.survivor
  and not exists (select 1 from public.user_exercises u where u.user_id = r.user_id and lower(btrim(u.name)) in (d.loser, d.survivor));

insert into _dd_hist
select 'program_day_exercises', pe.id, pe.name, d.survivor
from public.program_day_exercises pe
join public.program_days pd on pd.id = pe.program_day_id
join public.programs p on p.id = pd.program_id
join _dd_ids d on lower(btrim(pe.name)) = d.loser
where pe.name <> d.survivor
  and not exists (select 1 from public.user_exercises u where u.user_id = p.user_id and lower(btrim(u.name)) in (d.loser, d.survivor));

-- Log names, and the identity links the trigger will recompute (so a revert restores them exactly).
insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', h.tbl, h.id, 'name', to_jsonb(h.old_name), to_jsonb(h.new_name), 'merged duplicate'
from _dd_hist h
union all
select '20261117_catalog_dedupe', 'exercises', e.id, 'catalog_id', to_jsonb(e.catalog_id), null, 'merged duplicate (link follows rename)'
from _dd_hist h join public.exercises e on e.id = h.id where h.tbl = 'exercises'
union all
select '20261117_catalog_dedupe', 'exercises', e.id, 'user_exercise_id', to_jsonb(e.user_exercise_id), null, 'merged duplicate (link follows rename)'
from _dd_hist h join public.exercises e on e.id = h.id where h.tbl = 'exercises';

update public.exercises t set name = h.new_name from _dd_hist h where h.tbl = 'exercises' and t.id = h.id;
update public.routine_exercises t set name = h.new_name from _dd_hist h where h.tbl = 'routine_exercises' and t.id = h.id;
update public.program_day_exercises t set name = h.new_name from _dd_hist h where h.tbl = 'program_day_exercises' and t.id = h.id;

-- Any other history still linked to a duplicate row (e.g. via an alias) follows to the kept row.
create temp table _dd_relink on commit drop as
select e.id, e.catalog_id as old_catalog_id, d.survivor_id
from public.exercises e join _dd_ids d on e.catalog_id = d.loser_id;

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', 'exercises', r.id, 'catalog_id', to_jsonb(r.old_catalog_id), to_jsonb(r.survivor_id), 'merged duplicate (re-link)'
from _dd_relink r;

update public.exercises e set catalog_id = r.survivor_id from _dd_relink r where e.id = r.id;

-- ─── 3. Aliases: each duplicate's name finds the kept exercise ───────────
-- Existing aliases that pointed at a duplicate now point at the kept name.
insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', 'exercise_aliases', a.id, 'canonical_name', to_jsonb(a.canonical_name), to_jsonb(d.survivor), 'merged duplicate'
from public.exercise_aliases a join _dd_ids d on lower(btrim(a.canonical_name)) = d.loser;

update public.exercise_aliases a set canonical_name = d.survivor
from _dd_ids d where lower(btrim(a.canonical_name)) = d.loser;

create temp table _dd_new_alias on commit drop as
select gen_random_uuid() as id, d.loser as alias, d.survivor as canonical_name
from _dd_ids d
where not exists (select 1 from public.exercise_aliases a where lower(btrim(a.alias)) = d.loser);

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', 'exercise_aliases', n.id, '_row', null,
       jsonb_build_object('alias', n.alias, 'canonical_name', n.canonical_name), 'merged duplicate (new alias)'
from _dd_new_alias n;

insert into public.exercise_aliases (id, alias, canonical_name)
select id, alias, canonical_name from _dd_new_alias;

-- ─── 4. Fix two wrong aliases and re-point the history they linked ───────
create temp table _dd_fix on commit drop as
select a.id as alias_id, a.alias, a.canonical_name as old_canonical, f.new_canonical,
       old_c.id as old_catalog_id, new_c.id as new_catalog_id
from _dd_alias_fix f
join public.exercise_aliases a on a.alias = f.alias
left join public.exercises_catalog old_c on old_c.name = lower(btrim(a.canonical_name))
join public.exercises_catalog new_c on new_c.name = f.new_canonical
where a.canonical_name <> f.new_canonical;

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', 'exercise_aliases', f.alias_id, 'canonical_name', to_jsonb(f.old_canonical), to_jsonb(f.new_canonical), 'alias pointed at the wrong exercise'
from _dd_fix f;

create temp table _dd_fix_rows on commit drop as
select e.id, e.catalog_id as old_catalog_id, f.new_catalog_id
from public.exercises e join _dd_fix f
  on lower(btrim(e.name)) = lower(btrim(f.alias)) and e.catalog_id = f.old_catalog_id;

insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)
select '20261117_catalog_dedupe', 'exercises', r.id, 'catalog_id', to_jsonb(r.old_catalog_id), to_jsonb(r.new_catalog_id), 'alias pointed at the wrong exercise'
from _dd_fix_rows r;

update public.exercise_aliases a set canonical_name = f.new_canonical from _dd_fix f where a.id = f.alias_id;
update public.exercises e set catalog_id = r.new_catalog_id from _dd_fix_rows r where e.id = r.id;

do $$
begin
  raise notice 'catalog dedupe: %', (select jsonb_object_agg(k, v) from (
    select table_name || '.' || column_name as k, count(*) as v
    from public.data_change_log where batch = '20261117_catalog_dedupe' group by 1) x);
end $$;

commit;
