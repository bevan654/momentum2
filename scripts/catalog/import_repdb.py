#!/usr/bin/env python3
"""Import the RepDB exercise dataset into exercises_catalog.

    python3 scripts/catalog/import_repdb.py --repdb /private/path/exercises.json --out /private/path/import.sql
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /private/path/import.sql

Needs supabase/migrations/20261116_catalog_overhaul.sql applied first. The generated SQL runs in one
transaction and is idempotent: running it again changes nothing.

RepDB's licence allows in-app use (with the visible credit in Profile) but not redistribution, and this
repo is public. So the dataset is never committed: pass a private copy with --repdb and write the
generated SQL (which contains RepDB text) outside the repo. decisions.json, which maps our existing
catalog rows, holds only our names, our ids and RepDB ids.

What the SQL does (batch '20261116_catalog' in public.data_change_log):
  * merge rows: our existing row becomes the canonical row for its RepDB exercise. Its id is kept; it takes
    the RepDB name (equipment-first, see naming.py), description, instructions, tips, body part and
    unilateral flag. Scoring fields (muscles, is_main_lift, ranking_weight, bodyweight flags) stay ours,
    so ranks and heatmaps don't shift.
  * merge_into rows: the same lift as another of our rows. Hidden; history is renamed onto the survivor
    (the exercises_link_identity trigger re-points catalog_id). The survivor inherits main-lift flags.
  * keep rows: stay ours, renamed to new_name. hide rows: hidden from search, history untouched.
  * RepDB exercises not matched by any of our rows are inserted (ids derived from the RepDB id).
  * History (exercises, routine_exercises, program_day_exercises) is renamed from each old name to the new
    canonical name. Skipped when the owner has a custom exercise named exactly the old or the new name.
  * Every old name becomes an exercise_aliases row, and existing aliases follow the rename.
  * exercise_muscle_targets is filled: RepDB muscles for RepDB rows, our legacy muscles for the rest.
Every changed value and inserted row is logged first; scripts/catalog/revert_import.sql undoes the batch.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from naming import name_for  # noqa: E402

BATCH = '20261116_catalog'
HERE = os.path.dirname(os.path.abspath(__file__))
# Stable ids for inserted rows, so a re-run finds the same rows.
ID_NAMESPACE = uuid.UUID('0f4b3c52-6a51-4e0e-9a0c-6d6f6d656e74')

# ─── Muscles ──────────────────────────────────────────────────────────────────
# RepDB muscle id -> the legacy string stored in primary_muscles / secondary_muscles. Older app builds
# map these through MUSCLE_ALIASES (src/constants/muscles.ts); LEGACY_GROUP is that mapping, used to
# drop a second string that lands on the same muscle (old builds would count its volume twice).
TO_LEGACY = {
    'pectoralis_major': 'chest', 'serratus_anterior': 'abs',
    'anterior_deltoid': 'shoulders', 'lateral_deltoid': 'shoulders', 'supraspinatus': 'shoulders',
    'posterior_deltoid': 'rear delts', 'infraspinatus_teres_minor': 'rear delts',
    'latissimus_dorsi': 'lats', 'rhomboids': 'middle back', 'trapezius': 'traps',
    'erector_spinae': 'lower back', 'quadratus_lumborum': 'lower back',
    'biceps_brachii': 'biceps', 'brachialis': 'brachialis', 'triceps_brachii': 'triceps',
    'brachioradialis': 'forearms', 'forearm_flexors': 'forearms', 'forearm_extensors': 'forearms', 'forearms': 'forearms',
    'rectus_abdominis': 'abs', 'transverse_abdominis': 'abs', 'obliques': 'obliques',
    'quadriceps': 'quadriceps', 'hip_flexors': 'hip flexors', 'hamstrings': 'hamstrings',
    'gluteus_maximus': 'glutes', 'gluteus_medius': 'hip abductors', 'abductors': 'hip abductors',
    'adductors': 'adductors', 'gastrocnemius': 'calves', 'soleus': 'calves', 'tibialis_anterior': 'calves',
}
LEGACY_GROUP = {
    'chest': 'chest', 'shoulders': 'shoulders', 'rear delts': 'rear-delts', 'lats': 'lats',
    'middle back': 'upper-back', 'traps': 'traps', 'lower back': 'lower-back', 'biceps': 'biceps',
    'brachialis': 'biceps', 'triceps': 'triceps', 'forearms': 'forearms', 'abs': 'abs', 'obliques': 'obliques',
    'quadriceps': 'quads', 'hip flexors': 'quads', 'hamstrings': 'hamstrings', 'glutes': 'glutes',
    'hip abductors': 'glutes', 'adductors': 'adductors', 'calves': 'calves',
}
# Legacy string -> RepDB muscle ids, for rows that keep our own muscle data.
FROM_LEGACY = {
    'chest': ['pectoralis_major'], 'upper chest': ['pectoralis_major'],
    'shoulders': ['anterior_deltoid', 'lateral_deltoid'], 'rear delts': ['posterior_deltoid'],
    'lats': ['latissimus_dorsi'], 'middle back': ['rhomboids'], 'upper back': ['rhomboids', 'trapezius'],
    'traps': ['trapezius'], 'trapezius': ['trapezius'], 'lower back': ['erector_spinae'],
    'biceps': ['biceps_brachii'], 'brachialis': ['brachialis'], 'triceps': ['triceps_brachii'],
    'anconeus': ['triceps_brachii'], 'forearms': ['forearms'],
    'abs': ['rectus_abdominis'], 'core': ['transverse_abdominis'], 'obliques': ['obliques'],
    'quadriceps': ['quadriceps'], 'hip flexors': ['hip_flexors'], 'hamstrings': ['hamstrings'],
    'glutes': ['gluteus_maximus'], 'hip abductors': ['gluteus_medius'], 'adductors': ['adductors'],
    'gracilis': ['adductors'], 'calves': ['gastrocnemius', 'soleus'],
}
PRIMARY_WEIGHT, SECONDARY_WEIGHT = 1.0, 0.5

# ─── Equipment and exercise type (inserted rows only) ─────────────────────────
LOADED = {'barbell', 'dumbbell', 'kettlebell', 'plates', 'sandbag', 'ez_bar', 'trap_bar'}
BODY_LOADED = {None, 'pull_up_bar', 'dip_station', 'rings', 'suspension_trainer', 'flat_bench', 'plyo_box',
               'bosu_ball', 'stability_ball', 'glute_ham_developer', 'ab_wheel', 'climbing_rope'}
ADDS_LOAD = re.compile(r'pull-?ups?\b|chin-?ups?\b|\bdips?\b|muscle-?ups?\b|push-?ups?\b|squat|lunge|step-?ups?\b'
                       r'|glute bridge|hip thrust|back extension|nordic|inverted row')
EQUIPMENT_JSON = {'barbell': 'barbell', 'ez_bar': 'ez bar', 'trap_bar': 'trap bar', 'dumbbell': 'dumbbell',
                  'kettlebell': 'kettlebell', 'cable': 'cable', 'pull_up_bar': 'pull-up bar',
                  None: 'bodyweight', 'dip_station': 'bodyweight'}
MACHINES = {'smith_machine', 'leg_press', 'leg_curl', 'leg_extension', 'hack_squat', 'pec_deck', 'rower',
            'treadmill', 'stair_climber', 'air_bike', 'stationary_bike', 'elliptical', 'ski_erg'}
DIFFICULTY = {'beginner': 1, 'intermediate': 2, 'advanced': 3}


def exercise_type(r):
    eq = r.get('equipment')
    if r['category'] in ('stretching', 'cardio'):
        return 'duration'
    if r['force_type'] == 'static':
        return 'weighted' if eq in LOADED else 'duration'
    if eq in BODY_LOADED:
        if eq not in ('suspension_trainer', 'ab_wheel') and r['category'] != 'plyometrics' \
                and ADDS_LOAD.search(r['name_en'].lower()):
            return 'weighted+bodyweight'
        return 'bodyweight'
    return 'weighted'


def equipment_json(eq):
    if eq in EQUIPMENT_JSON:
        return [EQUIPMENT_JSON[eq]]
    if eq in MACHINES or eq.endswith('_machine'):
        return ['machine']
    return ['other']


def legacy_muscles(primary, secondary):
    """RepDB muscles -> (primary, secondary) legacy strings, one string per legacy muscle group."""
    seen, out = set(), ([], [])
    for i, ids in enumerate((primary, secondary)):
        for m in ids:
            s = TO_LEGACY[m]
            if LEGACY_GROUP[s] not in seen:
                seen.add(LEGACY_GROUP[s])
                out[i].append(s)
    return out


def targets(primary, secondary):
    out = {}
    for m in primary:
        out.setdefault(m, ('primary', PRIMARY_WEIGHT))
    for m in secondary:
        out.setdefault(m, ('secondary', SECONDARY_WEIGHT))
    return out


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


# ─── SQL literals ─────────────────────────────────────────────────────────────
def lit(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (list, dict)):
        return lit(json.dumps(v, ensure_ascii=False)) + '::jsonb'
    return "'" + str(v).replace("'", "''") + "'"


def insert_values(table, rows, columns=None):
    if not rows:
        return ''
    cols = f" ({', '.join(columns)})" if columns else ''
    body = ',\n'.join('(' + ', '.join(lit(v) for v in row) + ')' for row in rows)
    return f'insert into {table}{cols} values\n{body};'


# ─── Plan ─────────────────────────────────────────────────────────────────────
def build_plan(repdb, decisions):
    rep = {r['id']: r for r in repdb['exercises']}
    rows = decisions['rows']
    by_id = {d['id']: d for d in rows}
    problems = []

    def rep_fields(r):
        return dict(repdb_id=r['id'], description=r.get('description_en'),
                    instructions=r.get('instructions_en') or [], tips=r.get('tips_en') or [],
                    is_unilateral=bool(r.get('is_unilateral')), body_part=r.get('body_part'))

    plan, tgt = [], []
    matched = {}
    for d in rows:
        a = d['action']
        p = dict(id=d['id'], kind=a, old_name=d['name'], into_id=None)
        if a == 'merge':
            r = rep.get(d['repdb_id'])
            if r is None:
                problems.append(f"{d['name']}: unknown RepDB id {d['repdb_id']}")
                continue
            if d['repdb_id'] in matched:
                problems.append(f"{d['name']}: RepDB id {d['repdb_id']} already used by {matched[d['repdb_id']]}")
            matched[d['repdb_id']] = d['name']
            p.update(new_name=name_for(r['name_en'], r.get('equipment')), **rep_fields(r))
            for m, (role, w) in targets(r.get('primary_muscles', []), r.get('secondary_muscles', [])).items():
                tgt.append((d['id'], m, role, w))
        elif a == 'merge_into':
            s = by_id.get(d.get('into'))
            if s is None or s['action'] != 'merge':
                problems.append(f"{d['name']}: merge_into must point at a merge row")
                continue
            p.update(new_name=d['name'], into_id=s['id'])
        elif a == 'keep':
            p.update(new_name=d['new_name'])
        elif a == 'hide':
            p.update(new_name=d['name'])
        else:
            problems.append(f"{d['name']}: unknown action {a}")
            continue
        plan.append(p)

    for rid in sorted(set(rep) - set(matched)):
        r = rep[rid]
        et = exercise_type(r)
        prim, sec = legacy_muscles(r.get('primary_muscles', []), r.get('secondary_muscles', []))
        name = name_for(r['name_en'], r.get('equipment'))
        cid = str(uuid.uuid5(ID_NAMESPACE, 'repdb:' + rid))
        plan.append(dict(
            id=cid, kind='new', old_name=None, into_id=None, new_name=name, **rep_fields(r),
            slug=slugify(name), primary_muscles=prim, secondary_muscles=sec, other_muscles=[],
            equipment=equipment_json(r.get('equipment')), movement_type=r.get('mechanic'),
            force_type=r.get('force_type'), category=r.get('category'),
            difficulty=DIFFICULTY.get(r.get('difficulty')), is_main_lift=False, ranking_weight=0.3,
            is_bodyweight=et in ('bodyweight', 'weighted+bodyweight') or (et == 'duration' and r.get('equipment') in BODY_LOADED),
            allows_external_weight=et in ('weighted', 'weighted+bodyweight'), exercise_type=et,
        ))
        for m, (role, w) in targets(r.get('primary_muscles', []), r.get('secondary_muscles', [])).items():
            tgt.append((cid, m, role, w))

    # Names must be unique, and a name we are retiring (it becomes an alias) can't be reused by another row.
    final = {}
    for p in plan:
        final.setdefault(p['new_name'], []).append(p)
    for n, ps in final.items():
        if len(ps) > 1:
            problems.append(f"name '{n}' planned for {len(ps)} rows: {[x['old_name'] or x['repdb_id'] for x in ps]}")
    retired = {p['old_name']: p for p in plan if p['old_name'] and p['old_name'] != p['new_name']}
    for p in plan:
        if p['new_name'] in retired and retired[p['new_name']]['id'] != p['id']:
            problems.append(f"'{p['new_name']}' is the old name of another row")
    for m in {t[1] for t in tgt} - set(TO_LEGACY):
        problems.append(f'unknown RepDB muscle {m}')
    if problems:
        sys.exit('Plan problems:\n  ' + '\n  '.join(problems))
    return plan, tgt


# ─── SQL ──────────────────────────────────────────────────────────────────────
# Owned by inserted rows only; existing rows keep theirs.
NEW_ONLY_COLUMNS = ['primary_muscles', 'secondary_muscles', 'other_muscles', 'equipment', 'movement_type',
                    'force_type', 'category', 'difficulty', 'exercise_type']
# Owned by every row backed by RepDB (merge and inserted rows).
REPDB_COLUMNS = ['description', 'instructions', 'tips', 'is_unilateral', 'body_part']
CATALOG_COLUMNS = (['name', 'slug'] + NEW_ONLY_COLUMNS + ['is_main_lift', 'ranking_weight', 'is_bodyweight',
                   'allows_external_weight', 'repdb_id', 'is_hidden'] + REPDB_COLUMNS)
NEW_ROW_COLUMNS = ['id', 'name', 'slug', 'primary_muscles', 'secondary_muscles', 'other_muscles', 'equipment',
                   'movement_type', 'force_type', 'category', 'difficulty', 'is_main_lift', 'ranking_weight',
                   'is_bodyweight', 'allows_external_weight', 'exercise_type', 'repdb_id', 'is_hidden',
                   'description', 'instructions', 'tips', 'is_unilateral', 'body_part']


def render_sql(plan, tgt):
    plan_cols = ['id', 'kind', 'old_name', 'new_name', 'into_id', 'repdb_id', 'description', 'instructions',
                 'tips', 'is_unilateral', 'body_part']
    plan_rows = [[p.get(c) for c in plan_cols] for p in plan]
    new_rows = [[p['id'], p['new_name'], p['slug'], p['primary_muscles'], p['secondary_muscles'], p['other_muscles'],
                 p['equipment'], p['movement_type'], p['force_type'], p['category'], p['difficulty'],
                 p['is_main_lift'], p['ranking_weight'], p['is_bodyweight'], p['allows_external_weight'],
                 p['exercise_type'], p['repdb_id'], False, p['description'], p['instructions'], p['tips'],
                 p['is_unilateral'], p['body_part']] for p in plan if p['kind'] == 'new']
    slugs = [[p['id'], slugify(p['new_name'])] for p in plan if p['kind'] != 'new' and p['new_name'] != p['old_name']]
    legacy_map = [[k, m] for k, ms in FROM_LEGACY.items() for m in ms]
    log = f"insert into public.data_change_log (batch, table_name, row_id, column_name, old_value, new_value, reason)"
    diff_logs = '\n'.join(
        f"{log}\nselect '{BATCH}', 'exercises_catalog', c.id::uuid, '{col}', to_jsonb(c.{col}), to_jsonb(d.{col}), d.reason\n"
        f"from public.exercises_catalog c join _desired d on d.id = c.id where c.{col} is distinct from d.{col};"
        for col in CATALOG_COLUMNS)
    own_cols = '\n'.join(f"  case when p.kind = 'new' then n.{c} else c.{c} end as {c}," for c in NEW_ONLY_COLUMNS)
    rep_cols = '\n'.join(f"  case when p.kind in ('merge', 'new') then p.{c} else c.{c} end as {c}," for c in REPDB_COLUMNS)
    set_cols = ', '.join(f'{c} = d.{c}' for c in CATALOG_COLUMNS)
    any_diff = ' or '.join(f'c.{c} is distinct from d.{c}' for c in CATALOG_COLUMNS)

    return f"""-- Generated by scripts/catalog/import_repdb.py. Contains RepDB data: never commit this file.
