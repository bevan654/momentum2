import { SCREEN_HEIGHT } from '../../../theme/responsive';
import {
  CANONICAL_TO_BODY_GROUP,
  CANONICAL_TO_SVG_SLUG,
  CANONICAL_MUSCLES,
} from '../../../constants/muscles';
import { toLocalDateString } from '../../../utils/localDate';
import { toSlug } from '../../../utils/muscleVolume';

export function toDateKey(iso: string): string {
  return toLocalDateString(new Date(iso));
}

/* ─── Muscle group constants (derived from muscles.ts) ── */

const SLUG_GROUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const canonical of CANONICAL_MUSCLES) {
    const svgSlug = CANONICAL_TO_SVG_SLUG[canonical];
    const group = CANONICAL_TO_BODY_GROUP[canonical];
    if (!map[svgSlug]) map[svgSlug] = group;
  }
  return map;
})();

export const PART_GROUPS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['shoulders'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Core: ['abdominals', 'obliques', 'abs'],
  Quads: ['quads'],
  Hamstrings: ['hamstrings'],
  Glutes: ['glutes'],
  Calves: ['calves'],
  Arms: ['shoulders', 'biceps', 'triceps'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
};

export function getLastLabel(lastDate: Date | null): string {
  if (!lastDate) return 'Never';
  const elapsed = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
  if (elapsed < 24) return `${Math.round(elapsed)}h ago`;
  const days = Math.floor(elapsed / 24);
  const hours = Math.round(elapsed % 24);
  if (days < 7) return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
  return `${days}d ago`;
}

/* ─── History sheet (swipe-to-dismiss) ─────────────── */

export const DISMISS_THRESHOLD = 120;
export const VELOCITY_THRESHOLD = 800;

export const TIME_FILTERS = ['All', '7d', '30d', '90d'] as const;
export type TimeFilter = typeof TIME_FILTERS[number];
export const TIME_LABELS: Record<TimeFilter, string> = { All: 'All', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
export const TIME_MS: Record<TimeFilter, number> = { All: 0, '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };

export const BODY_FILTERS = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves'] as const;
export const PLAN_FILTERS = ['All', 'Program', 'Quick'] as const;
export type PlanFilter = typeof PLAN_FILTERS[number];

export const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

/* ─── Matching workouts to body parts (primary muscles only) ── */

/** Body groups for some PART_GROUPS labels, e.g. ['Arms'] → shoulders, biceps, triceps. */
export function groupsForParts(parts: string[]): Set<string> {
  const groups = new Set<string>();
  for (const part of parts) for (const g of PART_GROUPS[part] ?? []) groups.add(g);
  return groups;
}

/** Body groups an exercise's primary muscles hit (from the catalog when the row has none). Secondary muscles don't count. */
export function primaryGroupsOf(
  ex: { name: string; primary_muscles?: string[] | null },
  catalogMap: Record<string, any>,
): string[] {
  let primary = ex.primary_muscles || [];
  if (primary.length === 0) {
    const cat = catalogMap[ex.name];
    if (cat) primary = cat.primary_muscles || [];
  }
  const groups: string[] = [];
  for (const raw of primary) {
    const slug = toSlug(raw);
    const group = slug ? SLUG_GROUP[slug] : undefined;
    if (group) groups.push(group);
  }
  return groups;
}

/** Whether any exercise in the workout hits one of `groups` with a primary muscle. */
export function workoutHitsGroups(
  w: { exercises: { name: string; primary_muscles?: string[] | null }[] },
  groups: Set<string>,
  catalogMap: Record<string, any>,
): boolean {
  return w.exercises.some((ex) => primaryGroupsOf(ex, catalogMap).some((g) => groups.has(g)));
}
