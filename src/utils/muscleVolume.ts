/**
 * Shared muscle volume calculation used by all body map renderers.
 *
 * Algorithm:
 * 1. For each exercise, sum completed-set volume (kg × reps)
 * 2. Primary muscles receive full volume, secondary muscles receive 50%
 * 3. Volume accumulates across exercises — a secondary muscle hit by 4
 *    exercises can outrank a primary muscle hit by 1 exercise
 * 4. Intensity is absolute: each muscle has a per-session target volume
 *    and heat level reflects how close it got to that target, so small
 *    muscles (biceps) can max out independently of heavy compounds
 */

import type { ExtendedBodyPart } from '../components/BodyHighlighter';
import type { ExerciseWithSets, CatalogEntry } from '../stores/useWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import {
  toCanonical,
  CANONICAL_MUSCLES,
  CANONICAL_LABELS,
  CANONICAL_TO_SVG_SLUG,
  TARGET_VOLUME,
  CATEGORY_MUSCLES,
  type CanonicalMuscle,
} from '../constants/muscles';

/* ─── SVG Slug types (tied to BodyHighlighter SVG assets) ──── */

export type Slug =
  | 'abs' | 'adductors' | 'ankles' | 'biceps' | 'calves' | 'chest'
  | 'deltoids' | 'feet' | 'forearm' | 'gluteal' | 'hamstring' | 'hands'
  | 'hair' | 'head' | 'knees' | 'lower-back' | 'neck' | 'obliques'
  | 'quadriceps' | 'rear-deltoids' | 'tibialis' | 'trapezius' | 'triceps' | 'upper-back';

export const ALL_SLUGS: Slug[] = [
  'abs', 'adductors', 'ankles', 'biceps', 'calves', 'chest', 'deltoids',
  'feet', 'forearm', 'gluteal', 'hamstring', 'hands', 'hair', 'head',
  'knees', 'lower-back', 'neck', 'obliques', 'quadriceps', 'rear-deltoids',
  'tibialis', 'trapezius', 'triceps', 'upper-back',
];

/** SVG slugs that represent actual muscles (subset of ALL_SLUGS). */
export const MUSCLE_SLUGS = new Set<string>(
  Object.values(CANONICAL_TO_SVG_SLUG),
);

/** Display labels keyed by SVG slug. Derived from canonical labels. */
export const SLUG_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = {};
  for (const canonical of CANONICAL_MUSCLES) {
    const svgSlug = CANONICAL_TO_SVG_SLUG[canonical];
    // First canonical to claim a slug wins the label (e.g. 'shoulders' → 'deltoids' gets 'Shoulders')
    if (!labels[svgSlug]) {
      labels[svgSlug] = CANONICAL_LABELS[canonical];
    }
  }
  return labels;
})();

/* ─── Slug normalisation ──────────────────────────────── */

/**
 * Normalize any raw muscle string to an SVG-compatible slug.
 * Uses the canonical alias table, then maps canonical → SVG slug.
 * Returns null for non-muscle strings (e.g. 'head', 'feet').
 */
export function toSlug(raw: string): Slug | null {
  const canonical = toCanonical(raw);
  if (!canonical) return null;
  return CANONICAL_TO_SVG_SLUG[canonical] as Slug;
}

/* ─── Category fallback (derived from muscles.ts) ──────── */

const CATEGORY_TO_SLUGS: Record<string, Slug[]> = (() => {
  const result: Record<string, Slug[]> = {};
  for (const [category, muscles] of Object.entries(CATEGORY_MUSCLES)) {
    const slugSet = new Set<string>();
    for (const m of muscles) {
      slugSet.add(CANONICAL_TO_SVG_SLUG[m]);
    }
    result[category] = Array.from(slugSet) as Slug[];
  }
  return result;
})();

/* ─── Intensity constants ─────────────────────────────── */

const SECONDARY_WEIGHT = 0.25;

// Palette indices: 0 = bg, 1 = inactive, 2–6 = heat gradient, 7 = selected
export const INACTIVE = 1;
export const HEAT_MIN = 2;
export const HEAT_MAX = 6;
export const HEAT_LEVELS = HEAT_MAX - HEAT_MIN + 1; // 5

/**
 * Per-SVG-slug session target volume (kg × reps).
 * Derived from canonical TARGET_VOLUME. When multiple canonicals share
 * an SVG slug (e.g. lats + upper-back → 'upper-back'), volumes add up
 * and we use the max target.
 */
