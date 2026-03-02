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

/* ─── Slug types ──────────────────────────────────────── */

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

export const MUSCLE_SLUGS = new Set<string>([
  'abs', 'adductors', 'biceps', 'calves', 'chest', 'deltoids',
  'forearm', 'gluteal', 'hamstring', 'lower-back', 'obliques',
  'quadriceps', 'rear-deltoids', 'tibialis', 'trapezius', 'triceps', 'upper-back',
]);

export const SLUG_LABELS: Record<string, string> = {
  abs: 'Abs',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  deltoids: 'Deltoids',
  forearm: 'Forearms',
  gluteal: 'Glutes',
  hamstring: 'Hamstrings',
  'lower-back': 'Lower Back',
  obliques: 'Obliques',
  quadriceps: 'Quads',
  'rear-deltoids': 'Rear Delts',
  tibialis: 'Tibialis',
  trapezius: 'Traps',
  triceps: 'Triceps',
  'upper-back': 'Upper Back',
};

/* ─── Slug normalisation ──────────────────────────────── */

const SLUG_ALIASES: Record<string, Slug> = {
  abs: 'abs', abdominals: 'abs', abdominal: 'abs', core: 'abs',
  adductors: 'adductors', adductor: 'adductors', gracilis: 'adductors',
  abductors: 'gluteal', abductor: 'gluteal', 'hip abductors': 'gluteal',
  biceps: 'biceps', bicep: 'biceps', brachialis: 'biceps',
  calves: 'calves', calf: 'calves',
  chest: 'chest', pectorals: 'chest', pecs: 'chest', 'upper chest': 'chest',
  deltoids: 'deltoids', deltoid: 'deltoids', shoulders: 'deltoids', shoulder: 'deltoids',
  'rear-deltoids': 'rear-deltoids', 'rear delts': 'rear-deltoids', 'rear deltoids': 'rear-deltoids', 'posterior deltoid': 'rear-deltoids',
  forearm: 'forearm', forearms: 'forearm',
  gluteal: 'gluteal', glutes: 'gluteal', gluteus: 'gluteal', glute: 'gluteal',
  hamstring: 'hamstring', hamstrings: 'hamstring',
  'lower-back': 'lower-back', 'lower back': 'lower-back', 'erector spinae': 'lower-back',
  'middle back': 'upper-back',
  obliques: 'obliques', oblique: 'obliques',
  quadriceps: 'quadriceps', quads: 'quadriceps', quad: 'quadriceps', 'hip flexors': 'quadriceps',
  tibialis: 'tibialis',
  trapezius: 'trapezius', traps: 'trapezius', trap: 'trapezius',
  triceps: 'triceps', tricep: 'triceps', anconeus: 'triceps',
  'upper-back': 'upper-back', 'upper back': 'upper-back', lats: 'upper-back', latissimus: 'upper-back', 'latissimus dorsi': 'upper-back', rhomboids: 'upper-back',
  neck: 'neck',
};

export function toSlug(raw: string): Slug | null {
  const key = raw.trim().toLowerCase().replace(/_/g, ' ');
  return SLUG_ALIASES[key] ?? (MUSCLE_SLUGS.has(key) ? (key as Slug) : null);
}

/* ─── Category fallback ───────────────────────────────── */

const CATEGORY_TO_SLUGS: Record<string, Slug[]> = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids', 'rear-deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors', 'tibialis'],
  Core: ['abs', 'obliques'],
  Cardio: [],
  Custom: [],
};

/* ─── Intensity constants ─────────────────────────────── */

const SECONDARY_WEIGHT = 0.25;

// Palette indices: 0 = bg, 1 = inactive, 2–6 = heat gradient, 7 = selected
export const INACTIVE = 1;
export const HEAT_MIN = 2;
export const HEAT_MAX = 6;
export const HEAT_LEVELS = HEAT_MAX - HEAT_MIN + 1; // 5

/**
 * Per-muscle session target volume (kg × reps).
 * When a muscle reaches its target it maxes out the heat scale.
 * Accounts for the fact that isolation muscles use lighter loads.
 */
const SLUG_TARGET_VOLUME: Record<string, number> = {
  chest: 2000,
  'upper-back': 2000,
  'lower-back': 1200,
  trapezius: 600,
  quadriceps: 2500,
  hamstring: 2000,
  gluteal: 2500,
  adductors: 1000,
  tibialis: 600,
  deltoids: 1200,
  'rear-deltoids': 800,
  biceps: 600,
  forearm: 400,
  triceps: 800,
  abs: 600,
  obliques: 600,
  calves: 800,
};

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
