import { create } from 'zustand';
import type { WorkoutWithDetails, CatalogEntry } from './useWorkoutStore';
import { toSlug } from '../utils/muscleVolume';
import { effectiveVolume, makeMuscleLoad } from '../utils/muscleLoad';
import type { MuscleGroup } from '../components/body/muscleGroups';
import {
  CANONICAL_TO_SVG_SLUG,
  CATEGORY_MUSCLES,
  RECOVERY_HOURS,
  SVG_SLUG_TO_BODY_GROUP,
} from '../constants/muscles';

/* ─── Derived from muscles.ts ─────────────────────────── */

const SLUG_TO_GROUP = SVG_SLUG_TO_BODY_GROUP as Record<string, MuscleGroup>;

const ALL_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'quads', 'hamstrings', 'glutes', 'calves',
];

const CATEGORY_TO_SLUGS: Record<string, string[]> = (() => {
  const result: Record<string, string[]> = {};
  for (const [category, muscles] of Object.entries(CATEGORY_MUSCLES)) {
    const slugSet = new Set<string>();
    for (const m of muscles) slugSet.add(CANONICAL_TO_SVG_SLUG[m]);
    result[category] = Array.from(slugSet);
  }
  return result;
})();

const GROUP_RECOVERY_HOURS = RECOVERY_HOURS as Record<MuscleGroup, number>;

/* ─── Types ───────────────────────────────────────────── */

export interface MuscleRecovery {
  /** 0–100 per body group: hours since it was last trained as a primary muscle, over its recovery time. */
  groups: Record<MuscleGroup, { recoveryPercent: number }>;
}

/* ─── Pure computation ────────────────────────────────── */

/** The window that counts: today and the 6 days before it, local midnight to the end of today. */
function recoveryWindow(now: Date): { start: number; end: number } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

/** Body groups an exercise trains as a primary muscle (secondary muscles don't count). */
function primaryGroupsOf(
  ex: WorkoutWithDetails['exercises'][number],
  catalogMap: Record<string, CatalogEntry>,
): Set<MuscleGroup> {
  let primary = ex.primary_muscles;
  let secondary = ex.secondary_muscles;
  if ((!primary || primary.length === 0) && (!secondary || secondary.length === 0)) {
    const cat = catalogMap[ex.name];
    if (cat) {
      primary = cat.primary_muscles;
      secondary = cat.secondary_muscles;
    }
  }
  const groups = new Set<MuscleGroup>();
  const hasMuscleData = (primary && primary.length > 0) || (secondary && secondary.length > 0);
  if (hasMuscleData) {
    for (const raw of primary || []) {
      const slug = toSlug(raw);
      if (slug && SLUG_TO_GROUP[slug]) groups.add(SLUG_TO_GROUP[slug]);
    }
  } else if (ex.category) {
    // No muscle data at all: fall back to the exercise's category
    for (const s of CATEGORY_TO_SLUGS[ex.category] ?? []) {
      const group = SLUG_TO_GROUP[s];
      if (group) groups.add(group);
    }
  }
  return groups;
}

/**
 * When each body group was last trained as a primary muscle (epoch ms, the workout's created_at)
 * within the recovery window; a group missing from the result is fully recovered. Also feeds the
 * home screen Recovery widget, which works the percentages out over time itself.
 */
export function lastTrainedByGroup(
  workouts: WorkoutWithDetails[],
  catalogMap: Record<string, CatalogEntry>,
  bodyweightKg: number,
  now: Date,
): Partial<Record<MuscleGroup, number>> {
  // Effective volume, so bodyweight sets mark a muscle trained like loaded ones
  const load = makeMuscleLoad(catalogMap, bodyweightKg);
  const { start, end } = recoveryWindow(now);

  const lastTrained: Partial<Record<MuscleGroup, number>> = {};
  for (const w of workouts) {
    const t = new Date(w.created_at).getTime();
    if (!(t >= start && t <= end)) continue;
    for (const ex of w.exercises) {
      if (!(effectiveVolume(ex, load) > 0)) continue;
      for (const g of primaryGroupsOf(ex, catalogMap)) {
        const prev = lastTrained[g];
        if (prev === undefined || t > prev) lastTrained[g] = t;
      }
    }
  }
  return lastTrained;
}

function computeRecovery(
  workouts: WorkoutWithDetails[],
  catalogMap: Record<string, CatalogEntry>,
  bodyweightKg: number,
): MuscleRecovery {
  const now = new Date();
  const lastTrained = lastTrainedByGroup(workouts, catalogMap, bodyweightKg, now);

  const groups = {} as MuscleRecovery['groups'];
  for (const g of ALL_GROUPS) {
    const recoveryHours = GROUP_RECOVERY_HOURS[g];
    const last = lastTrained[g];
    const elapsed = last != null ? (now.getTime() - last) / (1000 * 60 * 60) : recoveryHours;
    const percent = Math.min(100, recoveryHours > 0 ? (elapsed / recoveryHours) * 100 : 100);
    groups[g] = { recoveryPercent: Math.round(percent) };
  }
  return { groups };
}

/* ─── Zustand store ───────────────────────────────────── */

interface MuscleAnalysisState {
  analysis: MuscleRecovery | null;
  recompute: (workouts: WorkoutWithDetails[], catalogMap: Record<string, CatalogEntry>, bodyweightKg: number) => void;
}

export const useMuscleAnalysisStore = create<MuscleAnalysisState>((set) => ({
  analysis: null,

  recompute: (workouts, catalogMap, bodyweightKg) => {
    set({ analysis: computeRecovery(workouts, catalogMap, bodyweightKg) });
  },
}));
