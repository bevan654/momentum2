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

