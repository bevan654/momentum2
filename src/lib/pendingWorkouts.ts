import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = '@momentum_pending_workouts';

export interface PendingExercise {
  name: string;
  exercise_order: number;
  exercise_type: string;
  sets: {
    set_number: number;
    kg: number;
    reps: number;
    completed: boolean;
    set_type: string;
    parent_set_number: number | null;
  }[];
}

export interface PendingWorkout {
  id: string; // local temp ID for dedup
  userId: string;
  duration: number;
  totalExercises: number;
  totalSets: number;
  ghostUsername: string | null;
  programId: string | null;
  programWeek: number | null;
  exercises: PendingExercise[];
  createdAt: number;
}

async function loadPending(): Promise<PendingWorkout[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function savePending(list: PendingWorkout[]) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {}
}

/** Queue a workout for later sync */
export async function enqueuePendingWorkout(workout: PendingWorkout) {
  const list = await loadPending();
  list.push(workout);
  await savePending(list);
}

/** Sync all pending workouts to Supabase. Call when online. */
export async function flushPendingWorkouts(): Promise<void> {
  // Lazy imports to avoid circular deps
  const { supabase } = require('./supabase');
  const { useNetworkStore } = require('../stores/useNetworkStore');

  if (useNetworkStore.getState().isOffline) return;

  const list = await loadPending();
  if (list.length === 0) return;

  const remaining: PendingWorkout[] = [];

  for (const pw of list) {
    try {
      // Step 1: Insert workout
      const { data: workoutData, error: workoutErr } = await supabase
        .from('workouts')
        .insert({
          user_id: pw.userId,
          duration: pw.duration,
          total_exercises: pw.totalExercises,
          total_sets: pw.totalSets,
          ...(pw.ghostUsername ? { ghost_username: pw.ghostUsername } : {}),
          ...(pw.programId ? { program_id: pw.programId, program_week: pw.programWeek } : {}),
        })
        .select('id')
        .single();

      if (workoutErr || !workoutData) {
        remaining.push(pw);
        continue;
      }

      // Step 2: Insert exercises
      const exerciseRows = pw.exercises.map((ex) => ({
        workout_id: workoutData.id,
        name: ex.name,
        exercise_order: ex.exercise_order,
        exercise_type: ex.exercise_type,
      }));

      const { data: exData, error: exErr } = await supabase
        .from('exercises')
        .insert(exerciseRows)
        .select('id, exercise_order');

      if (exErr || !exData || exData.length === 0) {
        // Workout row exists but exercises failed — clean up
        await supabase.from('workouts').delete().eq('id', workoutData.id);
        remaining.push(pw);
        continue;
      }

      // Step 3: Insert sets
      const orderToId = new Map<number, string>();
      for (const row of exData) orderToId.set(row.exercise_order, row.id);

      const allSetRows: any[] = [];
      for (const ex of pw.exercises) {
        const exId = orderToId.get(ex.exercise_order);
        if (!exId) continue;
        for (const s of ex.sets) {
          allSetRows.push({
            exercise_id: exId,
            set_number: s.set_number,
            kg: s.kg,
            reps: s.reps,
            completed: s.completed,
            set_type: s.set_type,
            parent_set_number: s.parent_set_number,
          });
        }
      }

      if (allSetRows.length > 0) {
        await supabase.from('sets').insert(allSetRows);
      }

      // Step 4: Fire-and-forget side effects
      try {
        const exerciseNames = pw.exercises.map((ex) => ex.name);
        const totalVolume = pw.exercises.reduce((sum, ex) =>
          sum + ex.sets.reduce((s, set) => s + set.kg * set.reps, 0), 0);

        await supabase.from('activity_feed').insert({
          user_id: pw.userId,
          workout_id: workoutData.id,
          duration: pw.duration,
          total_volume: Math.round(totalVolume),
          exercise_names: exerciseNames,
          total_exercises: pw.totalExercises,
          total_sets: pw.totalSets,
          ...(pw.programId ? { program_id: pw.programId, program_week: pw.programWeek } : {}),
          ...(pw.ghostUsername ? { ghost_username: pw.ghostUsername } : {}),
        });
      } catch {}

      // Success — don't add to remaining
    } catch {
      // Network still down — keep in queue and stop processing
      remaining.push(pw);
      break;
    }
  }

  await savePending(remaining);
}

/** Check if there are pending workouts */
export async function hasPendingWorkouts(): Promise<boolean> {
  const list = await loadPending();
  return list.length > 0;
}