-- Batch '{BATCH}'. One transaction; running it again is a no-op. Revert: scripts/catalog/revert_import.sql
begin;
set local lock_timeout = '10s';

do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'exercises_catalog' and column_name = 'is_hidden')
     or to_regclass('public.exercise_muscle_targets') is null then
    raise exception 'Apply supabase/migrations/20261116_catalog_overhaul.sql first';
  end if;
end $$;

create temp table _plan (
  id text primary key, kind text not null, old_name text, new_name text not null, into_id text,
  repdb_id text, description text, instructions jsonb, tips jsonb, is_unilateral boolean, body_part text
) on commit drop;
{insert_values('_plan', plan_rows)}

create temp table _new_rows (like public.exercises_catalog including defaults) on commit drop;
{insert_values('_new_rows', new_rows, NEW_ROW_COLUMNS)}

create temp table _slugs (id text primary key, slug text not null) on commit drop;
{insert_values('_slugs', slugs)}

create temp table _rep_targets (catalog_id text, muscle_id text, role text, weight numeric) on commit drop;
{insert_values('_rep_targets', tgt)}

create temp table _legacy_muscle (legacy text, muscle_id text) on commit drop;
{insert_values('_legacy_muscle', legacy_map)}

-- ─── 0. The database must be in the state the decisions were made against ───
do $$
declare bad text;
begin
  select string_agg(p.old_name || ' (' || p.id || ')', ', ') into bad from _plan p
  where p.kind <> 'new'
    and not exists (select 1 from public.exercises_catalog c where c.id = p.id and c.name in (p.old_name, p.new_name));
  if bad is not null then raise exception 'Catalog rows missing or renamed since the decisions were made: %', bad; end if;

  select string_agg(c.name, ', ') into bad from public.exercises_catalog c
  join _plan p on p.new_name = c.name and p.id <> c.id
  where not exists (select 1 from _plan q where q.id = c.id and q.new_name <> c.name);
  if bad is not null then raise exception 'Planned names already used by other catalog rows: %', bad; end if;

  select string_agg(n.name, ', ') into bad from _new_rows n
  join public.exercises_catalog c on c.id = n.id where c.repdb_id is distinct from n.repdb_id;
  if bad is not null then raise exception 'Inserted-row ids taken by other rows: %', bad; end if;
