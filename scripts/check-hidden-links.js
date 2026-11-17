#!/usr/bin/env node
/**
 * Checks the "Hidden links" in CODEBASE_MAP.md: connections that TypeScript and LSP can't see,
 * where changing one side compiles fine and breaks the other silently.
 *
 *   npm run check:links                  check that each link still holds (exit 1 if not)
 *   npm run check:links -- --touched     list the hidden links (and structure changes) this branch
 *                                        touches compared with origin/main, for the PR-time map refresh
 *   --root <dir>                         check another checkout (used by the personal Stop hook's baseline)
 *
 * Each check prints one line per problem, prefixed "✗ <check>:". A problem can be a real bug or a
 * map that's out of date: look at both sides before changing either.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

function walk(dir, re, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, re, out);
    else if (re.test(entry.name)) out.push(rel);
  }
  return out;
}

/** Latest migration (by file name) whose SQL matches `re`. */
function latestMigration(re) {
  const files = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const rel = `supabase/migrations/${files[i]}`;
    if (re.test(read(rel))) return rel;
  }
  return null;
}

const strings = (s) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);

/* ── Checks ─────────────────────────────────────────────────────────── */

const checks = {
  /** Every route name passed to navigate() etc. is registered in a navigator; tab-keyed maps match the tabs. */
  routes() {
    const problems = [];
    const navFiles = walk('src/navigation', /\.tsx$/);
    const registered = new Set();
    for (const f of navFiles) for (const m of read(f).matchAll(/name="(\w+)"/g)) registered.add(m[1]);
    const tabs = new Set([...read('src/navigation/TabNavigator.tsx').matchAll(/name="(\w+)"/g)].map((m) => m[1]));

    for (const f of walk('src', /\.tsx?$/)) {
      for (const m of read(f).matchAll(/\b(?:navigate|navigateWorkoutsStack|globalNavigate|push|replace)\(\s*'(\w+)'/g)) {
        if (!registered.has(m[1])) problems.push(`${f}: navigates to '${m[1]}', which no navigator registers`);
      }
    }
    const icons = read('src/navigation/TabNavigator.tsx').match(/TAB_ICONS[^=]*=\s*\{([\s\S]*?)\}/);
    if (icons) {
      const keys = new Set([...icons[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]));
      for (const t of tabs) if (!keys.has(t)) problems.push(`TabNavigator TAB_ICONS has no icon for tab '${t}'`);
      for (const k of keys) if (!tabs.has(k)) problems.push(`TabNavigator TAB_ICONS has '${k}', which isn't a tab`);
    }
    const cta = read('src/constants/changelog.ts').match(/type ChangelogCtaTarget\s*=([^;]+);/);
    if (cta) for (const t of strings(cta[1])) if (!tabs.has(t)) problems.push(`changelog.ts ChangelogCtaTarget '${t}' isn't a tab`);
    return problems;
  },

  /** Every key the app sends to upsert_workout is read by the latest SQL definition. */
  workoutPayload() {
    const sql = latestMigration(/function\s+public\.upsert_workout\b/i);
    if (!sql) return ['no migration defines public.upsert_workout'];
    const text = read(sql);
    const read_ = new Set([...text.matchAll(/->>?\s*'(\w+)'/g)].map((m) => m[1]));
    for (const m of text.matchAll(/jsonb_to_recordset\([^)]*\)\)?\s+as\s+\w+\(([^)]*)\)/gi)) {
      for (const col of m[1].split(',')) read_.add(col.trim().split(/\s+/)[0]);
    }
    const ts = read('src/utils/workoutPayload.ts');
    const problems = [];
    for (const iface of ['WorkoutPayload', 'ExerciseRow', 'SetRow']) {
      const body = ts.match(new RegExp(`interface ${iface}\\s*\\{([\\s\\S]*?)\\n\\}`));
      if (!body) { problems.push(`workoutPayload.ts: interface ${iface} not found`); continue; }
      for (const m of body[1].matchAll(/^\s{2}(\w+)\??:/gm)) {
        if (!read_.has(m[1])) problems.push(`workoutPayload.ts ${iface}.${m[1]} is sent but ${path.basename(sql)} never reads it`);
      }
    }
    return problems;
  },

  /** The Big Three names in the leaderboard SQL are counted by strength score, and the picker's names are on the boards. */
  mainLifts() {
    const sql = latestMigration(/squat_kg/);
    if (!sql) return ['no migration defines the Big Three leaderboard (squat_kg)'];
    const text = read(sql);
    const assigned = read('src/utils/strengthScore.ts').match(/MAIN_LIFT_ASSIGNMENTS[^=]*=\s*\{([\s\S]*?)\};/);
    const scoreNames = new Set(assigned ? [...assigned[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]) : []);
    const picker = read('src/components/workout-sheet/exercise-picker/pickerData.ts');
    const pickerNames = [...picker.matchAll(/names:\s*\[([^\]]*)\]/g)].flatMap((m) => strings(m[1]));
    const problems = [];
    const sqlNames = new Set();
    for (const m of text.matchAll(/in\s*\(([^)]*)\)\s*then[^\n]*as\s+(bench|squat|deadlift)_kg/g)) {
      for (const n of strings(m[1])) {
        sqlNames.add(n);
        if (!scoreNames.has(n)) problems.push(`'${n}' counts for the ${m[2]} leaderboard (${path.basename(sql)}) but not for strength score (strengthScore.ts MAIN_LIFT_ASSIGNMENTS)`);
      }
    }
    for (const n of pickerNames) if (!sqlNames.has(n)) problems.push(`pickerData.ts LEADERBOARD_LIFTS name '${n}' isn't in the leaderboard SQL (${path.basename(sql)})`);
    return problems;
  },

  /** MUSCLE_MAP_ID names the installed momentum-muscle-map's region-id set. */
  muscleMapId() {
    const pkg = 'node_modules/momentum-muscle-map/package.json';
    if (!exists(pkg)) return []; // not installed here; nothing to compare
    const version = JSON.parse(read(pkg)).version;
    const [major, minor] = version.split('.').map(Number);
    const expected = `momentum-muscle-map@${major === 0 ? `0.${minor}` : major}`;
    const id = read('src/constants/muscleMap.ts').match(/MUSCLE_MAP_ID\s*=\s*'([^']+)'/);
    if (!id) return ['muscleMap.ts: MUSCLE_MAP_ID not found'];
    return id[1] === expected ? [] : [`MUSCLE_MAP_ID is '${id[1]}' but the installed map is ${version} (expects '${expected}' and matching exercise_region_targets rows)`];
  },

  /** Every store with a sign-out reset is reset by useAuthStore on sign-out. */
  signOutReset() {
    const auth = read('src/stores/useAuthStore.ts');
    const problems = [];
    for (const f of fs.readdirSync(path.join(root, 'src/stores')).filter((n) => /^use\w+Store\.ts$/.test(n))) {
      const store = f.replace(/\.ts$/, '');
      for (const m of read(`src/stores/${f}`).matchAll(/^\s*(resetForSignOut|clearCaches)\s*:\s*\(/gm)) {
        if (!auth.includes(`${store}.getState().${m[1]}()`)) problems.push(`${store}.${m[1]} is never called from useAuthStore's sign-out`);
      }
    }
    return problems;
  },
};

