import type { FeedExerciseDetail } from '../../../lib/friendsDatabase';
import { resolveLoadType } from '../../../utils/muscleLoad';

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${kg} kg`;
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

type CatalogTypes = Readonly<Record<string, { exercise_type?: string | null } | undefined>>;

/**
 * A posted exercise's type: the post's own, else the catalog's, else weighted. Normalised the way
 * the app reads workout rows (resolveLoadType): legacy spellings are mapped, and a posted
 * 'weighted' (what older builds stored for everything) gives way to a bodyweight catalog type.
 */
export function postedExerciseType(name: string, postedType: string | null | undefined, catalogMap: CatalogTypes): string {
  return resolveLoadType(postedType, catalogMap[name]?.exercise_type);
}

/**
 * kg to prefill as a target. Assisted sets store the assistance as negative kg, which the set
 * row can't take as input, so a negative weight prefills nothing (0).
 */
export function targetKg(kg: number): number {
  return kg > 0 ? kg : 0;
}

/**
 * Per-set reps and kg for a routine saved from a post. Posts from older builds have no `sets`,
 * so those fall back to the best set repeated `sets_count` (or 3) times, as "Try workout" does.
 */
export function routineSetTargets(ex: FeedExerciseDetail): { set_reps: number[]; set_weights: number[] } {
  if (ex.sets && ex.sets.length > 0) {
    return { set_reps: ex.sets.map((s) => s.reps), set_weights: ex.sets.map((s) => targetKg(s.kg)) };
  }
  if (ex.best_kg > 0 || ex.best_reps > 0) {
    const count = ex.sets_count || 3;
    return {
      set_reps: Array.from({ length: count }, () => ex.best_reps || 10),
      set_weights: Array.from({ length: count }, () => targetKg(ex.best_kg)),
    };
  }
  return { set_reps: [], set_weights: [] };
}

/* ── Ghost comparison for challenge posts ──────────── */

export function compareGhostSet(
  userKg: number, userReps: number,
  ghostKg: number, ghostReps: number,
): 'win' | 'loss' | 'tie' {
  if (userKg < ghostKg) return 'loss';
  if (userKg === ghostKg) {
    if (userReps > ghostReps) return 'win';
    if (userReps < ghostReps) return 'loss';
    return 'tie';
  }
  const userVol = userKg * userReps;
  const ghostVol = ghostKg * ghostReps;
  if (userVol > ghostVol) return 'win';
  if (userVol < ghostVol) return 'loss';
  return 'tie';
}
