import { aliasesByCanonical } from '../../../utils/exerciseCatalog';
import { toCanonical, CANONICAL_TO_UI_CATEGORY } from '../../../constants/muscles';

/** Lifts pinned at the top of the picker (the leaderboard lifts). Matched by catalog id, which survives
 *  catalog renames, with the current and previous names as a fallback. */
const LEADERBOARD_LIFTS: { catalogId: string; names: string[] }[] = [
  { catalogId: '9d6c70f6-9761-4b1b-bdfb-44e6042bbbdf', names: ['barbell bench press', 'bench press'] },
  { catalogId: '6d6f46ec-ea92-4f38-9baa-d42975f1a706', names: ['barbell back squat'] },
  { catalogId: '4f9a3d91-42e1-4b46-a907-1c68db1fb201', names: ['barbell deadlift', 'conventional deadlift'] },
];

/* ═══════════════════════════════════════════════════════════
   Module-level cache for expensive computations
   ─────────────────────────────────────────────────────────
   The ExercisePicker unmounts on close and remounts on open.
   Without caching, every open re-sorts the entire 10K+
   exercise catalog. These caches persist across mount cycles
   and only recompute when the underlying data changes.
   ═══════════════════════════════════════════════════════════ */

export interface CatalogEntry {
  name: string;
  category: string | null;
  exercise_type: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  done: boolean;
  catalog_id?: string;
  /** Other names that find this exercise in search (old catalog names, imported names). */
  aliases?: string[];
}

let _sortedCache: CatalogEntry[] | null = null;
let _sortedCatalogRef: any = null;
let _sortedAliasRef: any = null;
let _sortedPrevRef: any = null;

export function getCachedSorted(
  catalogMap: Record<string, any>,
  aliasMap: Record<string, any>,
  prevMap: Record<string, any>,
): CatalogEntry[] {
  if (
    catalogMap === _sortedCatalogRef &&
    aliasMap === _sortedAliasRef &&
    prevMap === _sortedPrevRef &&
    _sortedCache
  ) {
    return _sortedCache;
  }
  _sortedCatalogRef = catalogMap;
  _sortedAliasRef = aliasMap;
  _sortedPrevRef = prevMap;
  const aliases = aliasesByCanonical(aliasMap);
  // Alias names and hidden rows stay in catalogMap so history still resolves, but aren't offered.
  _sortedCache = Object.entries(catalogMap)
    .filter(([name, entry]) => !aliasMap[name] && !entry.is_hidden)
    .map(([name, entry]: [string, any]) => ({
      name,
      category: entry.category,
      exercise_type: entry.exercise_type,
      primary_muscles: entry.primary_muscles || [],
      secondary_muscles: entry.secondary_muscles || [],
      done: !!prevMap[name],
      catalog_id: entry.catalog_id,
      aliases: aliases[name] || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _sortedCache;
}

export interface DefaultSections {
  visible: boolean;
  leaderboard: CatalogEntry[];
  recent: CatalogEntry[];
  regular: CatalogEntry[];
}

/** Splits the list for the default view (no search, filter or Deep Search): the leaderboard lifts,
 *  then up to 5 recently logged exercises, then everything else. Otherwise `regular` is `exercises`. */
export function buildDefaultSections(
  visible: boolean,
  baseSorted: CatalogEntry[],
  exercises: CatalogEntry[],
  prevMap: Record<string, any>,
  aliasMap: Record<string, string>,
): DefaultSections {
  if (!visible) {
    return {
      visible: false,
      leaderboard: [] as CatalogEntry[],
      recent: [] as CatalogEntry[],
      regular: exercises,
    };
  }

  const byLowerName = new Map(baseSorted.map((entry) => [entry.name.toLowerCase(), entry]));
  const byCatalogId = new Map(
    baseSorted.filter((entry) => entry.catalog_id).map((entry) => [entry.catalog_id, entry]),
  );
  const leaderboard = LEADERBOARD_LIFTS
    .map((lift) => byCatalogId.get(lift.catalogId)
      ?? lift.names.map((name) => byLowerName.get(name)).find((entry) => entry !== undefined))
    .filter((entry): entry is CatalogEntry => entry !== undefined);
  const leaderboardNames = new Set<string>(leaderboard.map((entry) => entry.name.toLowerCase()));

  const recent: CatalogEntry[] = [];
  const recentNames = new Set<string>();
  for (const name of Object.keys(prevMap)) {
    // History logged under an old name counts towards the exercise's current name.
    const lowerName = (aliasMap[name] ?? name).toLowerCase();
    if (leaderboardNames.has(lowerName) || recentNames.has(lowerName)) continue;
    const entry = byLowerName.get(lowerName);
    if (!entry) continue;
    recent.push(entry);
    recentNames.add(lowerName);
    if (recent.length === 5) break;
  }

  const regular = exercises.filter((entry) => {
    const lowerName = entry.name.toLowerCase();
    return !leaderboardNames.has(lowerName) && !recentNames.has(lowerName);
  });

  return { visible: true, leaderboard, recent, regular };
}

export const MAIN_MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'];

export function getMainGroup(muscle: string): string | null {
  const canonical = toCanonical(muscle);
  return canonical ? CANONICAL_TO_UI_CATEGORY[canonical] : null;
}