end $$;

-- ─── 1. Catalog rows ───
insert into public.exercises_catalog ({', '.join(NEW_ROW_COLUMNS)}, created_at, updated_at)
select {', '.join(NEW_ROW_COLUMNS)}, now(), now() from _new_rows
on conflict (id) do nothing;

{log}
select '{BATCH}', 'exercises_catalog', c.id::uuid, '_row', null, to_jsonb(c), 'RepDB exercise added'
from public.exercises_catalog c join _new_rows n on n.id = c.id
where not exists (select 1 from public.data_change_log l
                  where l.batch = '{BATCH}' and l.table_name = 'exercises_catalog' and l.row_id = c.id::uuid and l.column_name = '_row');

-- Desired state of every planned row. Columns a row's action doesn't own keep their current value.
create temp table _desired on commit drop as
select c.id,
  case when p.kind = 'new' then n.name else p.new_name end as name,
  case when p.kind = 'new' then n.slug else coalesce(s.slug, c.slug) end as slug,
{own_cols}
  case when p.kind = 'new' then n.is_main_lift
       when m.id is not null then coalesce(c.is_main_lift, false) or m.is_main_lift   -- a survivor keeps the
       else c.is_main_lift end as is_main_lift,                                        -- standing of the row
  case when p.kind = 'new' then n.ranking_weight                                      -- merged into it
       else greatest(c.ranking_weight, m.ranking_weight) end as ranking_weight,
  case when p.kind = 'new' then n.is_bodyweight else coalesce(c.is_bodyweight, m.is_bodyweight) end as is_bodyweight,
  case when p.kind = 'new' then n.allows_external_weight
       else coalesce(c.allows_external_weight, m.allows_external_weight) end as allows_external_weight,
  case when p.kind in ('merge', 'new') then p.repdb_id else c.repdb_id end as repdb_id,
  p.kind in ('hide', 'merge_into') as is_hidden,
{rep_cols}
  case p.kind
    when 'merge' then 'catalog overhaul: matched RepDB exercise'
    when 'merge_into' then 'catalog overhaul: same lift as another catalog row'
    when 'keep' then 'catalog overhaul: equipment-first name'
    when 'hide' then 'catalog overhaul: hidden from search'
    else 'catalog overhaul: RepDB exercise' end as reason
