/**
 * Muscle volume for the deep body map (momentum-muscle-map), plus the legacy slug vocabulary
 * strength scoring and the weekly analysis still use.
 *
 * Model: each exercise works a set of map regions with weights 0..1, from exercise_region_targets
 * when the exercise has rows there, otherwise from its legacy muscle names (primary 1, secondary
 * 0.5). A completed set adds kg × reps × weight to every region the exercise works. Screens then
 * normalise those totals: per workout against FULL_HEAT_VOLUME, over several days against the
 * largest region. A region no exercise worked as a primary muscle is capped at
 * SECONDARY_ONLY_MAX_HEAT, below the glow. Values go to the map linear; the map's own colour curve
 * lifts low values.
 */

import { PARTS } from 'momentum-muscle-map/core';
import type { Level, MuscleValues } from 'momentum-muscle-map/core';
import type { CatalogEntry } from '../stores/useWorkoutStore';
import {
  toCanonical,
  CANONICAL_MUSCLES,
  CANONICAL_LABELS,
  CANONICAL_TO_BODY_GROUP,
  CANONICAL_TO_SVG_SLUG,
  CATEGORY_MUSCLES,
  RECOVERY_HOURS,
  type CanonicalMuscle,
} from '../constants/muscles';
import {
  FULL_HEAT_VOLUME,
  LEGACY_NAME_REGIONS,
  NAMED_ONLY_REGIONS,
  PRIMARY_WEIGHT,
  PRIMARY_WORK_WEIGHT,
  RECOVERY_FATIGUED_BELOW,
  RECOVERY_READY_FROM,
  RECOVERY_WINDOW_DAYS,
  REGION_OWNER,
  SECONDARY_ONLY_MAX_HEAT,
  SECONDARY_WEIGHT,
} from '../constants/muscleMap';

/* ─── Legacy slugs (old SVG body graph names) ─────────── */

export type Slug =
  | 'abs' | 'adductors' | 'ankles' | 'biceps' | 'calves' | 'chest'
  | 'deltoids' | 'feet' | 'forearm' | 'gluteal' | 'hamstring' | 'hands'
  | 'hair' | 'head' | 'knees' | 'lower-back' | 'neck' | 'obliques'
  | 'quadriceps' | 'rear-deltoids' | 'tibialis' | 'trapezius' | 'triceps' | 'upper-back';

/** Legacy slugs that represent actual muscles. */
export const MUSCLE_SLUGS = new Set<string>(
  Object.values(CANONICAL_TO_SVG_SLUG),
);

/** Display labels keyed by legacy slug. Derived from canonical labels. */
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

/**
 * Normalize any raw muscle string to a legacy slug.
 * Returns null for non-muscle strings (e.g. 'head', 'feet').
 */
export function toSlug(raw: string): Slug | null {
  const canonical = toCanonical(raw);
  if (!canonical) return null;
  return CANONICAL_TO_SVG_SLUG[canonical] as Slug;
}

/* ─── Region weights per exercise ─────────────────────── */

/** Map region (unsided part slug) → how hard an exercise works it, 0..1. */
export type RegionWeights = Readonly<Record<string, number>>;
/** Map region → an amount summed over exercises (weighted volume, or summed weights). */
export type RegionAmounts = Readonly<Record<string, number>>;

/** Amounts per region, and which regions got primary-level work. */
export interface RegionWork {
  amounts: RegionAmounts;
  /** Regions some exercise works with a weight ≥ PRIMARY_WORK_WEIGHT. The rest are secondary only. */
  primary: ReadonlySet<string>;
}

/** What an exercise row needs for its regions: its name, and legacy muscles if it carries them. */
export interface MuscleSource {
  name: string;
  category?: string | null;
  primary_muscles?: readonly string[];
  secondary_muscles?: readonly string[];
}

export interface VolumeExercise extends MuscleSource {
  sets: readonly { kg: number; reps: number; completed: boolean }[];
}

export type RegionWeightLookup = (exercise: MuscleSource) => RegionWeights;

/** Regions a canonical muscle name lights. */
const CANONICAL_REGIONS: Record<CanonicalMuscle, string[]> = (() => {
  const out = {} as Record<CanonicalMuscle, string[]>;
  for (const c of CANONICAL_MUSCLES) out[c] = [];
  for (const [region, owner] of Object.entries(REGION_OWNER)) {
    if (!NAMED_ONLY_REGIONS.has(region)) out[owner].push(region);
  }
  return out;
})();

const CATEGORY_CANONICALS = CATEGORY_MUSCLES as Record<string, readonly CanonicalMuscle[] | undefined>;

