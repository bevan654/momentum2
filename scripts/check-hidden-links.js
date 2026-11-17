#!/usr/bin/env node
/**
 * Checks the "Hidden links" in CODEBASE_MAP.md: connections that TypeScript and LSP can't see,
 * where changing one side compiles fine and breaks the other silently.
 *
 *   npm run check:links                  check that each link still holds (exit 1 if not)
 *   npm run check:links -- --touched     list the hidden links (and structure changes) this branch
 *                                        touches compared with origin/main, for the PR-time map refresh
 *   --root <dir>                         check another checkout (e.g. a worktree of main, to compare)
 *
 * Each check prints one line per problem, prefixed "✗ <check>:". A problem can be a real bug or a
 * map that's out of date: look at both sides before changing either. A check that can't find what
 * it reads reports that as a problem, so a check never passes because it matched nothing.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
if (rootArg >= 0 && (!args[rootArg + 1] || args[rootArg + 1].startsWith('--'))) {
  console.error('Usage: node scripts/check-hidden-links.js [--touched] [--root <dir>]');
  process.exit(2);
}
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const notes = []; // checks that were skipped, printed so a skip never looks like a pass

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

/** The `{ … }` starting at `open` (index of the opening brace), by brace matching. */
function braceBlock(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open);
}

/* ── Checks ─────────────────────────────────────────────────────────── */