/* ── --touched: which hidden links and structure this branch changes ─── */

function touched() {
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8' });
  const base = git('merge-base HEAD origin/main').trim();
  const status = git(`diff --name-status ${base}`).split(/\r?\n/).filter(Boolean)
    .concat(git('ls-files --others --exclude-standard').split(/\r?\n/).filter(Boolean).map((f) => `A\t${f}`));
  const changed = status.map((l) => l.split('\t').pop());

  const map = read('CODEBASE_MAP.md');
  const section = map.split('### Hidden links')[1]?.split(/\n## /)[0] || '';
  const hits = [];
  for (const row of section.split(/\r?\n/).filter((l) => /^\| [^-]/.test(l) && !l.startsWith('| Link'))) {
    const name = row.split('|')[1].trim();
    const spans = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((s) => s.includes('/') && !/\s/.test(s));
    const files = changed.filter((c) => spans.some((s) => (s.endsWith('/') ? `/${c}`.includes(`/${s}`) : `/${c}`.endsWith(`/${s}`))));
    if (files.length) hits.push(`• ${name}\n    changed: ${files.join(', ')}`);
  }
  const structural = status.filter((l) => /^[ADR]/.test(l) && /^(src|modules|targets|supabase|scripts)\//.test(l.split('\t').pop()));

  console.log(hits.length ? `Hidden links this branch touches (re-check both ends, update the map row if it's no longer true):\n${hits.join('\n')}` : 'No hidden links touched.');
  console.log(structural.length
    ? `\nFiles added, deleted or renamed (check the map's directory/feature tables and "Where to find X"):\n${structural.map((l) => `  ${l.replace(/\t/g, ' ')}`).join('\n')}`
    : '\nNo files added, deleted or renamed.');
  console.log('\nAlso add a Hidden links row for any new string/SQL/getState() connection the diff creates.');
}

/* ── Main ────────────────────────────────────────────────────────────── */

if (args.includes('--touched')) {
  touched();
} else {
  let failed = 0;
  for (const [name, check] of Object.entries(checks)) {
    let problems;
    try { problems = check(); } catch (e) { problems = [`check crashed: ${e.message}`]; }
    for (const p of problems) console.log(`✗ ${name}: ${p}`);
    failed += problems.length;
  }
  if (failed) {
    console.log(`\n${failed} hidden-link problem(s). Each is either a real bug or an out-of-date map: check both sides.`);
    process.exit(1);
  }
  console.log(`Hidden links: all ${Object.keys(checks).length} checks pass.`);
}
