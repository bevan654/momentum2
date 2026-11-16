import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from './useWorkoutStore';
import { useWeightStore } from './useWeightStore';
import { useAuthStore } from './useAuthStore';
import {
  estimateOneRepMax,
  effectiveLoad,
  computeFullRank,
  getOverallRank,
  type ExerciseType,
  type ExerciseScoreEntry,
  type MuscleScoreDetail,
  type MuscleGroup,
  type BestSetEntry,
  type RankInfo,
  type SlugScoreDetail,
} from '../utils/strengthScore';
import { isPlausibleBodyweight, resolveLoadType, toLoadType, type LoadType } from '../utils/muscleLoad';

/* ─── Types ──────────────────────────────────────────── */

interface RankState {
  /** Best working set per exercise (all-time). */
  bestSets: Record<string, BestSetEntry>;
  /** Per-exercise scores & ranks. */
  exerciseScores: Record<string, ExerciseScoreEntry>;
  /** Per-muscle-group scores & ranks. */
  muscleScores: Partial<Record<MuscleGroup, MuscleScoreDetail>>;
  /** Per-slug (individual muscle) scores & ranks. */
  slugScores: Partial<Record<string, SlugScoreDetail>>;
  /** Weighted sum of muscle scores + diversity bonus. */
  overallScore: number;
  /** Current rank info (name, progress to next). */
  rank: RankInfo;
  /** diversity_bonus applied. */
  diversityBonus: number;
  /** Total completed workouts. */
  totalWorkouts: number;
  /** < 10 workouts → provisional. */
  isProvisional: boolean;

  loading: boolean;

  /** Full computation — fetches all workout data and computes from scratch. */
  computeRank: (userId: string) => Promise<void>;
  /**
   * Incremental update after a workout is finished.
   * Merges new best sets and recomputes scores without a network round-trip.
   */
  updateFromWorkout: (
    exercises: {
      name: string;
      exercise_type: string;
      sets: { kg: number; reps: number; completed: boolean; set_type: string | null }[];
    }[],
    userId?: string,
  ) => void;
  /** Load cached rank from Supabase (instant, single row). */
  loadRank: (userId: string) => Promise<void>;
  /** Upsert current rank state to Supabase. Fire-and-forget. */
  _persistRank: (userId: string) => void;
}

/* ─── Helpers ────────────────────────────────────────── */

/** Lookup an exercise name in the catalog, falling back to case-insensitive match.
 *  Uses a shared ci-key cache so the lowercase map is built once per session,
 *  not on every computeRank/updateFromWorkout call. */
let _ciCache: Record<string, any> | null = null;
let _ciSourceRef: Record<string, any> | null = null;

function getCiCatalog(catalogMap: Record<string, any>): Record<string, any> {
  // Rebuild only if the source reference changed
  if (_ciSourceRef === catalogMap && _ciCache) return _ciCache;
  const ci: Record<string, any> = {};
  for (const [name, entry] of Object.entries(catalogMap)) {
    ci[name.toLowerCase()] = entry;
  }
  _ciCache = ci;
  _ciSourceRef = catalogMap;
  return ci;
}

function catalogLookup(name: string, catalogMap: Record<string, any>, ciCatalog: Record<string, any>) {
  return catalogMap[name] ?? ciCatalog[name.toLowerCase()];
}

/**
 * Strength-score type of one set. `resolveLoadType` lets a 'weighted' row take the catalog's
 * bodyweight type, because older builds stored 'weighted' for everything (a pull-up at 0 kg).
 * That only applies at 0 kg: a 'weighted' row with load on it scores its kg as before.
 * LoadType and ExerciseType share one vocabulary.
 */
function rankLoadType(resolved: LoadType, rowIsWeighted: boolean, kg: number): ExerciseType {
  if (rowIsWeighted && kg !== 0) return 'weighted';
  return resolved;
}

/* ─── Defaults ───────────────────────────────────────── */

const DEFAULT_RANK: RankInfo = {
  name: 'Novice',
  minScore: 0,
  maxScore: 2,
  progress: 0,
};