const checks = {
  /** Every route name passed to navigate() etc. is registered in a navigator; tab-keyed strings match the tabs. */
  routes() {
    const problems = [];
    const screenNames = (text) => [...text.matchAll(/<\w+\.Screen\b[^>]*?\bname="(\w+)"/g)].map((m) => m[1]);
    const registered = new Set();
    for (const f of walk('src/navigation', /\.tsx$/)) for (const n of screenNames(read(f))) registered.add(n);
    const tabNav = read('src/navigation/TabNavigator.tsx');
    const tabs = new Set(screenNames(tabNav));
    if (tabs.size === 0) return ['TabNavigator.tsx: found no <Tab.Screen name="…"> (the check needs updating)'];

    let calls = 0;
    for (const f of walk('src', /\.tsx?$/)) {
      for (const m of read(f).matchAll(/\b(?:navigate|navigateWorkoutsStack|globalNavigate|push|replace)\(\s*'(\w+)'/g)) {
        calls++;
        if (!registered.has(m[1])) problems.push(`${f}: navigates to '${m[1]}', which no navigator registers`);
      }
    }
    if (calls === 0) problems.push('found no navigate(\'…\') calls in src (the check needs updating)');
    for (const m of tabNav.matchAll(/route\.name\s*===\s*'(\w+)'/g)) {
      if (!tabs.has(m[1])) problems.push(`TabNavigator compares route.name to '${m[1]}', which isn't a tab`);
    }
    const icons = tabNav.match(/TAB_ICONS[^=]*=\s*\{([\s\S]*?)\}/);
    if (!icons) problems.push('TabNavigator.tsx: TAB_ICONS not found (the check needs updating)');
    else {
      const keys = new Set([...icons[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]));
      for (const t of tabs) if (!keys.has(t)) problems.push(`TabNavigator TAB_ICONS has no icon for tab '${t}'`);
      for (const k of keys) if (!tabs.has(k)) problems.push(`TabNavigator TAB_ICONS has '${k}', which isn't a tab`);
    }
    const cta = read('src/constants/changelog.ts').match(/type ChangelogCtaTarget\s*=([^;]+);/);
    if (!cta) problems.push('changelog.ts: type ChangelogCtaTarget not found (the check needs updating)');
    else for (const t of strings(cta[1])) if (!tabs.has(t)) problems.push(`changelog.ts ChangelogCtaTarget '${t}' isn't a tab`);
    return problems;
  },

  /** Every key the app sends to upsert_workout is read by the latest SQL definition. */
  workoutPayload() {
    const sql = latestMigration(/function\s+public\.upsert_workout\b/i);
    if (!sql) return ['no migration defines public.upsert_workout'];
    const text = read(sql);
    const sqlKeys = new Set([...text.matchAll(/->>?\s*'(\w+)'/g)].map((m) => m[1]));
    for (const m of text.matchAll(/jsonb_to_recordset\([^)]*\)\)?\s+as\s+\w+\(([^)]*)\)/gi)) {
      for (const col of m[1].split(',')) sqlKeys.add(col.trim().split(/\s+/)[0]);
    }
    const sqlName = path.basename(sql);
    const problems = [];

    // The typed payload built by utils/workoutPayload.ts (create / replace).
    const ts = read('src/utils/workoutPayload.ts');
    for (const iface of ['WorkoutPayload', 'ExerciseRow', 'SetRow']) {
      const body = ts.match(new RegExp(`interface ${iface}\\s*\\{([\\s\\S]*?)\\r?\\n\\}`));
      if (!body) { problems.push(`workoutPayload.ts: interface ${iface} not found (the check needs updating)`); continue; }
      const fields = [...body[1].matchAll(/^\s+(?:readonly\s+)?(\w+)\??:/gm)].map((m) => m[1]);
      if (fields.length === 0) problems.push(`workoutPayload.ts: interface ${iface} has no fields the check can read (the check needs updating)`);
      for (const k of fields) if (!sqlKeys.has(k)) problems.push(`workoutPayload.ts ${iface}.${k} is sent but ${sqlName} never reads it`);
    }

    // Callers that build the payload inline, e.g. the history editor's mode 'edit'.
    for (const file of walk('src', /\.tsx?$/)) {
      const src = read(file);
      for (const call of src.matchAll(/\.rpc\(\s*'upsert_workout'\s*,\s*\{/g)) {
        const literal = braceBlock(src, call.index + call[0].length - 1);
        for (const m of literal.matchAll(/^\s*(\w+)\s*:/gm)) {
          if (m[1] !== 'p' && !sqlKeys.has(m[1])) problems.push(`${file}: sends '${m[1]}' to upsert_workout but ${sqlName} never reads it`);
        }
      }
    }
    return problems;
  },

  /** The Big Three names in the leaderboard SQL are counted by strength score, and the picker's names are on the boards. */
  mainLifts() {
    const sql = latestMigration(/as\s+squat_kg/);
    if (!sql) return ['no migration defines the Big Three leaderboard (… as squat_kg)'];
    const text = read(sql);
    const sqlName = path.basename(sql);
    const assigned = read('src/utils/strengthScore.ts').match(/MAIN_LIFT_ASSIGNMENTS[^=]*=\s*\{([\s\S]*?)\};/);
    if (!assigned) return ['strengthScore.ts: MAIN_LIFT_ASSIGNMENTS not found (the check needs updating)'];
    const scoreNames = new Set([...assigned[1].matchAll(/^\s*'([^']+)'\s*:/gm)].map((m) => m[1]));
    const picker = read('src/components/workout-sheet/exercise-picker/pickerData.ts');
    const pickerNames = [...picker.matchAll(/names:\s*\[([^\]]*)\]/g)].flatMap((m) => strings(m[1]));
    const problems = [];
    const sqlNames = new Set();
    const lifts = new Set();
    for (const m of text.matchAll(/in\s*\(([^)]*)\)\s*then[^\n]*as\s+(bench|squat|deadlift)_kg/g)) {
      lifts.add(m[2]);
      for (const n of strings(m[1])) {
        sqlNames.add(n);
        if (!scoreNames.has(n)) problems.push(`'${n}' counts for the ${m[2]} leaderboard (${sqlName}) but not for strength score (strengthScore.ts MAIN_LIFT_ASSIGNMENTS)`);
      }
    }
    if (lifts.size < 3) problems.push(`${sqlName}: found name lists for ${lifts.size} of the 3 lifts (the check needs updating)`);
    if (pickerNames.length === 0) problems.push('pickerData.ts: LEADERBOARD_LIFTS names not found (the check needs updating)');
    for (const n of pickerNames) if (!sqlNames.has(n)) problems.push(`pickerData.ts LEADERBOARD_LIFTS name '${n}' isn't in the leaderboard SQL (${sqlName})`);
    return problems;
  },

  /** MUSCLE_MAP_ID names the installed momentum-muscle-map's region-id set. */
  muscleMapId() {
    const pkg = 'node_modules/momentum-muscle-map/package.json';
    if (!exists(pkg)) {
      notes.push('muscleMapId skipped: momentum-muscle-map is not installed here (run npm install)');
      return [];
    }
    const version = JSON.parse(read(pkg)).version;
    const [major, minor] = version.split('.').map(Number);
    const expected = `momentum-muscle-map@${major === 0 ? `0.${minor}` : major}`;
    const id = read('src/constants/muscleMap.ts').match(/MUSCLE_MAP_ID\s*=\s*'([^']+)'/);
    if (!id) return ['muscleMap.ts: MUSCLE_MAP_ID not found (the check needs updating)'];
    return id[1] === expected ? [] : [`MUSCLE_MAP_ID is '${id[1]}' but the installed map is ${version} (expects '${expected}' and matching exercise_region_targets rows)`];
  },

  /** Every store with a sign-out reset is called by useAuthStore. */
  signOutReset() {
    const auth = read('src/stores/useAuthStore.ts');
    const problems = [];
    let found = 0;
    for (const f of fs.readdirSync(path.join(root, 'src/stores')).filter((n) => /^use\w+Store\.ts$/.test(n))) {
      const store = f.replace(/\.ts$/, '');
      // `reset: () =>`, `reset: async () =>` or `reset() {`
      for (const m of read(`src/stores/${f}`).matchAll(/^\s*(?:async\s+)?(resetForSignOut|clearCaches)\s*(?::\s*(?:async\s*)?\(|\()/gm)) {
        found++;
        if (!auth.includes(`${store}.getState().${m[1]}()`)) problems.push(`${store}.${m[1]} is never called from useAuthStore`);
      }
    }
    if (found === 0) problems.push('found no store with resetForSignOut/clearCaches (the check needs updating)');
    return problems;
  },
};

/* ── --touched: which hidden links and structure this branch changes ─── */

function touched() {
  const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let base;
  try {
    base = git('merge-base HEAD origin/main').trim();
  } catch {
    console.error('origin/main not found: run `git fetch origin` first.');
    process.exit(2);
  }
  const status = git(`diff --name-status ${base}`).split(/\r?\n/).filter(Boolean)
    .concat(git('ls-files --others --exclude-standard').split(/\r?\n/).filter(Boolean).map((f) => `A\t${f}`));
  // Renames and copies list old and new paths: match both against the map.
  const changed = status.flatMap((l) => l.split('\t').slice(1));

  const section = read('CODEBASE_MAP.md').split('### Hidden links')[1]?.split(/\r?\n## /)[0] || '';
  const hits = [];
  for (const row of section.split(/\r?\n/).filter((l) => /^\| [^-]/.test(l) && !l.startsWith('| Link'))) {
    const name = row.split('|')[1].trim();
    const spans = [...row.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((s) => s.includes('/') && !/\s/.test(s));
    const files = changed.filter((c) => spans.some((s) => (s.endsWith('/') ? `/${c}`.includes(`/${s}`) : `/${c}`.endsWith(`/${s}`))));
    if (files.length) hits.push(`• ${name}\n    changed: ${[...new Set(files)].join(', ')}`);
  }
  const structural = status.filter((l) => /^[ADRC]/.test(l) && /^(src|modules|targets|supabase|scripts)\//.test(l.split('\t').pop()));

  console.log(hits.length ? `Hidden links this branch touches (re-check both ends, update the map row if it's no longer true):\n${hits.join('\n')}` : 'No hidden links touched.');
  console.log(structural.length
    ? `\nFiles added, deleted, renamed or copied (check the map's directory/feature tables and "Where to find X"):\n${structural.map((l) => `  ${l.replace(/\t/g, ' ')}`).join('\n')}`
    : '\nNo files added, deleted, renamed or copied.');
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
  for (const n of notes) console.log(`- ${n}`);
  if (failed) {
    console.log(`\n${failed} hidden-link problem(s). Each is either a real bug or an out-of-date map: check both sides.`);
    process.exit(1);
  }
  console.log(`Hidden links: all ${Object.keys(checks).length} checks pass.`);
}
