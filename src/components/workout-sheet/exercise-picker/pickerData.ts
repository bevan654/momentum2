import { useEffect, useState } from 'react';
import { aliasesByCanonical } from '../../../utils/exerciseCatalog';
import { toCanonical, CANONICAL_TO_UI_CATEGORY, UI_CATEGORY_COLORS } from '../../../constants/muscles';

/** Lifts pinned at the top of the picker (the leaderboard lifts). Matched by catalog id, which survives
 *  catalog renames, with the current and previous names as a fallback. */
export const LEADERBOARD_LIFTS: { catalogId: string; names: string[] }[] = [
  { catalogId: '9d6c70f6-9761-4b1b-bdfb-44e6042bbbdf', names: ['barbell bench press', 'bench press'] },
  { catalogId: '6d6f46ec-ea92-4f38-9baa-d42975f1a706', names: ['barbell back squat'] },
  { catalogId: '4f9a3d91-42e1-4b46-a907-1c68db1fb201', names: ['barbell deadlift', 'conventional deadlift'] },
];

export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Debounce hook ────────────────────────────────────── */

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

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

export const MAIN_MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'];

export const GROUP_CHIP_COLORS: Record<string, string> = UI_CATEGORY_COLORS;

export function getMainGroup(muscle: string): string | null {
  const canonical = toCanonical(muscle);
  return canonical ? CANONICAL_TO_UI_CATEGORY[canonical] : null;
}
