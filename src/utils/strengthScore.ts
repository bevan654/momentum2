/**
 * Strength Score & Ranking Engine
 *
 * Drives per-exercise, per-muscle, and overall rank for every user.
 *
 * Pipeline:
 *   best working set → e1RM (Epley) → BW-normalised ratio
 *   → per-exercise score (ratio × weight_multiplier)
 *   → muscle score (top-6 diminishing slots)
 *   → overall score (Σ muscle × muscle_weight + diversity bonus)
 *   → rank threshold lookup
 */

import type { CatalogEntry } from '../stores/useWorkoutStore';
import { toSlug, MUSCLE_SLUGS } from './muscleVolume';

/* ═══════════════════════════════════════════════════════
   Workout-level rank result (per-workout scoring)
   ═══════════════════════════════════════════════════════ */

export interface WorkoutRankResult {
  exerciseScores: Record<string, ExerciseScoreEntry>;
  muscleScores: Partial<Record<MuscleGroup, MuscleScoreDetail>>;
  overallScore: number;
  rank: RankInfo;
  diversityBonus: number;
}

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

export type ExerciseType =
  | 'weighted'
  | 'bodyweight'
  | 'duration'
  | 'weighted+bodyweight';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'calves';

export type RankName =
  | 'Novice'
  | 'Apprentice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'Master'
  | 'Grandmaster'
  | 'Titan'
  | 'Mythic'
  | 'Legend';

export interface SetInput {
  kg: number;
  reps: number;
  completed?: boolean;
}

export interface StrengthScoreParams {
  kg: number;
  reps: number;
  bodyweight: number;
  exerciseType: ExerciseType;
  rankingWeight: number;
}

export interface ExerciseStrengthResult {
  score: number;
  e1rm: number;
  ratio: number;
  bestSet: { kg: number; reps: number };
}

/** Stored per-exercise result in the rank store. */
export interface ExerciseScoreEntry {
  name: string;
  score: number;
  e1rm: number;
  ratio: number;
  rank: RankInfo;
  bestSet: { kg: number; reps: number };
}

/** One exercise's contribution to a muscle group. */
export interface MuscleContribution {
  name: string;
  /** Normalised score (already multiplied by weight_multiplier). */
  score: number;
  /** Is this a primary or secondary contribution? */
  isPrimary: boolean;
  /** Is this the designated main lift for the muscle group? */
  isMainLift: boolean;
}

export interface MuscleScoreDetail {
  group: MuscleGroup;
  /** Weighted sum of top-6 slot scores. */
  score: number;
  rank: RankInfo;
  /** Score contributed by the main lift (0 if not performed). */
  mainLiftScore: number;
  /** Exercises that contributed, ordered by slot. */
  exercises: { name: string; slotScore: number; isMainLift: boolean }[];
}

export interface RankInfo {
  name: RankName;
  minScore: number;
  maxScore: number;
  /** 0 → 1 progress toward next rank (1.0 if Legend). */
  progress: number;
}

/** Best working set stored per exercise (cache-friendly). */
export interface BestSetEntry {
  kg: number;
  reps: number;
  exerciseType: ExerciseType;
  e1rm: number;
}

/** The 16 trainable body slugs used for per-muscle ranking. */
export const ALL_MUSCLE_SLUGS: string[] = Array.from(MUSCLE_SLUGS);

/** Per-slug score detail (same shape as MuscleScoreDetail but keyed by slug). */
export interface SlugScoreDetail {
  slug: string;
  /** Weighted sum of top-6 slot scores. */
  score: number;
  rank: RankInfo;
  /** Exercises that contributed, ordered by slot. */
  exercises: { name: string; slotScore: number }[];
}

export interface FullRankResult {
  exerciseScores: Record<string, ExerciseScoreEntry>;
  muscleScores: Partial<Record<MuscleGroup, MuscleScoreDetail>>;
  slugScores: Partial<Record<string, SlugScoreDetail>>;
  overallScore: number;
  rank: RankInfo;
  diversityBonus: number;
  isProvisional: boolean;
}

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const MAX_REP_ESTIMATE = 30;
const MIN_BODYWEIGHT = 30;

