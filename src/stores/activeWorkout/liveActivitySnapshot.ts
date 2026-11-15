import type { WorkoutActivitySnapshot } from '../../services/liveActivityManager';
import { type ActiveExercise, type ActiveWorkoutState } from './types';

type ExerciseInfo = { name: string; currentSet: number; totalSets: number; nextName: string | null };

const _hasSetsLeft = (ex: ActiveExercise) => ex.sets.some((s) => !s.completed);

/**
 * The exercise and set the user is on, and the one after it, for the Live Activity.
 * Current = the exercise of the most recently completed set while it has sets left,
 * else the next exercise (in list order, wrapping) with sets left. Next = its
 * superset partner if that has sets left, else the following exercise with sets left.
 */
function _getExerciseInfo(exercises: ActiveExercise[]): ExerciseInfo {
  const n = exercises.length;
  if (n === 0) return { name: '', currentSet: 0, totalSets: 0, nextName: null };

  let anchor = -1;
  let latest = -Infinity;
  exercises.forEach((ex, i) => {
    for (const set of ex.sets) {
      const at = set.completedAt ?? 0;
      if (set.completed && at >= latest) { latest = at; anchor = i; }
    }
  });

  /** First exercise with sets left, scanning from `from` and wrapping; -1 if none. */
  const firstWithSetsLeft = (from: number, skip: number): number => {
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      if (i !== skip && _hasSetsLeft(exercises[i])) return i;
    }
    return -1;
  };

  const current = anchor >= 0 && _hasSetsLeft(exercises[anchor])
    ? anchor
    : firstWithSetsLeft(anchor + 1, -1);

  if (current === -1) {
    // Every set is done: show the last exercise worked on as complete.
    const last = exercises[anchor >= 0 ? anchor : n - 1];
    return { name: last.name, currentSet: last.sets.length, totalSets: last.sets.length, nextName: null };
  }

  const ex = exercises[current];
  const done = ex.sets.filter((s) => s.completed).length;
  const partner = ex.supersetWith;
  const next = partner !== null && exercises[partner] && _hasSetsLeft(exercises[partner])
    ? partner
    : firstWithSetsLeft(current + 1, current);
  return {
    name: ex.name,
    currentSet: done + 1,
    totalSets: ex.sets.length,
    nextName: next === -1 ? null : exercises[next].name,
  };
}

export function _buildSnapshot(
  state: Pick<ActiveWorkoutState, 'startTime' | 'exercises' | 'isResting' | 'restStartedAt' | 'restDuration' | 'restTotal'>,
): WorkoutActivitySnapshot {
  const info = _getExerciseInfo(state.exercises);
  return {
    startTime: state.startTime!,
    exerciseName: info.name,
    currentSet: info.currentSet,
    totalSets: info.totalSets,
    nextExerciseName: info.nextName,
    isResting: state.isResting,
    restStartedAt: state.restStartedAt,
    restDuration: state.restDuration,
    restTotal: state.restTotal,
  };
}