from public.exercises_catalog c
join _plan p on p.id = c.id
left join _new_rows n on n.id = c.id
left join _slugs s on s.id = c.id
left join lateral (
  select min(x.id) as id, bool_or(coalesce(x.is_main_lift, false)) as is_main_lift,
         max(x.ranking_weight) as ranking_weight, bool_or(x.is_bodyweight) as is_bodyweight,
         bool_or(x.allows_external_weight) as allows_external_weight
  from _plan q join public.exercises_catalog x on x.id = q.id
  where q.kind = 'merge_into' and q.into_id = c.id
  having count(*) > 0
) m on true;

{diff_logs}

update public.exercises_catalog c set {set_cols}
from _desired d where d.id = c.id and ({any_diff});

-- ─── 2. History: old name -> canonical name ───
create temp table _renames on commit drop as
select p.old_name, p.new_name, p.id as from_id, p.id as to_id from _plan p
where p.kind in ('merge', 'keep') and p.new_name <> p.old_name
union all
select p.old_name, s.new_name, p.id, s.id from _plan p join _plan s on s.id = p.into_id
where p.kind = 'merge_into';

create temp table _ex_fix on commit drop as
select e.id, e.name as old_name, r.new_name, e.catalog_id as old_catalog_id, r.to_id as new_catalog_id,
       e.user_exercise_id as old_user_exercise_id