/** Secondary muscles contribute 50 % of the exercise score to their group. */
const SECONDARY_CONTRIBUTION = 0.5;

/** Top-6 diminishing slot weights. Slot 0 is reserved for the main lift. */
const SLOT_WEIGHTS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5] as const;

/** How much each muscle group contributes to the overall score. */
export const MUSCLE_GROUP_WEIGHTS: Record<MuscleGroup, number> = {
  chest: 1.0,
  back: 1.2,
  legs: 1.4,
  shoulders: 0.9,
  biceps: 0.7,
  triceps: 0.7,
  abs: 0.6,
  calves: 0.5,
};

export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'calves',
];

/* ─── Muscle name → broad group ─────────────────────── */

const MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  // Chest
  chest: 'chest',
  'upper chest': 'chest',
  pectorals: 'chest',

  // Back
  lats: 'back',
  'middle back': 'back',
  'upper back': 'back',
  'lower back': 'back',
  traps: 'back',
  trapezius: 'back',
  rhomboids: 'back',

  // Legs
  quadriceps: 'legs',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  adductors: 'legs',
  'hip flexors': 'legs',
  'hip abductors': 'legs',
  'tensor fasciae latae': 'legs',
  gracilis: 'legs',

  // Shoulders
  shoulders: 'shoulders',
  'rear delts': 'shoulders',
  deltoids: 'shoulders',

  // Biceps
  biceps: 'biceps',
  brachialis: 'biceps',

  // Triceps
  triceps: 'triceps',
  anconeus: 'triceps',

  // Abs
  abs: 'abs',
  obliques: 'abs',
  core: 'abs',

  // Calves
  calves: 'calves',
};

/**
 * Explicit mapping: main-lift exercise name → the ONE muscle group it is
 * the designated main lift for.  Prevents compound lifts from claiming
 * the main-lift slot in every muscle group they touch.
 */
const MAIN_LIFT_ASSIGNMENTS: Record<string, MuscleGroup> = {
  'bench press': 'chest',
  'pull ups': 'back',
  'dips': 'triceps',
  'dumbbell curl': 'biceps',
  'overhead press': 'shoulders',
  'dumbbell shoulder press': 'shoulders',
  'hip thrust': 'legs',
  'barbell back squat': 'legs',
  'romanian deadlift': 'legs',
  'standing calf raise': 'calves',
  'cable crunch': 'abs',
};

/* ─── Rank thresholds ────────────────────────────────── */

interface RankThreshold {
  name: RankName;
  min: number;
  max: number;
}

const OVERALL_THRESHOLDS: RankThreshold[] = [
  { name: 'Novice', min: 0, max: 3.5 },
  { name: 'Apprentice', min: 3.5, max: 7 },
  { name: 'Intermediate', min: 7, max: 14 },
  { name: 'Advanced', min: 14, max: 24.5 },
  { name: 'Elite', min: 24.5, max: 35 },
  { name: 'Master', min: 35, max: 45.5 },
  { name: 'Grandmaster', min: 45.5, max: 59.5 },
  { name: 'Titan', min: 59.5, max: 77 },
  { name: 'Mythic', min: 77, max: 98 },
  { name: 'Legend', min: 98, max: Infinity },
];

const MUSCLE_THRESHOLDS: RankThreshold[] = [
  { name: 'Novice', min: 0, max: 0.5 },
  { name: 'Apprentice', min: 0.5, max: 1.0 },
  { name: 'Intermediate', min: 1.0, max: 2.0 },
  { name: 'Advanced', min: 2.0, max: 3.5 },
  { name: 'Elite', min: 3.5, max: 5.0 },
  { name: 'Master', min: 5.0, max: 6.5 },
  { name: 'Grandmaster', min: 6.5, max: 8.5 },
  { name: 'Titan', min: 8.5, max: 11 },
  { name: 'Mythic', min: 11, max: 14 },
  { name: 'Legend', min: 14, max: Infinity },
];

