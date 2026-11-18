#!/usr/bin/env node
/**
 * Checks that every file or folder path mentioned in CODEBASE_MAP.md still exists, and that the
 * screen/store/table counts written in CODEBASE_MAP.md, CLAUDE.md and AGENTS.md match the code.
 * Run with `npm run check:map` after changing the map or moving code.
 * Optional argument: a different map file to check.
 *
 * The map writes some paths in short form (`food/AddFoodModal`, `stores/useWeightStore.ts`),
 * so each `code span` that looks like a path is tried as written, then under `src/` and
 * `src/components/`, with and without the usual extensions. Names are matched with exact
 * case, so a path that only works on Windows/macOS fails here too.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mapFile = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'CODEBASE_MAP.md');
const mapName = path.basename(mapFile);
const text = fs.readFileSync(mapFile, 'utf8');

const prefixes = ['', 'src/', 'src/components/'];
const extensions = ['', '.ts', '.tsx', '.js', '.md', '.json'];
const fileLike = /\.(tsx?|jsx?|md|json|sql|py|swift|kt|png|plist)$/;

// Generated or build output: listed in the map's Ignore section, may not exist locally.
const generated = new Set(['node_modules/', '.expo/', 'ios/', 'android/', 'dist/']);

const dirCache = new Map();
function listDir(dir) {
  if (!dirCache.has(dir)) {
    try {
      dirCache.set(dir, new Set(fs.readdirSync(dir)));
    } catch {
      dirCache.set(dir, null);
    }
  }
  return dirCache.get(dir);
}

/** True if repo-relative `rel` exists with exactly this case (and is a folder when wantDir). */
function existsExact(rel, wantDir) {
  let current = root;
  for (const segment of rel.split('/').filter(Boolean)) {
    const entries = listDir(current);
    if (!entries || !entries.has(segment)) return false;
    current = path.join(current, segment);
  }
  return wantDir ? fs.statSync(current).isDirectory() : true;
}

/** Returns the repo-relative path the candidate resolves to, or null. */
function resolve(candidate, bases) {
  const wantDir = candidate.endsWith('/');
  const clean = candidate.replace(/\/$/, '');
  for (const base of bases) {
    for (const ext of wantDir ? [''] : extensions) {
      const rel = base + clean + ext;
      if (existsExact(rel, wantDir)) return rel;
    }
  }
  return null;
}

const codeSpans = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());

const missing = [];
let checked = 0;
const lines = text.split(/\r?\n/);

lines.forEach((line, i) => {
  // In a table row, bare names are relative to the folder in the row's first cell
  // (e.g. `supabase.ts` in the `src/lib/` row).
  let rowBase = null;
  if (line.startsWith('|')) {
    const firstCell = codeSpans(line.split('|')[1] || '');
    if (firstCell.length === 1 && firstCell[0].endsWith('/')) {
      const dir = resolve(firstCell[0], prefixes);
      if (dir) rowBase = dir.replace(/\/?$/, '/');
    }
  }
  for (const raw of codeSpans(line)) {
    const token = raw.replace(/:\d+(-\d+)?$/, ''); // allow path:line references
    // Paths only: skip commands, code, globs, placeholders, URLs, env vars and package names.
    if (/[\s()*@=<>'"{}[\]]|:\/\//.test(token)) continue;
    if (!token.includes('/') && !fileLike.test(token)) continue;
    if (generated.has(token) || /^[./]+$/.test(token)) continue; // `../../` is an import example
    if (token.startsWith('~')) continue; // home-folder paths aren't in the repo
    checked++;
    const outside = token.startsWith('/') || token.split('/').includes('..');
    const bases = rowBase ? [rowBase, ...prefixes] : prefixes;
    if (outside || !resolve(token, bases)) missing.push(`${mapName}:${i + 1}  ${raw}`);
  }
});

// Counts written in the docs ("19 screens", "23 Zustand stores", "49 tables") must match the code.
const countDir = (dir, re) => fs.readdirSync(path.join(root, dir)).filter((f) => re.test(f)).length;
const actual = {
  screens: countDir('src/screens', /\.tsx$/),
  stores: countDir('src/stores', /^use\w+Store\.ts$/),
  tables: (fs.readFileSync(path.join(root, 'database-schema.md'), 'utf8').match(/^CREATE TABLE public\./gm) || []).length,
};
const countDocs = process.argv[2] ? [mapFile] : [mapFile, path.join(root, 'CLAUDE.md'), path.join(root, 'AGENTS.md')];
const wrongCounts = [];
for (const doc of countDocs) {
  if (!fs.existsSync(doc)) continue;
  fs.readFileSync(doc, 'utf8').split(/\r?\n/).forEach((line, i) => {
    for (const m of line.matchAll(/\b(\d+)\s+(?:route-level\s+|Zustand\s+)?(screens|stores|tables)\b/gi)) {
      const kind = m[2].toLowerCase();
      if (Number(m[1]) !== actual[kind]) {
        wrongCounts.push(`${path.basename(doc)}:${i + 1}  says "${m[0]}", but there are ${actual[kind]} ${kind}`);
      }
    }
  });
}

// Text saved in the wrong encoding (UTF-8 read as Windows-1252, e.g. by PowerShell 5.1) turns → into â†’.
const garbled = [];
for (const doc of countDocs) {
  if (!fs.existsSync(doc)) continue;
  fs.readFileSync(doc, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (/â€|â†|Ã[\u0080-¿]/.test(line)) garbled.push(`${path.basename(doc)}:${i + 1}`);
  });
}
if (garbled.length) {
  console.error(`${garbled.length} line(s) look garbled by a wrong text encoding (e.g. "â†’" instead of "→"):`);
  for (const g of garbled) console.error(`  ${g}`);
  console.error('Restore the characters (git show origin/main:<file>) and save the file as UTF-8.');
}

if (missing.length) {
  console.error(`${mapName} mentions ${missing.length} path(s) that don't exist:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error('Fix the map (or the path), then update its "Last verified" line.');
}
if (wrongCounts.length) {
  console.error(`${wrongCounts.length} count(s) in the docs don't match the code:`);
  for (const c of wrongCounts) console.error(`  ${c}`);
  console.error('Update the numbers (screens: src/screens/*.tsx, stores: src/stores/use*Store.ts, tables: database-schema.md).');
}
if (missing.length || wrongCounts.length || garbled.length) process.exit(1);
console.log(`${mapName}: all ${checked} path mentions exist; screen/store/table counts match (${actual.screens}/${actual.stores}/${actual.tables}).`);