function legacyNameRegions(raw: string): readonly string[] {
  const named = LEGACY_NAME_REGIONS[raw.trim().toLowerCase().replace(/_/g, ' ')];
  if (named) return named;
  const canonical = toCanonical(raw);
  return canonical ? CANONICAL_REGIONS[canonical] : [];
}

/**
 * Region weights from legacy muscle names: primary 1, secondary 0.5. Without a usable primary
 * muscle, the category's muscles count as primary.
 */
export function legacyRegionWeights(
  primary: readonly string[] | undefined,
  secondary: readonly string[] | undefined,
  category: string | null | undefined,
): RegionWeights {
  const weights: Record<string, number> = {};
  const credit = (regions: readonly string[], weight: number) => {
    for (const r of regions) if (!((weights[r] ?? 0) >= weight)) weights[r] = weight;
  };
  let hasPrimary = false;
  for (const m of primary ?? []) {
    const regions = legacyNameRegions(m);
    if (regions.length > 0) hasPrimary = true;
    credit(regions, PRIMARY_WEIGHT);
  }
  if (!hasPrimary && category) {
    for (const c of CATEGORY_CANONICALS[category] ?? []) credit(CANONICAL_REGIONS[c], PRIMARY_WEIGHT);
  }
  for (const m of secondary ?? []) credit(legacyNameRegions(m), SECONDARY_WEIGHT);
  return weights;
}

/**
 * Looks up an exercise's region weights: its exercise_region_targets rows (by the catalog id its
 * name resolves to) when there are any, else its own legacy muscles, else its catalog entry's.
 */
export function makeRegionWeightLookup(
  catalogMap: Record<string, CatalogEntry>,
  targets: Record<string, RegionWeights>,
): RegionWeightLookup {
  // Same inputs → same object, so maps fed from it don't redraw.
  const legacy = new Map<string, RegionWeights>();
  return (ex) => {
    const entry = catalogMap[ex.name];
    const rows = entry?.catalog_id ? targets[entry.catalog_id] : undefined;
    if (rows) return rows;
    const own = !!(ex.primary_muscles?.length || ex.secondary_muscles?.length);
    const primary = own ? ex.primary_muscles : entry?.primary_muscles;
    const secondary = own ? ex.secondary_muscles : entry?.secondary_muscles;
    const category = ex.category ?? entry?.category;
    const key = `${category ?? ''}|${primary?.join(',') ?? ''}|${secondary?.join(',') ?? ''}`;
    let weights = legacy.get(key);
    if (!weights) {
      weights = legacyRegionWeights(primary, secondary, category);
      legacy.set(key, weights);
    }
    return weights;
  };
}

/* ─── Totals and normalisation ────────────────────────── */

function completedVolume(ex: VolumeExercise): number {
  let volume = 0;
  for (const s of ex.sets) if (s.completed) volume += s.kg * s.reps;
  return volume;
}

/** Adds `amount × weight` to every region an exercise works, and notes its primary regions. */
function addWork(amounts: Record<string, number>, primary: Set<string>, weights: RegionWeights, amount: number) {
  for (const region in weights) {
    const weight = weights[region]!;
    amounts[region] = (amounts[region] ?? 0) + amount * weight;
    if (weight >= PRIMARY_WORK_WEIGHT) primary.add(region);
  }
}

/** Weighted volume per region: completed kg × reps × the exercise's weight for the region. */
export function regionVolume(exercises: readonly VolumeExercise[], lookup: RegionWeightLookup): RegionWork {
  const amounts: Record<string, number> = {};
  const primary = new Set<string>();
  for (const ex of exercises) {
    const volume = completedVolume(ex);
    if (volume > 0) addWork(amounts, primary, lookup(ex), volume);
  }
  return { amounts, primary };
}

/** Summed region weights of a list of exercises, with no volume (a plan's emphasis). */
export function regionEmphasis(exercises: readonly MuscleSource[], lookup: RegionWeightLookup): RegionWork {
  const amounts: Record<string, number> = {};
  const primary = new Set<string>();
  for (const ex of exercises) addWork(amounts, primary, lookup(ex), 1);
  return { amounts, primary };
}

/** A region's map value, capped below the glow unless it got primary-level work. */
function capSecondaryOnly(value: number, region: string, primary: ReadonlySet<string>): number {
  return primary.has(region) ? value : Math.min(value, SECONDARY_ONLY_MAX_HEAT);
}

const FULL_HEAT_BY_REGION: Record<string, number> = Object.fromEntries(
  Object.entries(REGION_OWNER).map(([region, owner]) => [region, FULL_HEAT_VOLUME[owner]]),
);

