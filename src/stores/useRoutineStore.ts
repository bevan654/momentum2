import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { planExerciseColumns, type PlanExercise } from '../utils/planExercise';

interface RoutineExercise extends PlanExercise {
  id?: string;
}

export interface Routine {
  id: string;
  name: string;
  days: number[];
  exercises: RoutineExercise[];
  created_at: string;
  updated_at: string;
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
      const rows = exercises.map((e) => ({ routine_id: routine.id, ...planExerciseColumns(e) }));

      const { error: exError } = await supabase
        .from('routine_exercises')
        .insert(rows);

      if (exError) {
        // Don't leave an empty routine behind (a retry would make a second copy)
        await supabase.from('routines').delete().eq('id', routine.id);
        return { error: exError.message };
      }
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

    // Replace all exercises: delete old, insert new. Not one transaction, so on a failure refetch
    // to show what was actually saved.
    const { error: deleteError } = await supabase.from('routine_exercises').delete().eq('routine_id', routineId);
    if (deleteError) {
      await get().fetchRoutines(userId);
      return { error: deleteError.message };
    }

    if (exercises.length > 0) {
      const rows = exercises.map((e) => ({ routine_id: routineId, ...planExerciseColumns(e) }));

      const { error: exError } = await supabase
        .from('routine_exercises')
        .insert(rows);

      if (exError) {
        await get().fetchRoutines(userId);
        return { error: "The routine's exercises didn't save. Check the routine and try saving again." };
      }
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
