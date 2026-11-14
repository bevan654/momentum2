// ── Edit-mode types ──────────────────────────────────

// origId: the row's id before editing (saved workouts only), so the save keeps what the editor
// doesn't show (set times, rest, targets, notes, supersets). parentOrigId: a drop set's parent.
type EditSet = { kg: string; reps: string; completed: boolean; set_type: string; origId?: string; parentOrigId?: string | null };
export type EditExercise = { name: string; category: string | null; exercise_type?: string; sets: EditSet[]; origId?: string };

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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

export function formatWorkoutDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}