from public.exercises e
join public.workouts w on w.id = e.workout_id
-- rows logged under a merged duplicate's name after the import already link to the survivor
join _renames r on r.old_name = e.name and e.catalog_id in (r.from_id, r.to_id)
where not exists (select 1 from public.user_exercises u
                  where u.user_id = w.user_id and u.name in (r.old_name, r.new_name));

create temp table _routine_fix on commit drop as
select re.id, re.name as old_name, r.new_name
from public.routine_exercises re
join public.routines rt on rt.id = re.routine_id
join _renames r on r.old_name = re.name
where not exists (select 1 from public.user_exercises u
                  where u.user_id = rt.user_id and u.name in (r.old_name, r.new_name));

create temp table _program_fix on commit drop as
select pe.id, pe.name as old_name, r.new_name
from public.program_day_exercises pe
join public.program_days d on d.id = pe.program_day_id
join public.programs pr on pr.id = d.program_id
join _renames r on r.old_name = pe.name
where not exists (select 1 from public.user_exercises u
                  where u.user_id = pr.user_id and u.name in (r.old_name, r.new_name));

{log}
select '{BATCH}', 'exercises', id, 'name', to_jsonb(old_name), to_jsonb(new_name), 'catalog overhaul: canonical name' from _ex_fix
union all
select '{BATCH}', 'exercises', id, 'catalog_id', to_jsonb(old_catalog_id), to_jsonb(new_catalog_id), 'catalog overhaul: merged duplicate'
from _ex_fix where old_catalog_id <> new_catalog_id
union all
select '{BATCH}', 'routine_exercises', id, 'name', to_jsonb(old_name), to_jsonb(new_name), 'catalog overhaul: canonical name' from _routine_fix
union all
select '{BATCH}', 'program_day_exercises', id, 'name', to_jsonb(old_name), to_jsonb(new_name), 'catalog overhaul: canonical name' from _program_fix;

