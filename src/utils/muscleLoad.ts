/**
 * Effective load: what a rep weighs for muscle heat, Training Balance and recovery, so bodyweight
 * work counts there (see BODYWEIGHT_FRACTIONS in constants/muscleMap.ts).
 *
 *   weighted                         kg (unchanged)
 *   bodyweight, weighted+bodyweight  bodyweight × fraction + kg (kg is the added weight)
 *   assisted, or kg below 0          max(0, bodyweight × fraction − |kg|) (kg is the assistance)
 *   duration                         kg (unchanged: their sets carry no load)
 *   weighted at 0 kg, not in the     bodyweight × fraction (a custom or unknown exercise logged
 *   catalog                          with no weight is bodyweight work: custom pull-ups, dips)
 *
 * Only for those maps. Workout and feed totals, leaderboards, PRs and strength score keep their
 * own kg × reps (and strengthScore's effectiveLoad) and don't use this file.
 */

import {
  BODYWEIGHT_FRACTIONS,
  BODYWEIGHT_RANGE_KG,
  DEFAULT_BODYWEIGHT_FRACTION,
  DEFAULT_BODYWEIGHT_KG,
} from '../constants/muscleMap';

/** Exercise types as the app stores them. Old rows also spell weighted+bodyweight 'weighted_bodyweight'. */
export type LoadType = 'weighted' | 'bodyweight' | 'weighted+bodyweight' | 'duration';

/** What an exercise needs for its load: its stored name, and its type if the row carries one. */
export interface LoadSource {
  name: string;
  exercise_type?: string | null;
}

/** Bodyweight to count, and the catalog's (or the user's own) exercise type by stored name. */
export interface MuscleLoad {
  bodyweightKg: number;
  catalogType: (name: string) => string | null | undefined;
  /** Whether the name is a catalog exercise (false for the user's own exercises and unknown names). */
  inCatalog: (name: string) => boolean;
}

/** A MuscleLoad from a catalog map (useWorkoutStore's catalogMap, aliases included). */
export function makeMuscleLoad(
  catalogMap: Readonly<Record<string, { exercise_type?: string | null; catalog_id?: string } | undefined>>,
  bodyweightKg: number,
): MuscleLoad {
  return {
    bodyweightKg,
    catalogType: (name) => catalogMap[name]?.exercise_type,
    inCatalog: (name) => !!catalogMap[name]?.catalog_id,
  };
}

/** Within BODYWEIGHT_RANGE_KG (the range onboarding allows); anything else is a typo. */
export function isPlausibleBodyweight(kg: number | null | undefined): kg is number {
  return kg != null && kg >= BODYWEIGHT_RANGE_KG.min && kg <= BODYWEIGHT_RANGE_KG.max;
}

/**
 * The signed-in user's bodyweight: latest weight entry, else starting weight, else the default.
 * A value outside BODYWEIGHT_RANGE_KG (a typo) counts as missing.
 */
export function ownBodyweightKg(
  latestEntryKg: number | null | undefined,
  startingWeightKg: number | null | undefined,
): number {
  if (isPlausibleBodyweight(latestEntryKg)) return latestEntryKg;
  if (isPlausibleBodyweight(startingWeightKg)) return startingWeightKg;
  return DEFAULT_BODYWEIGHT_KG;
}

export function toLoadType(type: string | null | undefined): LoadType | undefined {
  switch (type) {
    case 'weighted':
    case 'bodyweight':
    case 'weighted+bodyweight':
    case 'duration':
      return type;
    case 'weighted_bodyweight':
      return 'weighted+bodyweight';
    default:
      return undefined;
  }
}

/**
 * The type that decides an exercise's load. The workout row's own type wins, except 'weighted':
 * older builds and imports stored that for everything, so a pull-up logged as 'weighted' at 0 kg
 * takes the catalog's bodyweight type. A 'weighted' row never becomes 'duration'.
 */
export function resolveLoadType(rowType: string | null | undefined, catalogType: string | null | undefined): LoadType {
  const row = toLoadType(rowType);
  const catalog = toLoadType(catalogType);
  if (row && row !== 'weighted') return row;
  if (catalog === 'bodyweight' || catalog === 'weighted+bodyweight') return catalog;
  return row ?? catalog ?? 'weighted';
}