/* ─── Store ──────────────────────────────────────────── */

/**
 * Bodyweight for strength scores, matching the server leaderboard: latest weigh-in, else the
 * profile's starting weight, else 70 kg. A typo outside 30–300 kg counts as missing.
 */
function rankBodyweight(): number {
  const current = useWeightStore.getState().current;
  if (isPlausibleBodyweight(current)) return current;
  const starting = useAuthStore.getState().profile?.starting_weight;
  if (isPlausibleBodyweight(starting)) return starting;
  return 70;
}

/**
 * Fold workouts' completed working sets (and legacy sets with no set_type) into `bestSets`, keeping
 * each exercise's highest estimated 1RM. Mutates `bestSets`; returns whether anything improved.
 */
function mergeBestSets(
  bestSets: Record<string, BestSetEntry>,
  exercises: { name: string; exercise_type?: string | null; sets?: any[] }[],
  catalogMap: Record<string, any>,
  ciCatalog: Record<string, any>,
  bodyweight: number,
): boolean {
  let changed = false;
  for (const ex of exercises) {
    const cat = catalogLookup(ex.name, catalogMap, ciCatalog);
    const exType = resolveLoadType(ex.exercise_type, cat?.exercise_type);
    const rowIsWeighted = toLoadType(ex.exercise_type) === 'weighted';

    for (const s of ex.sets || []) {
      if (!s.completed) continue;
      if (s.set_type && s.set_type !== 'working') continue;

      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      if (reps <= 0) continue;

      const setType = rankLoadType(exType, rowIsWeighted, kg);
      const load = effectiveLoad(kg, bodyweight, setType);
      if (load <= 0) continue;

      const e1rm = estimateOneRepMax(load, reps);
      const prev = bestSets[ex.name];

      if (!prev || e1rm > prev.e1rm) {
        bestSets[ex.name] = { kg, reps, exerciseType: setType, e1rm };
        changed = true;
      }
    }
  }
  return changed;
}