const EXERCISE_THRESHOLDS: RankThreshold[] = [
  { name: 'Novice', min: 0, max: 0.2 },
  { name: 'Apprentice', min: 0.2, max: 0.4 },
  { name: 'Intermediate', min: 0.4, max: 0.7 },
  { name: 'Advanced', min: 0.7, max: 1.0 },
  { name: 'Elite', min: 1.0, max: 1.3 },
  { name: 'Master', min: 1.3, max: 1.6 },
  { name: 'Grandmaster', min: 1.6, max: 2.0 },
  { name: 'Titan', min: 2.0, max: 2.5 },
  { name: 'Mythic', min: 2.5, max: 3.0 },
  { name: 'Legend', min: 3.0, max: Infinity },
];

const PROVISIONAL_WORKOUT_MIN = 10;

/* ═══════════════════════════════════════════════════════
   Core helpers
   ═══════════════════════════════════════════════════════ */

/** Epley formula: e1RM = w × (1 + r / 30).  Returns w when reps ≤ 1. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const r = Math.min(reps, MAX_REP_ESTIMATE);
  return r <= 1 ? weight : weight * (1 + r / 30);
}

/** Resolve the effective load for a single set. */
export function effectiveLoad(
  kg: number,
  bodyweight: number,
  exerciseType: ExerciseType,
): number {
  switch (exerciseType) {
    case 'weighted':
      return kg;
    case 'bodyweight':
      return bodyweight;
    case 'weighted+bodyweight':
      return bodyweight + kg;
    case 'duration':
    default:
      return 0;
  }
}

/** Per-set strength score = (e1RM / bw) × rankingWeight. */
export function calculateSetStrengthScore(params: StrengthScoreParams): number {
  const { kg, reps, bodyweight, exerciseType, rankingWeight } = params;
  const bw = Math.max(bodyweight, MIN_BODYWEIGHT);
  const load = effectiveLoad(kg, bw, exerciseType);
  if (load <= 0 || reps <= 0) return 0;
  return (estimateOneRepMax(load, reps) / bw) * rankingWeight;
}

/** Best-set score for an exercise across all its sets. */
export function calculateExerciseStrengthScore(
  sets: SetInput[],
  bodyweight: number,
  exerciseType: ExerciseType,
  rankingWeight: number,
): ExerciseStrengthResult {
  const bw = Math.max(bodyweight, MIN_BODYWEIGHT);
  let bestE1rm = 0;
  let bestSet = { kg: 0, reps: 0 };

  for (const s of sets) {
    if (s.completed === false || s.reps <= 0) continue;
    const load = effectiveLoad(s.kg, bw, exerciseType);
    if (load <= 0) continue;
    const e1rm = estimateOneRepMax(load, s.reps);
    if (e1rm > bestE1rm) {
      bestE1rm = e1rm;
      bestSet = { kg: s.kg, reps: s.reps };
    }
  }

  const ratio = bestE1rm / bw;
  return {
    score: ratio * rankingWeight,
    e1rm: Math.round(bestE1rm * 10) / 10,
    ratio,
    bestSet,
  };
}

/* ═══════════════════════════════════════════════════════
   Muscle-group helpers
   ═══════════════════════════════════════════════════════ */

/** Map a raw catalog muscle string to one of the 8 broad groups. */
export function mapToMuscleGroup(muscle: string): MuscleGroup | null {
  return MUSCLE_TO_GROUP[muscle.toLowerCase().trim()] ?? null;
}

/** Return the unique broad groups for an exercise's primary & secondary muscles. */
export function getExerciseMuscleGroups(
  primaryMuscles: string[],
  secondaryMuscles: string[],
): { primary: MuscleGroup[]; secondary: MuscleGroup[] } {
  const pSet = new Set<MuscleGroup>();
  const sSet = new Set<MuscleGroup>();

  for (const m of primaryMuscles) {
    const g = mapToMuscleGroup(m);
    if (g) pSet.add(g);
  }
  for (const m of secondaryMuscles) {
    const g = mapToMuscleGroup(m);
    // Only secondary if not already a primary target
    if (g && !pSet.has(g)) sSet.add(g);
  }

  return { primary: Array.from(pSet), secondary: Array.from(sSet) };
}