const SLUG_TARGET_VOLUME: Record<string, number> = (() => {
  const targets: Record<string, number> = {};
  for (const canonical of CANONICAL_MUSCLES) {
    const svgSlug = CANONICAL_TO_SVG_SLUG[canonical];
    const vol = TARGET_VOLUME[canonical];
    targets[svgSlug] = Math.max(targets[svgSlug] ?? 0, vol);
  }
  return targets;
})();

const DEFAULT_TARGET_VOLUME = 800;

/* ─── Core calculation ────────────────────────────────── */

export interface MuscleVolumeResult {
  bodyData: ExtendedBodyPart[];
  volumeMap: Record<string, number>;
  maxVolume: number;
}

/**
 * Calculate muscle volume from exercises and produce body-highlighter data.
 *
 * Secondary muscles accumulate across exercises at 50% weight, so triceps
 * as secondary on bench + OHP + dips can legitimately outrank a primary
 * muscle trained in only one exercise.
 */
export function calculateMuscleVolume(
  exercises: ExerciseWithSets[],
): MuscleVolumeResult {
  const primaryVol: Record<string, number> = {};
  const secondaryVol: Record<string, number> = {};

  const catalogMap = useWorkoutStore.getState().catalogMap;

  for (const ex of exercises) {
    const vol = ex.sets
      .filter((s) => s.completed)
      .reduce((sum, s) => sum + s.kg * s.reps, 0);
    if (vol === 0) continue;

    // Use exercise muscle data, falling back to catalog lookup by name
    let primary = ex.primary_muscles;
    let secondary = ex.secondary_muscles;
    if ((!primary || primary.length === 0) && (!secondary || secondary.length === 0)) {
      const cat: CatalogEntry | undefined = catalogMap[ex.name];
      if (cat) {
        primary = cat.primary_muscles;
        secondary = cat.secondary_muscles;
      }
    }

    const hasMuscleData =
      (primary && primary.length > 0) ||
      (secondary && secondary.length > 0);

    if (hasMuscleData) {
      for (const raw of primary || []) {
        const slug = toSlug(raw);
        if (slug) primaryVol[slug] = (primaryVol[slug] || 0) + vol;
      }
      for (const raw of secondary || []) {
        const slug = toSlug(raw);
        if (slug) secondaryVol[slug] = (secondaryVol[slug] || 0) + vol;
      }
    } else if (ex.category) {
      const slugs = CATEGORY_TO_SLUGS[ex.category];
      if (slugs) {
        for (const slug of slugs) {
          primaryVol[slug] = (primaryVol[slug] || 0) + vol;
        }
      } else {
        const slug = toSlug(ex.category);
        if (slug) primaryVol[slug] = (primaryVol[slug] || 0) + vol;
      }
    }
  }

  // Merge into a single volMap for the detail chip (primary + weighted secondary)
  const volMap: Record<string, number> = {};
  const allSlugs = new Set([...Object.keys(primaryVol), ...Object.keys(secondaryVol)]);
  for (const slug of allSlugs) {
    volMap[slug] = (primaryVol[slug] || 0) + (secondaryVol[slug] || 0) * SECONDARY_WEIGHT;
  }

  const mv = Math.max(...Object.values(volMap), 1);

  // Max intensity for secondary-only muscles (no primary volume): heat level 3
  const SECONDARY_ONLY_MAX = HEAT_MIN + 1; // intensity 3 = low-mid

  const bodyData: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => {
    const pVol = primaryVol[slug] || 0;
    const sVol = secondaryVol[slug] || 0;
    if (pVol <= 0 && sVol <= 0) return { slug, intensity: INACTIVE };

    const target = SLUG_TARGET_VOLUME[slug] ?? DEFAULT_TARGET_VOLUME;

    if (pVol > 0) {
      // Has direct training — scale normally against target
      const total = pVol + sVol * SECONDARY_WEIGHT;
      const ratio = Math.min(total / target, 1);
      const intensity = HEAT_MIN + Math.round(ratio * (HEAT_LEVELS - 1));
      return { slug, intensity };
    }

    // Secondary only — cap at low-mid
    const ratio = Math.min((sVol * SECONDARY_WEIGHT) / target, 1);
    const intensity = HEAT_MIN + Math.round(ratio * (SECONDARY_ONLY_MAX - HEAT_MIN));
    return { slug, intensity };
  });

  return { bodyData, volumeMap: volMap, maxVolume: mv };
}
