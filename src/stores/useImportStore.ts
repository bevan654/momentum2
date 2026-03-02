import { create } from 'zustand';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { useWorkoutStore } from './useWorkoutStore';
import { useStreakStore } from './useStreakStore';
import {
  detectFormat,
  parseLiftoffCSV,
  parseStrongTSV,
  resolveAliases,
  findUnknownExercises,
  type ImportedWorkout,
  type ImportSource,
} from '../services/importService';

// ── Types ──────────────────────────────────────────────

type Phase = 'idle' | 'picking' | 'parsing' | 'resolving' | 'importing' | 'done' | 'error';

interface ImportState {
  phase: Phase;
  source: ImportSource | null;
  totalWorkouts: number;
  importedCount: number;
  createdExercises: number;
  errorMessage: string;
  startImport: (userId: string) => Promise<void>;
  reset: () => void;
}

const BATCH_SIZE = 5;

// ── Store ──────────────────────────────────────────────

export const useImportStore = create<ImportState>((set, get) => ({
  phase: 'idle',
  source: null,
  totalWorkouts: 0,
  importedCount: 0,
  createdExercises: 0,
  errorMessage: '',

  reset: () =>
    set({
      phase: 'idle',
      source: null,
      totalWorkouts: 0,
      importedCount: 0,
      createdExercises: 0,
      errorMessage: '',
    }),

  startImport: async (userId: string) => {
    const fail = (msg: string) => set({ phase: 'error', errorMessage: msg });

    try {
      // ── 1. Pick file ────────────────────────────
      set({ phase: 'picking', errorMessage: '' });

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/tab-separated-values',
          'text/plain',
          'application/csv',
          'application/vnd.ms-excel',        // .csv on Android with Excel installed
          'public.comma-separated-values-text', // iOS UTI for .csv
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        set({ phase: 'idle' });
        return;
      }

      const fileUri = result.assets[0].uri;

      // ── 2. Parse file ───────────────────────────
      set({ phase: 'parsing' });

      const response = await fetch(fileUri);
      const content = await response.text();

      if (!content.trim()) {
        return fail('The selected file is empty.');
      }

      let source: ImportSource;
      try {
        source = detectFormat(content);
      } catch (e: any) {
        return fail(e.message);
      }

      set({ source });

      let workouts: ImportedWorkout[];
      try {
        workouts = source === 'liftoff' ? parseLiftoffCSV(content) : parseStrongTSV(content);
      } catch (e: any) {
        return fail(e.message || 'Failed to parse file.');
      }

      if (workouts.length === 0) {
        return fail('No workouts found in the file.');
      }

      set({ totalWorkouts: workouts.length });

      // ── 3. Resolve aliases & unknown exercises ──
      set({ phase: 'resolving' });

      const { catalogMap, aliasMap } = useWorkoutStore.getState();
      resolveAliases(workouts, aliasMap);
      const unknowns = findUnknownExercises(workouts, catalogMap);

      let createdCount = 0;
      for (const name of unknowns) {
        try {
          await useWorkoutStore.getState().createUserExercise({
            userId,
            name,
            category: 'Custom',
            exerciseType: 'weighted',
            primaryMuscles: [],
            secondaryMuscles: [],
            equipment: [],
          });
          createdCount++;
        } catch {
          // Skip exercises that fail to create (e.g. duplicates)
        }
      }
      set({ createdExercises: createdCount });

      // ── 4. Import workouts in batches ───────────
      set({ phase: 'importing', importedCount: 0 });

      for (let i = 0; i < workouts.length; i += BATCH_SIZE) {
        const batch = workouts.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map((w) => insertWorkout(w, userId)));

        set({ importedCount: Math.min(i + BATCH_SIZE, workouts.length) });

        // Yield to UI thread between batches
        if (i + BATCH_SIZE < workouts.length) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // ── 5. Refresh data ─────────────────────────
      set({ phase: 'done', importedCount: workouts.length });

      // Fire-and-forget refreshes
      useWorkoutStore.getState().fetchWorkoutHistory(userId).catch(() => {});
      useStreakStore.getState().refreshStreak(userId).catch(() => {});
    } catch (e: any) {
      fail(e?.message || 'An unexpected error occurred.');
    }
  },
}));

// ── Insert helper (mirrors finishWorkout pattern) ──────

async function insertWorkout(w: ImportedWorkout, userId: string): Promise<void> {
  const totalSets = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);

  const { data: workout, error: workoutErr } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      duration: w.duration,
      total_exercises: w.exercises.length,
      total_sets: totalSets,
      created_at: w.created_at,
    })
    .select('id')
    .single();

  if (workoutErr || !workout) return;

  let totalVolume = 0;
  const exerciseNames: string[] = [];

  for (let i = 0; i < w.exercises.length; i++) {
    const ex = w.exercises[i];
    exerciseNames.push(ex.name);

    const { data: exData, error: exErr } = await supabase
      .from('exercises')
      .insert({
        workout_id: workout.id,
        name: ex.name,
        exercise_order: i + 1,
        exercise_type: ex.exercise_type,
      })
      .select('id')
      .single();

    if (exErr || !exData) continue;

    const setRows = ex.sets.map((s) => {
      totalVolume += s.kg * s.reps;
      return {
        exercise_id: exData.id,
        set_number: s.set_number,
        kg: s.kg,
        reps: s.reps,
        completed: true,
        set_type: s.set_type,
        parent_set_number: null,
      };
    });

    if (setRows.length > 0) {
      await supabase.from('sets').insert(setRows);
    }
  }

  // Activity feed entry (fire-and-forget)
  try {
    await supabase.from('activity_feed').insert({
      user_id: userId,
      workout_id: workout.id,
      duration: w.duration,
      total_volume: Math.round(totalVolume),
      exercise_names: exerciseNames,
      total_exercises: w.exercises.length,
      total_sets: totalSets,
      created_at: w.created_at,
    });
  } catch {}
}