/* ═══════════════════════════════════════════════════════
   Rank lookup
   ═══════════════════════════════════════════════════════ */

function lookupRank(score: number, thresholds: RankThreshold[]): RankInfo {
  for (const t of thresholds) {
    if (score < t.max) {
      const range = t.max === Infinity ? 1 : t.max - t.min;
      const progress = t.max === Infinity ? 1 : (score - t.min) / range;
      return { name: t.name, minScore: t.min, maxScore: t.max, progress };
    }
  }
  const last = thresholds[thresholds.length - 1];
  return { name: last.name, minScore: last.min, maxScore: last.max, progress: 1 };
}

export function getOverallRank(score: number): RankInfo {
  return lookupRank(score, OVERALL_THRESHOLDS);
}

export function getMuscleRank(score: number): RankInfo {
  return lookupRank(score, MUSCLE_THRESHOLDS);
}

export function getExerciseRank(score: number): RankInfo {
  return lookupRank(score, EXERCISE_THRESHOLDS);
}

/* ═══════════════════════════════════════════════════════
   Diversity bonus
   ═══════════════════════════════════════════════════════ */

/** diversity_bonus = min(unique_exercises × 0.02, 0.1) */
export function calculateDiversityBonus(uniqueExerciseCount: number): number {
  return Math.min(uniqueExerciseCount * 0.02, 0.1);
}

/* ═══════════════════════════════════════════════════════
   Muscle group score
   ═══════════════════════════════════════════════════════ */

/**
 * Top-6 diminishing formula for a single muscle group.
 *
 * Slot 0 (×1.0): the highest-scoring designated main lift, or 0.
 * Slots 1-5 (×0.9 → ×0.5): top 5 remaining exercises.
 */
export function calculateMuscleGroupScore(
  contributions: MuscleContribution[],
): MuscleScoreDetail & { group: MuscleGroup } {
  // Separate main lifts from others
  const mainLifts = contributions
    .filter((c) => c.isMainLift)
    .sort((a, b) => b.score - a.score);

  const nonMainLifts = contributions
    .filter((c) => !c.isMainLift)
    .sort((a, b) => b.score - a.score);

  // Build slot list
  const slots: { name: string; rawScore: number; isMainLift: boolean }[] = [];

  // Slot 0: best main lift
  if (mainLifts.length > 0) {
    slots.push({
      name: mainLifts[0].name,
      rawScore: mainLifts[0].score,
      isMainLift: true,
    });
    // Remaining main lifts compete with non-main lifts for slots 1-5
    for (let i = 1; i < mainLifts.length; i++) {
      nonMainLifts.push({
        name: mainLifts[i].name,
        score: mainLifts[i].score,
        isPrimary: mainLifts[i].isPrimary,
        isMainLift: false, // treated as regular for slot purposes
      });
    }
    nonMainLifts.sort((a, b) => b.score - a.score);
  } else {
    // No main lift performed → slot 0 is empty (score 0)
    slots.push({ name: '', rawScore: 0, isMainLift: false });
  }

  // Slots 1-5: top 5 from remaining
  for (let i = 0; i < 5 && i < nonMainLifts.length; i++) {
    slots.push({
      name: nonMainLifts[i].name,
      rawScore: nonMainLifts[i].score,
      isMainLift: false,
    });
  }

  // Apply diminishing weights and sum
  let totalScore = 0;
  const exercises: MuscleScoreDetail['exercises'] = [];

  for (let i = 0; i < slots.length && i < SLOT_WEIGHTS.length; i++) {
    const slotScore = slots[i].rawScore * SLOT_WEIGHTS[i];
    totalScore += slotScore;
    if (slots[i].name) {
      exercises.push({
        name: slots[i].name,
        slotScore: Math.round(slotScore * 1000) / 1000,
        isMainLift: slots[i].isMainLift,
      });
    }
  }

  // Dummy group — caller will set the real one
  return {
    group: 'chest',
    score: Math.round(totalScore * 1000) / 1000,
    rank: getMuscleRank(totalScore),
    mainLiftScore: slots[0]?.rawScore ?? 0,
    exercises,
  };
}

