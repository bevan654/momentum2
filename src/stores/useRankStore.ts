import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from './useWorkoutStore';
import { useWeightStore } from './useWeightStore';

const RANK_CACHE_KEY = '@momentum_rank_cache';
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
  type FullRankResult,
  type SlugScoreDetail,
} from '../utils/strengthScore';

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
  /** Rank name before the most recent updateFromWorkout. */
  previousRankName: string;

  loading: boolean;
  lastComputed: number | null;

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

/* ─── Defaults ───────────────────────────────────────── */

const DEFAULT_RANK: RankInfo = {
  name: 'Novice',
  minScore: 0,
  maxScore: 2,
  progress: 0,
};

/* ─── Store ──────────────────────────────────────────── */

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
  previousRankName: 'Novice',
  loading: false,
  lastComputed: null,

  /* ─── Full computation ─────────────────────────────── */

  computeRank: async (userId: string) => {
    set({ loading: true });

    try {
      // 1. Fetch total workout count
      const { count } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const totalWorkouts = count ?? 0;

      // 2. Fetch workout IDs (most recent 500 — enough for accurate rank, avoids loading entire history)
      const { data: workoutsData } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);

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
          lastComputed: Date.now(),
        });
        return;
      }

      const workoutIds = workoutsData.map((w) => w.id);

      // Batch fetch to avoid URL-length limits on large histories
      const BATCH = 200;
      const allExercises: any[] = [];
      for (let i = 0; i < workoutIds.length; i += BATCH) {
        const batch = workoutIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from('exercises')
          .select('name, exercise_type, sets(kg, reps, completed, set_type)')
          .in('workout_id', batch);
        if (data) allExercises.push(...data);
      }

      // 3. Derive best working set per exercise (highest e1RM)
      const catalogMap = useWorkoutStore.getState().catalogMap;
      const ciCatalog = getCiCatalog(catalogMap);
      const bodyweight = useWeightStore.getState().current ?? 70;

      const bestSets: Record<string, BestSetEntry> = {};

      for (const ex of allExercises) {
        const cat = catalogLookup(ex.name, catalogMap, ciCatalog);
        const exType = (ex.exercise_type || cat?.exercise_type || 'weighted') as ExerciseType;
        const sets: any[] = ex.sets || [];

        for (const s of sets) {
          if (!s.completed) continue;
          // Count working sets + null set_type (legacy data)
          if (s.set_type && s.set_type !== 'working') continue;

          const kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          if (reps <= 0) continue;

          const load = effectiveLoad(kg, bodyweight, exType);
          if (load <= 0) continue;

          const e1rm = estimateOneRepMax(load, reps);
          const prev = bestSets[ex.name];

          if (!prev || e1rm > prev.e1rm) {
            bestSets[ex.name] = { kg, reps, exerciseType: exType, e1rm };
          }
        }
      }

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
        previousRankName: result.rank.name,
        loading: false,
        lastComputed: Date.now(),
      });

      // Cache locally + persist to DB
      AsyncStorage.setItem(RANK_CACHE_KEY, JSON.stringify({
        bestSets, muscleScores: result.muscleScores, slugScores: result.slugScores,
        overallScore: result.overallScore, rank: result.rank,
        diversityBonus: result.diversityBonus, totalWorkouts, isProvisional: result.isProvisional,
      })).catch(() => {});

      get()._persistRank(userId);
    } catch {
      // Network error — load from local cache
      if (get().lastComputed === null) {
        try {
          const raw = await AsyncStorage.getItem(RANK_CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            set({
              bestSets: cached.bestSets || {},
              muscleScores: cached.muscleScores || {},
              slugScores: cached.slugScores || {},
              overallScore: cached.overallScore || 0,
              rank: cached.rank || DEFAULT_RANK,
              diversityBonus: cached.diversityBonus || 0,
              totalWorkouts: cached.totalWorkouts || 0,
              isProvisional: cached.isProvisional ?? true,
              lastComputed: Date.now(),
            });
          }
        } catch {}
      }
      set({ loading: false });
    }
  },

  /* ─── Incremental update ───────────────────────────── */

  updateFromWorkout: (exercises, userId) => {
    const { bestSets: prevBest, totalWorkouts } = get();
    const catalogMap = useWorkoutStore.getState().catalogMap;
    const ciCatalog = getCiCatalog(catalogMap);
    const bodyweight = useWeightStore.getState().current ?? 70;

    const bestSets = { ...prevBest };
    let changed = false;

    for (const ex of exercises) {
      const cat = catalogLookup(ex.name, catalogMap, ciCatalog);
      const exType = (ex.exercise_type || cat?.exercise_type || 'weighted') as ExerciseType;

      for (const s of ex.sets) {
        if (!s.completed) continue;
        if (s.set_type && s.set_type !== 'working') continue;

        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        if (reps <= 0) continue;

        const load = effectiveLoad(kg, bodyweight, exType);
        if (load <= 0) continue;

        const e1rm = estimateOneRepMax(load, reps);
        const prev = bestSets[ex.name];

        if (!prev || e1rm > prev.e1rm) {
          bestSets[ex.name] = { kg, reps, exerciseType: exType, e1rm };
          changed = true;
        }
      }
    }

    if (!changed) {
      // Still bump workout count — rank stays the same
      set({ totalWorkouts: totalWorkouts + 1, previousRankName: get().rank.name });
      if (userId) get()._persistRank(userId);
      return;
    }

    const previousRankName = get().rank.name;
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
      previousRankName,
      lastComputed: Date.now(),
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

      if (data) {
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
        return;
      }
    } catch {}

    // DB unavailable — try local cache
    try {
      const raw = await AsyncStorage.getItem(RANK_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        set({
          bestSets: cached.bestSets || {},
          muscleScores: cached.muscleScores || {},
          slugScores: cached.slugScores || {},
          overallScore: cached.overallScore || 0,
          rank: cached.rank || DEFAULT_RANK,
          diversityBonus: cached.diversityBonus || 0,
          totalWorkouts: cached.totalWorkouts || 0,
          isProvisional: cached.isProvisional ?? true,
        });
      }
    } catch {}
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
      .then(() => {})
      .catch(() => {});
  },
}));
