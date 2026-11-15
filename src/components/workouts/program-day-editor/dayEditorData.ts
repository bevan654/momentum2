import { aliasesByCanonical } from '../../../utils/exerciseCatalog';
import { getMuscleColor } from '../../../constants/muscles';

/* ─── Types ──────────────────────────────────────────── */

export interface LocalSet {
  goal_reps: number;
  goal_weight: number;
}

export interface LocalExercise {
  /** Local-only React key (never saved): keeps a card's typed text and swipe state when exercises are moved. */
  uid: string;
  name: string;
  sets: LocalSet[];
  rest_seconds: number;
  category: string | null;
  exercise_type: string;
  prevSets: { kg: number; reps: number }[];
}

export interface CatalogEntry {
  name: string;
  category: string;
  exercise_type: string;
  primary_muscles: string[];
  /** Lowercased other names (old catalog names) that also find this exercise. */
  aliases: string[];
}

export const MUSCLE_FILTERS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
];

/* ─── Helpers ────────────────────────────────────────── */

export function muscleColor(muscle: string): string {
  return getMuscleColor(muscle);
}

/* ─── Module-level sorted catalog cache ──────────────── */

let _sortedCache: CatalogEntry[] | null = null;

let _sortedRef: any = null;

let _sortedAliasRef: any = null;

export function getSortedCatalog(
  catalogMap: Record<string, any>,
  aliasMap: Record<string, any>,
): CatalogEntry[] {
  if (catalogMap === _sortedRef && aliasMap === _sortedAliasRef && _sortedCache) return _sortedCache;
  _sortedRef = catalogMap;
  _sortedAliasRef = aliasMap;
  const aliases = aliasesByCanonical(aliasMap);
  _sortedCache = Object.entries(catalogMap)
    .filter(([name, entry]) => !aliasMap[name] && !entry.is_hidden)
    .map(([name, entry]: [string, any]) => ({
      name,
      category: entry.category || '',
      exercise_type: entry.exercise_type || 'weighted',
      primary_muscles: Array.isArray(entry.primary_muscles) ? entry.primary_muscles.map((m: string) => m.toLowerCase()) : [],
      aliases: (aliases[name] || []).map((a) => a.toLowerCase()),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _sortedCache;
}
