import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface RoutineExercise {
  id?: string;
  name: string;
  exercise_order: number;
  default_sets: number;
  exercise_type: string;
}

export interface Routine {
  id: string;
  name: string;
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
    exercises: Omit<RoutineExercise, 'id'>[]
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
          exercises: (r.routine_exercises || [])
            .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
            .map((e: any) => ({
              id: e.id,
              name: e.name,
              exercise_order: e.exercise_order,
              default_sets: e.default_sets,
              exercise_type: e.exercise_type,
            })),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));
        set({ routines });
      }
    } finally {
      set({ loading: false });
    }
  },

  createRoutine: async (userId, name, exercises) => {
    const { data: routine, error } = await supabase
      .from('routines')
      .insert({ user_id: userId, name })
      .select('id')
      .single();

    if (error) return { error: error.message };

    if (exercises.length > 0) {
      const rows = exercises.map((e) => ({
        routine_id: routine.id,
        name: e.name,
        exercise_order: e.exercise_order,
        default_sets: e.default_sets,
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