-- The exercises_link_identity trigger re-resolves catalog_id from the new name.
update public.exercises e set name = f.new_name from _ex_fix f where f.id = e.id;
update public.routine_exercises t set name = f.new_name from _routine_fix f where f.id = t.id;
update public.program_day_exercises t set name = f.new_name from _program_fix f where f.id = t.id;

do $$
declare bad bigint;
begin
  select count(*) into bad from _ex_fix f join public.exercises e on e.id = f.id
  where e.catalog_id is distinct from f.new_catalog_id or e.user_exercise_id is distinct from f.old_user_exercise_id;
  if bad > 0 then raise exception '% renamed exercises did not link to the expected catalog row', bad; end if;
end $$;

-- ─── 3. Aliases ───
create temp table _alias_fix on commit drop as
select a.id, a.canonical_name as old_canonical, r.new_name as new_canonical
from public.exercise_aliases a join _renames r on r.old_name = a.canonical_name;

{log}
select '{BATCH}', 'exercise_aliases', id, 'canonical_name', to_jsonb(old_canonical), to_jsonb(new_canonical),
       'catalog overhaul: canonical name' from _alias_fix;
update public.exercise_aliases a set canonical_name = f.new_canonical from _alias_fix f where f.id = a.id;

do $$
declare bad text;
begin
  select string_agg(a.alias || ' -> ' || a.canonical_name, ', ') into bad
  from public.exercise_aliases a join _renames r on r.old_name = a.alias
  where a.canonical_name <> r.new_name;
  if bad is not null then raise exception 'Aliases already exist with another canonical name: %', bad; end if;
