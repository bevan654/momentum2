/**
 * Exercise search scoring for the picker: exact / prefix / substring matches on the name, then
 * per-word matching with gym shorthand (db, rdl, ohp, ...), muscle names and small typos.
 */

const TOKEN_ALIASES: Record<string, string[]> = {
  db: ['dumbbell'],
  bb: ['barbell'],
  ez: ['ez-bar', 'ez bar'],
  kb: ['kettlebell'],
  sm: ['smith', 'smith machine'],
  bp: ['bench press'],
  ohp: ['overhead press'],
  rdl: ['romanian deadlift'],
  dl: ['deadlift'],
  sq: ['squat'],
  lp: ['leg press'],
  bench: ['bench press'],
  squat: ['squats', 'back squat', 'front squat', 'goblet squat'],
  deadlift: ['deadlifts', 'dead lift'],
  press: ['bench press', 'overhead press', 'shoulder press', 'leg press'],
  row: ['rows', 'barbell row', 'dumbbell row', 'cable row', 'seated row', 'bent over row'],
  curl: ['curls', 'bicep curl', 'hammer curl', 'preacher curl'],
  fly: ['flys', 'flies', 'flyes', 'chest fly', 'cable fly', 'pec fly'],
  raise: ['raises', 'lateral raise', 'front raise', 'calf raise'],
  extension: ['extensions', 'tricep extension', 'leg extension'],
  pulldown: ['lat pulldown', 'lat pull down', 'pull down'],
  pullup: ['pull up', 'pull-up', 'pullups', 'pull ups', 'chin up', 'chinup'],
  pushup: ['push up', 'push-up', 'pushups', 'push ups'],
  dip: ['dips', 'chest dip', 'tricep dip'],
  shrug: ['shrugs', 'barbell shrug', 'dumbbell shrug'],
  crunch: ['crunches', 'ab crunch'],
  plank: ['planks'],
  lunge: ['lunges', 'walking lunge', 'reverse lunge'],
  incl: ['incline'],
  decl: ['decline'],
  rev: ['reverse'],
  chest: ['bench press', 'fly', 'pec', 'push up'],
  back: ['row', 'pulldown', 'pull up', 'lat'],
  shoulders: ['overhead press', 'lateral raise', 'front raise', 'delt', 'shoulder'],
  biceps: ['bicep curl', 'hammer curl', 'preacher curl', 'curl'],
  triceps: ['tricep extension', 'pushdown', 'dip', 'skull crusher', 'tricep'],
  quads: ['squat', 'leg press', 'leg extension', 'lunge'],
  hamstrings: ['romanian deadlift', 'leg curl', 'hamstring'],
  glutes: ['hip thrust', 'glute bridge', 'squat', 'lunge'],
  calves: ['calf raise', 'calf'],
  abs: ['crunch', 'plank', 'sit up', 'ab', 'core'],
  traps: ['shrug', 'trap'],
  forearms: ['wrist curl', 'forearm'],
  lats: ['lat pulldown', 'pull up', 'lat'],
};

let _expandMap: Record<string, Set<string>> | null = null;
function getExpandMap(): Record<string, Set<string>> {
  if (_expandMap) return _expandMap;
  _expandMap = {};
  for (const [key, vals] of Object.entries(TOKEN_ALIASES)) {
    if (!_expandMap[key]) _expandMap[key] = new Set();
    for (const v of vals) {
      _expandMap[key].add(v);
      if (!_expandMap[v]) _expandMap[v] = new Set();
      _expandMap[v].add(key);
    }
  }
  return _expandMap;
}

function expandToken(token: string): string[] {
  const map = getExpandMap();
  const out = [token];
  const mapped = map[token];
  if (mapped) {
    for (const m of mapped) out.push(m);
  }
  for (const key of Object.keys(map)) {
    if (key.length >= 3 && key.startsWith(token) && key !== token) {
      out.push(key);
      for (const m of map[key]) out.push(m);
    }
  }
  return out;
}

function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return Infinity;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function wordScore(qw: string, nw: string): number {
  if (nw === qw) return 10;
  if (nw.startsWith(qw)) return 8;
  if (nw.includes(qw) && qw.length >= 2) return 5;
  const maxTypo = qw.length <= 4 ? 1 : 2;
  const dist = levenshtein(qw, nw.slice(0, qw.length + maxTypo), maxTypo);
  if (dist <= maxTypo) return 6 - dist * 2;
  return 0;
}

export interface ExerciseData {
  name: string;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}

function scoreExercise(ex: ExerciseData, query: string): number {
  const lower = ex.name.toLowerCase();

  if (lower === query) return 200;
  if (lower.startsWith(query)) return 150;
  if (lower.includes(query)) return 120;

  const queryWords = query.split(/[\s\-]+/).filter(Boolean);
  const nameWords = lower.split(/[\s\-]+/);
  const muscleWords = [
    ...(ex.primary_muscles || []).flatMap((m) => m.toLowerCase().split(/[\s\-]+/)),
    ...(ex.secondary_muscles || []).flatMap((m) => m.toLowerCase().split(/[\s\-]+/)),
  ];
  const catWords = ex.category ? ex.category.toLowerCase().split(/[\s\-]+/) : [];
  const allTargetWords = [...nameWords, ...muscleWords, ...catWords];

  let totalScore = 0;
  let matchedQueryWords = 0;

  for (const qw of queryWords) {
    const expanded = expandToken(qw);
    let bestWordScore = 0;

    for (const eq of expanded) {
      const eqTokens = eq.split(/[\s\-]+/);
      for (const et of eqTokens) {
        for (const nw of allTargetWords) {
          const s = wordScore(et, nw);
          const isName = nameWords.includes(nw);
          const adjusted = isName ? s : Math.ceil(s * 0.7);
          if (adjusted > bestWordScore) bestWordScore = adjusted;
        }
      }
    }

    if (bestWordScore > 0) matchedQueryWords++;
    totalScore += bestWordScore;
  }

  if (matchedQueryWords < queryWords.length) return 0;

  const precisionBonus = (matchedQueryWords / queryWords.length) * 10;
  return totalScore + precisionBonus;
}

/** Aliases (old or imported names) also find an exercise, ranked just below a match on its own name. */
const ALIAS_PENALTY = 5;

export function scoreWithAliases(ex: ExerciseData, aliases: readonly string[], query: string): number {
  let best = scoreExercise(ex, query);
  for (const alias of aliases) {
    const s = scoreExercise({ ...ex, name: alias }, query) - ALIAS_PENALTY;
    if (s > best) best = s;
  }
  return best;
}