/* ═══════════════════════════════════════════════════════
   Full rank computation
   ═══════════════════════════════════════════════════════ */

/**
 * Pure function — takes pre-fetched data and returns the complete rank result.
 * No side effects, no store access, no network calls.
 */
export function computeFullRank(params: {
  /** Best working set per exercise name. */
  bestSets: Record<string, BestSetEntry>;
  bodyweight: number;
  catalog: Record<string, CatalogEntry>;
  totalWorkouts: number;
}): FullRankResult {
  const { bestSets, bodyweight: rawBw, catalog, totalWorkouts } = params;
  const bw = Math.max(rawBw, MIN_BODYWEIGHT);

  /* ── 1. Per-exercise scores ──────────────────────────── */

  const exerciseScores: Record<string, ExerciseScoreEntry> = {};
  // muscleGroup → list of contributions
  const groupContributions: Record<string, MuscleContribution[]> = {};
  // slug → list of contributions (for per-muscle ranking)
  const slugContributions: Record<string, MuscleContribution[]> = {};

  for (const [name, best] of Object.entries(bestSets)) {
    const cat = catalog[name];
    const exerciseType = (best.exerciseType || cat?.exercise_type || 'weighted') as ExerciseType;
    const rankingWeight = cat?.ranking_weight ?? 0.3;
    const isMainLift = cat?.is_main_lift ?? false;

    // Compute e1RM from the stored best set
    const load = effectiveLoad(best.kg, bw, exerciseType);
    if (load <= 0 || best.reps <= 0) continue;

    const e1rm = estimateOneRepMax(load, best.reps);
    const ratio = e1rm / bw;
    const score = ratio * rankingWeight;

    exerciseScores[name] = {
      name,
      score,
      e1rm: Math.round(e1rm * 10) / 10,
      ratio,
      rank: getExerciseRank(score),
      bestSet: { kg: best.kg, reps: best.reps },
    };

    // Determine muscle group contributions
    const primaryMuscles = cat?.primary_muscles ?? [];
    const secondaryMuscles = cat?.secondary_muscles ?? [];
    const { primary, secondary } = getExerciseMuscleGroups(
      primaryMuscles,
      secondaryMuscles,
    );

    // Which group is this exercise a main lift for?
    const mainLiftGroup = isMainLift
      ? MAIN_LIFT_ASSIGNMENTS[name] ?? null
      : null;

    for (const g of primary) {
      if (!groupContributions[g]) groupContributions[g] = [];
      groupContributions[g].push({
        name,
        score,
        isPrimary: true,
        isMainLift: mainLiftGroup === g,
      });
    }

    for (const g of secondary) {
      if (!groupContributions[g]) groupContributions[g] = [];
      groupContributions[g].push({
        name,
        score: score * SECONDARY_CONTRIBUTION,
        isPrimary: false,
        isMainLift: false, // secondary can't be main lift for that group
      });
    }

    // Slug-level contributions (deduped: one entry per exercise per slug)
    const slugsSeen = new Set<string>();
    for (const m of primaryMuscles) {
      const slug = toSlug(m);
      if (slug && MUSCLE_SLUGS.has(slug) && !slugsSeen.has(slug)) {
        slugsSeen.add(slug);
        if (!slugContributions[slug]) slugContributions[slug] = [];
        slugContributions[slug].push({
          name,
          score,
          isPrimary: true,
          isMainLift: false, // no main-lift concept at slug level
        });
      }
    }
    for (const m of secondaryMuscles) {
      const slug = toSlug(m);
      if (slug && MUSCLE_SLUGS.has(slug) && !slugsSeen.has(slug)) {
        slugsSeen.add(slug);
        if (!slugContributions[slug]) slugContributions[slug] = [];
        slugContributions[slug].push({
          name,
          score: score * SECONDARY_CONTRIBUTION,
          isPrimary: false,
          isMainLift: false,
        });
      }
    }
  }

  /* ── 2. Per-muscle scores ────────────────────────────── */

  const muscleScores: Partial<Record<MuscleGroup, MuscleScoreDetail>> = {};

  for (const g of ALL_MUSCLE_GROUPS) {
    const contribs = groupContributions[g];
    if (!contribs || contribs.length === 0) continue;

    const detail = calculateMuscleGroupScore(contribs);
    detail.group = g;
    muscleScores[g] = detail;
  }

  /* ── 2b. Per-slug scores ───────────────────────────────── */

  const slugScores: Partial<Record<string, SlugScoreDetail>> = {};

  for (const slug of ALL_MUSCLE_SLUGS) {
    const contribs = slugContributions[slug];
    if (!contribs || contribs.length === 0) continue;

    const detail = calculateMuscleGroupScore(contribs);
    slugScores[slug] = {
      slug,
      score: detail.score,
      rank: detail.rank,
      exercises: detail.exercises.map((e) => ({
        name: e.name,
        slotScore: e.slotScore,
      })),
    };
  }

  /* ── 3. Overall score ────────────────────────────────── */

  let rawOverall = 0;
  for (const g of ALL_MUSCLE_GROUPS) {
    const ms = muscleScores[g];
    if (ms) {
      rawOverall += ms.score * MUSCLE_GROUP_WEIGHTS[g];
    }
  }

  const diversityBonus = calculateDiversityBonus(Object.keys(bestSets).length);
  const overallScore =
    Math.round((rawOverall + diversityBonus) * 1000) / 1000;

  return {
    exerciseScores,
    muscleScores,
    slugScores,
    overallScore,
    rank: getOverallRank(overallScore),
    diversityBonus,
    isProvisional: totalWorkouts < PROVISIONAL_WORKOUT_MIN,
  };
}

