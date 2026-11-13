/**
 * Live progress for the active workout: sets done / total and volume so far.
 *
 * Pure functions only — no React, no I/O.
 */
import type { ExerciseType } from './exerciseProgress';

interface SetLike {
  kg: string;
  reps: string;
  completed: boolean;
  set_type: string;
}

interface ExerciseLike {
  name: string;
  exercise_type: ExerciseType;
  sets: SetLike[];
}

export interface WorkoutTotals {
  setsDone: number;
  setsTotal: number;
  /** kg × reps over completed, non-warmup sets of loaded exercises. */
  volumeKg: number;
}

export function workoutTotals(exercises: ExerciseLike[]): WorkoutTotals {
  let setsDone = 0;
  let setsTotal = 0;
  let volumeKg = 0;
  for (const ex of exercises) {
    const loaded = ex.exercise_type === 'weighted' || ex.exercise_type === 'weighted+bodyweight';
    for (const s of ex.sets) {
      setsTotal++;
      if (!s.completed) continue;
      setsDone++;
      if (loaded && s.set_type !== 'warmup') {
        volumeKg += (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0);
      }
    }
  }
  return { setsDone, setsTotal, volumeKg };
}
