import type { SummaryExercise } from '../../../stores/useActiveWorkoutStore';
import type { ExerciseWithSets } from '../../../stores/useWorkoutStore';

/** A saved workout's exercises in the just-completed summary shape (top set, share image). */
export function toSummaryExercises(exercises: ExerciseWithSets[]): SummaryExercise[] {
  return exercises.map((ex) => ({
    name: ex.name,
    category: ex.category,
    exercise_type: ex.exercise_type || 'weighted',
    sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed, set_type: s.set_type || 'working', parent_set_number: s.parent_set_number ?? null })),
  }));
}

// ── Edit-mode types ──────────────────────────────────

// origId: the row's id before editing (saved workouts only), so the save keeps what the editor
// doesn't show (set times, rest, targets, notes, supersets). parentOrigId: a drop set's parent.
type EditSet = { kg: string; reps: string; completed: boolean; set_type: string; origId?: string; parentOrigId?: string | null };
export type EditExercise = { name: string; category: string | null; exercise_type?: string; sets: EditSet[]; origId?: string };

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return `${kg.toLocaleString()} kg`;
}

export function formatTimeSecs(secs: number): string {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const isTimedType = (t?: string) => t === 'duration';
export const showsKg = (t?: string) => t === 'weighted' || t === 'weighted+bodyweight' || !t;