export const useRankStore = create<RankState>((set, get) => ({
  bestSets: {},
  exerciseScores: {},
  muscleScores: {},
  slugScores: {},
  overallScore: 0,
  rank: DEFAULT_RANK,
  diversityBonus: 0,
  totalWorkouts: 0,
  isProvisional: true,
  loading: false,

  /* ─── Full computation ─────────────────────────────── */

  computeRank: async (userId: string) => {
    set({ loading: true });

    try {
      // 1. Total workout count, and 2. the most recent 500 workout ids (enough for an accurate rank
      // without loading the whole history), in parallel
      const [{ count, error: countError }, { data: workoutsData, error: workoutsError }] = await Promise.all([
        supabase
          .from('workouts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('workouts')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      // A failed query (offline, timeout) is not "no workouts": keep the current/cached rank and
      // don't persist, so a lower rank from missing data never overwrites the saved one.
      if (countError || workoutsError) {
        set({ loading: false });
        return;
      }

      const totalWorkouts = count ?? 0;

      if (!workoutsData || workoutsData.length === 0) {
        set({
          bestSets: {},
          exerciseScores: {},
          muscleScores: {},
          slugScores: {},
          overallScore: 0,
          rank: DEFAULT_RANK,
          diversityBonus: 0,
          totalWorkouts: 0,
          isProvisional: true,
          loading: false,
        });
        return;
      }

      const workoutIds = workoutsData.map((w) => w.id);

      // Batch fetch to avoid URL-length limits on large histories
      const BATCH = 200;
      const batches: string[][] = [];
      for (let i = 0; i < workoutIds.length; i += BATCH) batches.push(workoutIds.slice(i, i + BATCH));
      // In parallel; results are concatenated in batch order, as before
      const results = await Promise.all(batches.map((batch) => supabase
        .from('exercises')
        .select('name, exercise_type, sets(kg, reps, completed, set_type)')
        .in('workout_id', batch)));
      // One failed batch would leave the rank computed from partial history: keep the current one
      if (results.some((r) => r.error)) {
        set({ loading: false });
        return;
      }
      const allExercises: any[] = [];
      for (const { data } of results) {
        if (data) allExercises.push(...data);
      }

      // 3. Derive best working set per exercise (highest e1RM)
      const catalogMap = useWorkoutStore.getState().catalogMap;
      const ciCatalog = getCiCatalog(catalogMap);
      const bodyweight = rankBodyweight();

      const bestSets: Record<string, BestSetEntry> = {};
      mergeBestSets(bestSets, allExercises, catalogMap, ciCatalog, bodyweight);

      // 4. Compute full rank (pass CI catalog so all exercises resolve)
      const result = computeFullRank({
        bestSets,
        bodyweight,
        catalog: ciCatalog,
        totalWorkouts,
      });

      set({
        bestSets,
        exerciseScores: result.exerciseScores,
        muscleScores: result.muscleScores,
        slugScores: result.slugScores,
        overallScore: result.overallScore,
        rank: result.rank,
        diversityBonus: result.diversityBonus,
        totalWorkouts,
        isProvisional: result.isProvisional,
        loading: false,
      });

      get()._persistRank(userId);
    } catch {
      set({ loading: false });
    }
  },

  /* ─── Incremental update ───────────────────────────── */

  updateFromWorkout: (exercises, userId) => {
    const { bestSets: prevBest, totalWorkouts } = get();
    const catalogMap = useWorkoutStore.getState().catalogMap;
    const ciCatalog = getCiCatalog(catalogMap);
    const bodyweight = rankBodyweight();

    const bestSets = { ...prevBest };
    const changed = mergeBestSets(bestSets, exercises, catalogMap, ciCatalog, bodyweight);

    if (!changed) {
      // Still bump workout count — rank stays the same
      set({ totalWorkouts: totalWorkouts + 1 });
      if (userId) get()._persistRank(userId);
      return;
    }

    const newTotal = totalWorkouts + 1;
    const result = computeFullRank({
      bestSets,
      bodyweight,
      catalog: ciCatalog,
      totalWorkouts: newTotal,
    });

    set({
      bestSets,
      exerciseScores: result.exerciseScores,
      muscleScores: result.muscleScores,
      slugScores: result.slugScores,
      overallScore: result.overallScore,
      rank: result.rank,
      diversityBonus: result.diversityBonus,
      totalWorkouts: newTotal,
      isProvisional: result.isProvisional,
    });

    if (userId) get()._persistRank(userId);
  },

  /* ─── Load cached rank from DB ──────────────────────── */

  loadRank: async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_ranks')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) return;

      set({
        bestSets: (data.best_sets as Record<string, BestSetEntry>) || {},
        muscleScores: (data.muscle_scores as Partial<Record<MuscleGroup, MuscleScoreDetail>>) || {},
        slugScores: (data.slug_scores as Partial<Record<string, SlugScoreDetail>>) || {},
        overallScore: Number(data.overall_score) || 0,
        rank: {
          ...getOverallRank(Number(data.overall_score) || 0),
          progress: Number(data.rank_progress) || 0,
        },
        diversityBonus: Number(data.diversity_bonus) || 0,
        totalWorkouts: data.total_workouts ?? 0,
        isProvisional: data.is_provisional ?? true,
      });
    } catch {
      // Silently fail — computeRank will overwrite shortly
    }
  },

  /* ─── Persist rank to DB (fire-and-forget) ──────────── */

  _persistRank: (userId: string) => {
    const {
      bestSets,
      muscleScores,
      slugScores,
      overallScore,
      rank,
      diversityBonus,
      totalWorkouts,
      isProvisional,
    } = get();

    supabase
      .from('user_ranks')
      .upsert(
        {
          user_id: userId,
          rank_name: rank.name,
          overall_score: overallScore,
          rank_progress: rank.progress,
          diversity_bonus: diversityBonus,
          total_workouts: totalWorkouts,
          is_provisional: isProvisional,
          best_sets: bestSets,
          muscle_scores: muscleScores,
          slug_scores: slugScores,
        },
        { onConflict: 'user_id' },
      )
      .then(() => {}, () => {});
  },
}));
