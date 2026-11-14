#!/usr/bin/env python3
"""Check exercise_region_targets rows against the deep muscle map and the catalog.

    python3 scripts/catalog/check_region_targets.py --db "$DATABASE_URL" --map ../momentum-muscle-map

Checks the rows stored in the database for one map_id (default: the one in region_overrides.json).
region_targets.py runs the same checks on the rows it generates, before it writes any SQL.
Exits 1 if any check fails.

Checks:
  * every region is a part or muscle slug of the map (src/data/hierarchy.ts), unsided, and never a
    non-muscle region (tendons, fascia, kneecap);
  * one exercise never lists a muscle and one of that muscle's parts (the sum per region would be
    ambiguous);
  * every visible catalog row has at least one region, except rows listed under no_targets in
    region_overrides.json, which must have none. Hidden rows may be missing;
  * the strongest region of every exercise is exactly 1.00;
  * no duplicate (exercise, region) pairs; weights are in (0, 1] with at most two decimals;
    source is hand or rule; every catalog id exists.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OVERRIDES = os.path.join(HERE, 'region_overrides.json')
DEFAULT_MAP = os.path.join(os.path.dirname(REPO), 'momentum-muscle-map')
NON_MUSCLE_GROUP = 'connective'  # the map's group for tendons, fascia and the kneecap
SOURCES = ('hand', 'rule')
HIERARCHY = 'src/data/hierarchy.ts'


def _git(repo, *args):
    """Output of a git command in repo, or '' if repo is not a git checkout."""
    try:
        return subprocess.run(['git', '-C', repo, *args], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ''


class MapVocab:
    """Region vocabulary of one momentum-muscle-map checkout, read from src/data/hierarchy.ts."""

    def __init__(self, map_dir):
        with open(os.path.join(map_dir, HIERARCHY)) as f:
            src = f.read()
        m = re.search(r'export const PARTS\b[^=]*=\s*(\{.*?\});', src, re.S)
        if not m:
            raise SystemExit(f'{map_dir}: PARTS not found in {HIERARCHY}')
        with open(os.path.join(map_dir, 'package.json')) as f:
            pkg = json.load(f)
        self.version = pkg['version']
        self.map_id = f"{pkg['name']}@{self.version}"
        # The commit that last changed the region ids, so unrelated renderer commits don't matter.
        self.commit = _git(map_dir, 'log', '-1', '--format=%H', '--', HIERARCHY) or None
        if _git(map_dir, 'status', '--porcelain', '--', HIERARCHY, 'package.json'):
            raise SystemExit(f'{map_dir}: {HIERARCHY} or package.json has uncommitted changes; use a committed version')
        self.part_of = {}                       # part -> muscle
        self.muscles = defaultdict(list)        # muscle -> its parts, in map order
        self.groups = defaultdict(list)         # group -> its parts, in map order
        self.non_muscle = set()
        for part, (muscle, group, _weight) in json.loads(m.group(1)).items():
            if group == NON_MUSCLE_GROUP:
                self.non_muscle.update((part, muscle))
                continue
            self.part_of[part] = muscle
            self.muscles[muscle].append(part)
            self.groups[group].append(part)
        self.muscles, self.groups = dict(self.muscles), dict(self.groups)

    def is_region(self, slug):
        """A part or muscle slug that takes values (groups are too coarse for targets)."""
        return slug not in self.non_muscle and (slug in self.part_of or slug in self.muscles)

    def expand(self, slug):
        """Parts covered by a part, muscle or group slug. Raises on anything else."""
        if slug in self.part_of:
            return [slug]
        if slug in self.muscles:
            return list(self.muscles[slug])
        if slug in self.groups:
            return list(self.groups[slug])
        raise ValueError(f'"{slug}" is not a muscle region of {self.map_id}')

    def muscle_of(self, slug):
        return self.part_of.get(slug, slug)


def psql_json(psql, db, sql):
    """Runs a query that returns one JSON value and parses it."""
    out = subprocess.run([psql, db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def load_catalog(psql, db):
    """id -> {hidden, uses}; uses = logged exercises rows linked to the row."""
    rows = psql_json(psql, db, """
        select coalesce(json_agg(json_build_object(
                 'id', c.id, 'name', c.name, 'equipment', coalesce(c.equipment, '[]'::jsonb),
                 'hidden', coalesce(c.is_hidden, false), 'uses', coalesce(u.n, 0),
                 'targets', coalesce(t.targets, '[]'::json)) order by c.id), '[]')
        from public.exercises_catalog c
        left join (select catalog_id, count(*) as n from public.exercises
                   where catalog_id is not null group by 1) u on u.catalog_id = c.id
        left join (select catalog_id, json_agg(json_build_object('muscle', muscle_id, 'role', role,
                          'weight', weight) order by muscle_id) as targets
                   from public.exercise_muscle_targets group by 1) t on t.catalog_id = c.id""")
    return {r['id']: r for r in rows}


def load_overrides(path=OVERRIDES):
    with open(path) as f:
        return json.load(f)


def validate(rows, catalog, vocab, exempt):
    """rows: iterable of (catalog_id, region, weight, source). Returns a list of error strings."""
    errors = []
    by_exercise = defaultdict(dict)
    for catalog_id, region, weight, source in rows:
        where = f'{catalog_id} {region}'
        if catalog_id not in catalog:
            errors.append(f'{where}: no such catalog row')
        if not vocab.is_region(region):
            kind = 'non-muscle region' if region in vocab.non_muscle else 'not a part or muscle slug'
            errors.append(f'{where}: {kind} of {vocab.map_id}')
        w = Decimal(str(weight))
        if not (0 < w <= 1) or w != w.quantize(Decimal('0.01')):
            errors.append(f'{where}: weight {weight} is not in (0, 1] with two decimals')
        if source not in SOURCES:
            errors.append(f'{where}: source {source!r} is not one of {SOURCES}')
        if region in by_exercise[catalog_id]:
            errors.append(f'{where}: duplicate region')
        by_exercise[catalog_id][region] = w

    for catalog_id, regions in by_exercise.items():
        top = max(regions.values())
        if top != 1:
            errors.append(f'{catalog_id}: strongest region is {top}, not 1.00')
        muscles = {r for r in regions if r in vocab.muscles and vocab.muscles[r] != [r]}
        for r in regions:
            if r not in muscles and vocab.muscle_of(r) in muscles:
                errors.append(f'{catalog_id}: lists both {vocab.muscle_of(r)} and its part {r}')
        if catalog_id in exempt:
            errors.append(f'{catalog_id}: listed under no_targets but has regions')

    for catalog_id, row in catalog.items():
        if not row['hidden'] and catalog_id not in by_exercise and catalog_id not in exempt:
            errors.append(f'{catalog_id}: visible catalog row has no regions')
    for catalog_id in exempt:
        if catalog_id not in catalog:
            errors.append(f'{catalog_id}: no_targets lists a catalog id that does not exist')
    return errors


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--db', required=True, metavar='DATABASE_URL')
    ap.add_argument('--map', default=DEFAULT_MAP, metavar='DIR', help='momentum-muscle-map checkout (default: %(default)s)')
    ap.add_argument('--map-id', help='map_id to check (default: the one in region_overrides.json)')
    ap.add_argument('--psql', default=os.environ.get('PSQL', 'psql'))
    args = ap.parse_args()

    overrides = load_overrides()
    map_id = args.map_id or overrides['map_id']
    vocab = MapVocab(args.map)
    if vocab.map_id != map_id:
        raise SystemExit(f'{args.map} is {vocab.map_id}, but the rows are for {map_id}')
    catalog = load_catalog(args.psql, args.db)
    rows = psql_json(args.psql, args.db, f"""
        select coalesce(json_agg(json_build_array(catalog_id, region, weight, source)), '[]')
        from public.exercise_region_targets where map_id = '{map_id.replace("'", "''")}'""")
    errors = validate(rows, catalog, vocab, set(overrides.get('no_targets', {})))
    exercises = {r[0] for r in rows}
    visible = sum(1 for c in catalog.values() if not c['hidden'])
    print(f'{map_id}: {len(rows)} rows for {len(exercises)} exercises '
          f'({sum(1 for i in exercises if not catalog.get(i, {}).get("hidden", True))} of {visible} visible)')
    for e in errors:
        print('  ' + e, file=sys.stderr)
    print('FAILED' if errors else 'OK: all checks passed')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