/** Heat for one workout: each region's weighted volume against its full-heat volume, 0..1. */
export function heatValues({ amounts, primary }: RegionWork): MuscleValues {
  const values: Record<string, number> = {};
  for (const region in amounts) {
    const full = FULL_HEAT_BY_REGION[region];
    if (full) values[region] = capSecondaryOnly(Math.min(1, amounts[region]! / full), region, primary);
  }
  return values;
}

/** Each region against the largest one, 0..1. */
export function relativeValues({ amounts, primary }: RegionWork): MuscleValues {
  let max = 0;
  for (const region in amounts) if (amounts[region]! > max) max = amounts[region]!;
  const values: Record<string, number> = {};
  if (max > 0) for (const region in amounts) values[region] = capSecondaryOnly(amounts[region]! / max, region, primary);
  return values;
}

/** Whether any part of a region (at a level) got primary-level work. */
export function hasPrimaryWork({ primary }: RegionWork, level: Level, key: string): boolean {
  return partsOf(level, key).some((part) => primary.has(part));
}

/* ─── Recovery ────────────────────────────────────────── */

export interface RegionRecovery {
  /** 0..100: hours since the region was last trained as a primary muscle, against its group's recovery time. */
  percent: number;
  lastTrainedAt: string;
}

export type RecoveryStatus = 'fatigued' | 'recovering' | 'ready';

/**
 * Recovery of every region trained as a primary muscle (weight ≥ PRIMARY_WORK_WEIGHT) in the
 * last RECOVERY_WINDOW_DAYS days, today included. Regions not in the result are recovered.
 */
export function regionRecovery(
  workouts: readonly { created_at: string; exercises: readonly VolumeExercise[] }[],
  lookup: RegionWeightLookup,
  now: number = Date.now(),
): Record<string, RegionRecovery> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (RECOVERY_WINDOW_DAYS - 1));
  const startMs = start.getTime();

  const last: Record<string, number> = {};
  for (const w of workouts) {
    const t = new Date(w.created_at).getTime();
    if (!(t >= startMs)) continue;
    for (const ex of w.exercises) {
      if (!(completedVolume(ex) > 0)) continue;
      const weights = lookup(ex);
      for (const region in weights) {
        if (weights[region]! >= PRIMARY_WORK_WEIGHT && !((last[region] ?? 0) >= t)) last[region] = t;
      }
    }
  }

  const out: Record<string, RegionRecovery> = {};
  for (const region in last) {
    const owner = REGION_OWNER[region];
    if (!owner) continue;
    const hours = RECOVERY_HOURS[CANONICAL_TO_BODY_GROUP[owner]];
    const elapsed = (now - last[region]!) / 3_600_000;
    out[region] = {
      percent: Math.round(Math.max(0, Math.min(100, (elapsed / hours) * 100))),
      lastTrainedAt: new Date(last[region]!).toISOString(),
    };
  }
  return out;
}

export function recoveryStatus(percent: number): RecoveryStatus {
  if (percent < RECOVERY_FATIGUED_BELOW) return 'fatigued';
  if (percent < RECOVERY_READY_FROM) return 'recovering';
  return 'ready';
}

/** Fatigue as map values: fatigued 1, recovering 0.5, ready 0. `include` limits the regions shown. */
export function recoveryValues(
  recovery: Record<string, RegionRecovery>,
  include?: (region: string) => boolean,
): MuscleValues {
  const values: Record<string, number> = {};
  for (const region in recovery) {
    if (include && !include(region)) continue;
    const status = recoveryStatus(recovery[region]!.percent);
    if (status !== 'ready') values[region] = status === 'fatigued' ? 1 : 0.5;
  }
  return values;
}

/** The legacy body-graph group a region recovers with (chest, back, biceps, ...). */
export function regionBodyGroup(region: string): string | undefined {
  const owner = REGION_OWNER[region];
  return owner ? CANONICAL_TO_BODY_GROUP[owner] : undefined;
}

/* ─── Regions at other levels ─────────────────────────── */

const PARTS_BY_UNIT: Record<'muscles' | 'groups', Record<string, string[]>> = (() => {
  const muscles: Record<string, string[]> = {};
  const groups: Record<string, string[]> = {};
  for (const [part, [muscle, group]] of Object.entries(PARTS)) {
    (muscles[muscle] ??= []).push(part);
    (groups[group] ??= []).push(part);
  }
  return { muscles, groups };
})();

/** Part slugs inside a region (unsided key) at a level, e.g. 'deltoid' → its three heads. */
export function partsOf(level: Level, key: string): readonly string[] {
  if (level === 'parts') return [key];
  return PARTS_BY_UNIT[level][key] ?? [];
}
