#!/usr/bin/env node
/**
 * Checks that every file or folder path mentioned in CODEBASE_MAP.md still exists.
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

if (missing.length) {
  console.error(`${mapName} mentions ${missing.length} path(s) that don't exist:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error('Fix the map (or the path), then update its "Last verified" line.');
  process.exit(1);
}
console.log(`${mapName}: all ${checked} path mentions exist.`);