function normaliseName(name: string): string {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
}

const fractionCache = new Map<string, number>();

/** Fraction of bodyweight one rep lifts, from the exercise's name (BODYWEIGHT_FRACTIONS). */
function bodyweightFraction(name: string): number {
  let fraction = fractionCache.get(name);
  if (fraction === undefined) {
    const key = normaliseName(name);
    fraction = BODYWEIGHT_FRACTIONS.find((row) => row.match.test(key))?.fraction ?? DEFAULT_BODYWEIGHT_FRACTION;
    fractionCache.set(name, fraction);
  }
  return fraction;
}

/** Assisted machine or band exercises, whose kg is the assistance. */
function isAssisted(name: string): boolean {
  return /\bassist(ed|ance)?\b/.test(normaliseName(name));
}

/** How one exercise's sets turn kg into effective load. */
interface ExerciseLoad {
  type: LoadType;
  fraction: number;
  assisted: boolean;
  bodyweightKg: number;
  /** A 'weighted' exercise outside the catalog: its 0 kg sets count as bodyweight reps. */
  zeroKgIsBodyweight: boolean;
}

function exerciseLoad(ex: LoadSource, load: MuscleLoad): ExerciseLoad {
  const type = resolveLoadType(ex.exercise_type, load.catalogType(ex.name));
  return {
    type,
    fraction: bodyweightFraction(ex.name),
    assisted: isAssisted(ex.name),
    bodyweightKg: load.bodyweightKg,
    zeroKgIsBodyweight: type === 'weighted' && !load.inCatalog(ex.name),
  };
}

/** Effective load of one rep, in kg. */
function repLoad(kg: number, { type, fraction, assisted, bodyweightKg, zeroKgIsBodyweight }: ExerciseLoad): number {
  if (type === 'duration') return kg;
  if (assisted || kg < 0) return Math.max(0, bodyweightKg * fraction - Math.abs(kg));
  if (type === 'weighted') return kg === 0 && zeroKgIsBodyweight ? bodyweightKg * fraction : kg;
  return bodyweightKg * fraction + kg;
}

/** Effective volume of an exercise: Σ effective load × reps over its completed sets. */
export function effectiveVolume(
  ex: LoadSource & { sets: readonly { kg: number; reps: number; completed: boolean }[] },
  load: MuscleLoad,
): number {
  const perRep = exerciseLoad(ex, load);
  let volume = 0;
  for (const s of ex.sets) if (s.completed) volume += repLoad(s.kg, perRep) * s.reps;
  return volume;
}

/* ─── Feed cards ──────────────────────────────────────── */

type TotalSets = { kg: number; reps: number; completed: boolean }[];

/**
 * Sets for an exercise known only by its totals: all its reps at the average kg, so its effective
 * volume is bodyweight × fraction × reps + kg × reps, and a weighted one's is its total volume.
 */
function setsFromTotals(totalVolume: number, totalReps: number): TotalSets {
  if (totalReps > 0) return [{ kg: totalVolume / totalReps, reps: totalReps, completed: true }];
  // No rep count: the volume as one rep, as feed cards always drew it
  return totalVolume > 0 ? [{ kg: totalVolume, reps: 1, completed: true }] : [];
}

/**
 * Sets for a feed card's exercise (activity_feed.exercise_details carries totals, not sets). Posts
 * from builds before total_reps estimate reps as sets × the top set's reps; their bodyweight-only
 * exercises have no rep count at all, so they still add nothing.
 */
export function feedDetailSets(detail: {
  total_volume: number;
  total_reps?: number | null;
  sets_count: number;
  best_reps: number;
}): TotalSets {
  return setsFromTotals(detail.total_volume, detail.total_reps ?? detail.sets_count * detail.best_reps);
}

/** The sets a feed card will rebuild from these sets' totals (every set counts, ticked or not). */
export function feedPreviewSets(sets: readonly { kg: number; reps: number }[]): TotalSets {
  let volume = 0;
  let reps = 0;
  for (const s of sets) {
    volume += (s.kg || 0) * (s.reps || 0);
    reps += s.reps || 0;
  }
  return setsFromTotals(Math.round(volume), reps);
}
