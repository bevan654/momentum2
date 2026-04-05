import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const ROUTINES_CACHE_KEY = '@momentum_routines_cache';

export interface RoutineExercise {
  id?: string;
  name: string;
  exercise_order: number;
  default_sets: number;
  default_reps: number;
  default_rest_seconds: number;
  set_reps: number[];
  set_weights: number[];
  exercise_type: string;
}

export interface Routine {
  id: string;
  name: string;
  days: number[];
  exercises: RoutineExercise[];
  created_at: string;
  updated_at: string;
}

/* ─── Preview bridge (module-level, avoids route-param serialisation) ── */

let _previewRoutine: Routine | null = null;

export function setPreviewRoutine(routine: Routine | null) {
  _previewRoutine = routine;
}
export function getPreviewRoutine() {
  return _previewRoutine;
}
export function consumePreviewRoutine() {
  const r = _previewRoutine;
  _previewRoutine = null;
  return r;
}

interface RoutineState {
  routines: Routine[];
  loading: boolean;
  fetchRoutines: (userId: string) => Promise<void>;
  createRoutine: (
    userId: string,
    name: string,
    exercises: Omit<RoutineExercise, 'id'>[],
    days?: number[]
  ) => Promise<{ error: string | null }>;
  updateRoutine: (
    userId: string,
    routineId: string,
    name: string,
    exercises: Omit<RoutineExercise, 'id'>[],
    days?: number[]
  ) => Promise<{ error: string | null }>;
  deleteRoutine: (routineId: string) => Promise<{ error: string | null }>;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
  routines: [],
  loading: false,

  fetchRoutines: async (userId: string) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('routines')
        .select('*, routine_exercises(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        const routines: Routine[] = data.map((r: any) => ({
          id: r.id,
          name: r.name,
          days: Array.isArray(r.days) ? r.days : [],
          exercises: (r.routine_exercises || [])
            .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
            .map((e: any) => {
              const reps = e.default_reps ?? 10;
              const sets = e.default_sets ?? 3;
              const setReps: number[] = Array.isArray(e.set_reps)
                ? e.set_reps
                : Array(sets).fill(reps);
              return {
                id: e.id,
                name: e.name,
                exercise_order: e.exercise_order,
                default_sets: sets,
                default_reps: reps,
                default_rest_seconds: e.default_rest_seconds ?? 90,
                set_reps: setReps,
                set_weights: Array.isArray(e.set_weights) ? e.set_weights : Array(sets).fill(0),
                exercise_type: e.exercise_type,
              };
            }),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        set({ routines });
        AsyncStorage.setItem(ROUTINES_CACHE_KEY, JSON.stringify(routines)).catch(() => {});
      } else if (get().routines.length === 0) {
        // Network error — load from cache
        try {
          const raw = await AsyncStorage.getItem(ROUTINES_CACHE_KEY);
          if (raw) set({ routines: JSON.parse(raw) });
        } catch {}
      }
    } finally {
      set({ loading: false });
    }
  },

  createRoutine: async (userId, name, exercises, days = []) => {
    const { data: routine, error } = await supabase
      .from('routines')
      .insert({ user_id: userId, name, days })
      .select('id')
      .single();

    if (error) return { error: error.message };

    if (exercises.length > 0) {
      const rows = exercises.map((e) => ({
        routine_id: routine.id,
        name: e.name,
        exercise_order: e.exercise_order,
        default_sets: e.default_sets,
        default_reps: e.default_reps,
        default_rest_seconds: e.default_rest_seconds,
        set_reps: e.set_reps,
        set_weights: e.set_weights,
        exercise_type: e.exercise_type,
      }));

      const { error: exError } = await supabase
        .from('routine_exercises')
        .insert(rows);

      if (exError) return { error: exError.message };
    }

    await get().fetchRoutines(userId);
    return { error: null };
  },

  updateRoutine: async (userId, routineId, name, exercises, days = []) => {
    const { error } = await supabase
      .from('routines')
      .update({ name, days })
      .eq('id', routineId);

    if (error) return { error: error.message };

    // Replace all exercises: delete old, insert new
    await supabase.from('routine_exercises').delete().eq('routine_id', routineId);

    if (exercises.length > 0) {
      const rows = exercises.map((e) => ({
        routine_id: routineId,
        name: e.name,
        exercise_order: e.exercise_order,
        default_sets: e.default_sets,
        default_reps: e.default_reps,
        default_rest_seconds: e.default_rest_seconds,
        set_reps: e.set_reps,
        set_weights: e.set_weights,
        exercise_type: e.exercise_type,
      }));

      const { error: exError } = await supabase
        .from('routine_exercises')
        .insert(rows);

      if (exError) return { error: exError.message };
    }

    await get().fetchRoutines(userId);
    return { error: null };
  },

  deleteRoutine: async (routineId: string) => {
    // Remove from local state optimistically
    const prev = get().routines;
    set({ routines: prev.filter((r) => r.id !== routineId) });

    // Delete exercises first, then routine
    await supabase.from('routine_exercises').delete().eq('routine_id', routineId);
    const { error } = await supabase.from('routines').delete().eq('id', routineId);

    if (error) {
      set({ routines: prev });
      return { error: error.message };
    }
    return { error: null };
  },
}));