end $$;

with added as (
  insert into public.exercise_aliases (alias, canonical_name)
  select r.old_name, r.new_name from _renames r
  where not exists (select 1 from public.exercise_aliases a where a.alias = r.old_name)
  returning *
)
{log}
select '{BATCH}', 'exercise_aliases', a.id, '_row', null, to_jsonb(a), 'catalog overhaul: old name kept as alias' from added a;

do $$
declare bad text;
begin
  -- every alias resolves, one way, to a catalog row
  select string_agg(a.alias, ', ') into bad from public.exercise_aliases a
  where not exists (select 1 from public.exercises_catalog c where c.name = lower(btrim(a.canonical_name)));
  if bad is not null then raise exception 'Aliases pointing at no catalog row: %', bad; end if;
  select string_agg(k, ', ') into bad from (
    select lower(btrim(alias)) k from public.exercise_aliases group by 1
    having count(distinct lower(btrim(canonical_name))) > 1) x;
  if bad is not null then raise exception 'Aliases with conflicting targets: %', bad; end if;
  -- an alias must not shadow a different visible exercise
  select string_agg(a.alias, ', ') into bad from public.exercise_aliases a
  join public.exercises_catalog c on c.name = lower(btrim(a.alias)) and not coalesce(c.is_hidden, false)
  where lower(btrim(a.canonical_name)) <> c.name;
  if bad is not null then raise exception 'Aliases shadowing a visible exercise: %', bad; end if;