/* ═══════════════════════════════════════════════════════
   Per-workout rank computation
   ═══════════════════════════════════════════════════════ */

/**
 * Score a single workout's exercises (not all-time bests).
 * Pure function — no store access, no side effects.
 */
export function computeWorkoutRank(params: {
  exercises: {
    name: string;
    exercise_type: string;
    sets: { kg: number; reps: number; completed?: boolean }[];
  }[];
  bodyweight: number;
  catalog: Record<string, CatalogEntry>;
}): WorkoutRankResult {
  const { exercises, bodyweight: rawBw, catalog } = params;
  const bw = Math.max(rawBw, MIN_BODYWEIGHT);

  // Build best-set-per-exercise from this workout only
  const bestSets: Record<string, BestSetEntry> = {};

  for (const ex of exercises) {
    const cat = catalog[ex.name];
    const exType = (ex.exercise_type || cat?.exercise_type || 'weighted') as ExerciseType;

    for (const s of ex.sets) {
      if (s.completed === false) continue;
      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      if (reps <= 0) continue;

      const load = effectiveLoad(kg, bw, exType);
      if (load <= 0) continue;

      const e1rm = estimateOneRepMax(load, reps);
      const prev = bestSets[ex.name];
      if (!prev || e1rm > prev.e1rm) {
        bestSets[ex.name] = { kg, reps, exerciseType: exType, e1rm };
      }
    }
  }

  // Reuse full-rank pipeline with workout-local bests
  const result = computeFullRank({
    bestSets,
    bodyweight: bw,
    catalog,
    totalWorkouts: 1, // irrelevant for scoring, avoids provisional flag
  });

  return {
    exerciseScores: result.exerciseScores,
    muscleScores: result.muscleScores,
    overallScore: result.overallScore,
    rank: result.rank,
    diversityBonus: result.diversityBonus,
  };
}