end $$;

-- ─── 4. Muscle targets ───
create temp table _targets on commit drop as
select catalog_id, muscle_id, role, weight from _rep_targets
union all
(select distinct on (x.id, x.muscle_id) x.id, x.muscle_id, x.role, x.weight from (
  select c.id, lm.muscle_id, 'primary' as role, {PRIMARY_WEIGHT}::numeric as weight, 0 as rank
  from public.exercises_catalog c join _plan p on p.id = c.id and p.kind in ('keep', 'hide', 'merge_into')
  cross join lateral jsonb_array_elements_text(coalesce(c.primary_muscles, '[]')) pm(m)
  join _legacy_muscle lm on lm.legacy = lower(btrim(pm.m))
  union all
  select c.id, lm.muscle_id, 'secondary', {SECONDARY_WEIGHT}::numeric, 1
  from public.exercises_catalog c join _plan p on p.id = c.id and p.kind in ('keep', 'hide', 'merge_into')
  cross join lateral jsonb_array_elements_text(coalesce(c.secondary_muscles, '[]')) sm(m)
  join _legacy_muscle lm on lm.legacy = lower(btrim(sm.m))
) x order by x.id, x.muscle_id, x.rank);

delete from public.exercise_muscle_targets t
where t.catalog_id in (select id from _plan)
  and not exists (select 1 from _targets x where x.catalog_id = t.catalog_id and x.muscle_id = t.muscle_id);
insert into public.exercise_muscle_targets (catalog_id, muscle_id, role, weight)
select catalog_id, muscle_id, role, weight from _targets
on conflict (catalog_id, muscle_id) do update set role = excluded.role, weight = excluded.weight
where (exercise_muscle_targets.role, exercise_muscle_targets.weight) is distinct from (excluded.role, excluded.weight);

-- ─── Summary ───
do $$
declare r record;
begin
  select
    (select count(*) from public.exercises_catalog) as catalog_rows,
    (select count(*) from public.exercises_catalog where coalesce(is_hidden, false)) as hidden_rows,
    (select count(*) from public.exercise_aliases) as aliases,
    (select count(*) from public.exercise_muscle_targets) as targets,
    (select count(*) from public.data_change_log where batch = '{BATCH}') as logged_total,
    (select count(*) from _ex_fix) as exercises_renamed,
    (select count(*) from _routine_fix) as routine_rows_renamed,
    (select count(*) from _program_fix) as program_rows_renamed
  into r;
  raise notice 'catalog overhaul: %', row_to_json(r);
end $$;

commit;
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--repdb', required=True, help='private copy of the RepDB exercises.json')
    ap.add_argument('--decisions', default=os.path.join(HERE, 'decisions.json'))
    ap.add_argument('--out', required=True, help='where to write the SQL (outside the repo)')
    ap.add_argument('--apply', metavar='DATABASE_URL', help='also run it with psql against this database')
    args = ap.parse_args()

    repo = os.path.abspath(os.path.join(HERE, '..', '..'))
    if os.path.abspath(args.out).startswith(repo + os.sep):
        sys.exit('--out must be outside the repo: the generated SQL contains RepDB data')
    with open(args.repdb, encoding='utf-8') as f:
        repdb = json.load(f)
    with open(args.decisions, encoding='utf-8') as f:
        decisions = json.load(f)
    plan, tgt = build_plan(repdb, decisions)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(render_sql(plan, tgt))
    kinds = {}
    for p in plan:
        kinds[p['kind']] = kinds.get(p['kind'], 0) + 1
    print(f'wrote {args.out}: {kinds}, {len(tgt)} RepDB muscle targets')
    if args.apply:
        subprocess.run(['psql', args.apply, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', args.out], check=True)


if __name__ == '__main__':
    main()
