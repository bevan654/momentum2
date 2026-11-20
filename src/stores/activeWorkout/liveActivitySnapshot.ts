import type { WorkoutActivitySnapshot } from '../../services/liveActivityManager';
import { getExerciseHistorySets, type RecordSet } from '../../services/exerciseRecords';
import { suggestSets } from '../../utils/exerciseProgress';
import type {
  WorkoutLiveActivityDoneSet,
  WorkoutLiveActivitySetCard,
  WorkoutSetKind,
} from '../../../modules/workout-live-activity';
import { type ActiveExercise, type ActiveSet, type ActiveWorkoutState } from './types';

type ExerciseInfo = {
  name: string;
  currentSet: number;
  totalSets: number;
  nextName: string | null;
  /** Index of the current exercise; null when there's none (no exercises, or every set done). */
  exerciseIndex: number | null;
};

const _hasSetsLeft = (ex: ActiveExercise) => ex.sets.some((s) => !s.completed);

/**
 * The exercise and set the user is on, and the one after it, for the Live Activity.
 * Current = the exercise of the most recently completed set while it has sets left,
 * else the next exercise (in list order, wrapping) with sets left. Next = its
 * superset partner if that has sets left, else the following exercise with sets left.
 */
function _getExerciseInfo(exercises: ActiveExercise[]): ExerciseInfo {
  const n = exercises.length;
  if (n === 0) return { name: '', currentSet: 0, totalSets: 0, nextName: null, exerciseIndex: null };

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
    return { name: last.name, currentSet: last.sets.length, totalSets: last.sets.length, nextName: null, exerciseIndex: null };
  }

  const ex = exercises[current];
  // The first unticked set (sets can be ticked out of order), as the Lock Screen card numbers it.
  const pos = ex.sets.findIndex((s) => !s.completed);
  const partner = ex.supersetWith;
  const next = partner !== null && exercises[partner] && _hasSetsLeft(exercises[partner])
    ? partner
    : firstWithSetsLeft(current + 1, current);
  return {
    name: ex.name,
    currentSet: pos + 1,
    totalSets: ex.sets.length,
    nextName: next === -1 ? null : exercises[next].name,
    exerciseIndex: current,
  };
}

// ── Lock Screen sets ───────────────────────────────────────

/** The user's rest length; the store keeps it current (it's a preference, not workout state). */
let _restSeconds = 90;
export function setLiveActivityRestSeconds(seconds: number): void {
  _restSeconds = seconds;
}

const KINDS: Record<ActiveExercise['exercise_type'], WorkoutSetKind> = {
  weighted: 'weighted',
  bodyweight: 'bodyweight',
  'weighted+bodyweight': 'weightedBodyweight',
  duration: 'duration',
};

const _usesKg = (kind: WorkoutSetKind) => kind === 'weighted' || kind === 'weightedBodyweight';

const _num = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const _isWork = (s: ActiveSet) => s.completed && s.set_type !== 'warmup';

/** What the set calls for, like the set row: the values typed in, else its placeholder suggestion. */
function _plannedValues(ex: ActiveExercise, pos: number, isGhost: boolean): { kg: number | null; reps: number | null } {
  const set = ex.sets[pos];
  const suggested = isGhost
    ? ex.prevSets[pos] ?? null
    : suggestSets(ex.sets, ex.prevSets, ex.exercise_type)[pos] ?? null;
  const kind = KINDS[ex.exercise_type] ?? 'weighted';
  const kg = _usesKg(kind) ? _num(set.kg) ?? suggested?.kg ?? null : null;
  const reps = _num(set.reps) ?? suggested?.reps ?? null;
  return { kg, reps: reps != null && reps > 0 ? Math.round(reps) : null };
}

/** The same set last session; none in ghost mode, where prevSets are the friend's sets. */
function _lastTime(ex: ActiveExercise, pos: number, isGhost: boolean) {
  const prev = isGhost ? undefined : ex.prevSets[pos];
  if (!prev) return { lastKg: null, lastReps: null };
  return { lastKg: _usesKg(KINDS[ex.exercise_type] ?? 'weighted') ? prev.kg : null, lastReps: prev.reps > 0 ? prev.reps : null };
}

/** Earlier working sets of this exercise: history, plus today's sets ticked off before `before` (ms). */
function _earlierSets(
  exercises: ActiveExercise[],
  name: string,
  workoutId: string | null,
  before: number,
): RecordSet[] | null {
  const history = getExerciseHistorySets(name, workoutId);
  if (!history) return null; // not loaded: no PR claims until it is
  const today: RecordSet[] = [];
  for (const ex of exercises) {
    if (ex.name !== name) continue;
    for (const s of ex.sets) {
      if (!_isWork(s) || (s.completedAt ?? 0) >= before) continue;
      // Whole reps: the native side stores them as Int, and a fraction there fails every update.
      const reps = Math.round(_num(s.reps) ?? 0);
      if (reps > 0) today.push({ kg: _num(s.kg) ?? 0, reps });
    }
  }
  return history.concat(today);
}

/** The bests a set at `kg` has to beat. Null/null when there's nothing to compare with. */
function _prThresholds(sets: RecordSet[] | null, kind: WorkoutSetKind, kg: number | null) {
  if (!sets || sets.length === 0) return { prKg: null, prReps: null };
  if (_usesKg(kind)) {
    const target = kg ?? 0;
    let prKg = 0;
    let prReps = 0;
    for (const s of sets) {
      if (s.kg > prKg) prKg = s.kg;
      if (s.kg >= target - 0.001 && s.reps > prReps) prReps = s.reps;
    }
    return { prKg, prReps };
  }
  return { prKg: null, prReps: Math.max(...sets.map((s) => s.reps)) };
}

const _kgText = (kg: number) => String(Math.round(kg * 100) / 100);

/** Mirrors WorkoutSetMath.prLabel in targets/workout-activity/WorkoutActivityShared.swift. */
function _prLabel(kind: WorkoutSetKind, kg: number | null, reps: number | null, prKg: number | null, prReps: number | null): string | null {
  if (prKg == null && prReps == null) return null;
  if (_usesKg(kind) && kg != null && kg > 0 && prKg != null && kg > prKg + 0.001) return 'Heaviest ever';
  if (reps == null || prReps == null || reps <= prReps) return null;
  if (kind === 'duration') return 'Longest ever';
  if (_usesKg(kind) && kg != null && kg > 0) return `Most reps at ${_kgText(kg)} kg`;
  return 'Most reps ever';
}

/** The current exercise's set to do next (its first unticked one), as the Lock Screen shows it. */
function _setCard(
  exercises: ActiveExercise[],
  exerciseIndex: number | null,
  isGhost: boolean,
  workoutId: string | null,
): WorkoutLiveActivitySetCard | null {
  if (exerciseIndex == null) return null;
  const ex = exercises[exerciseIndex];
  const pos = ex?.sets.findIndex((s) => !s.completed) ?? -1;
  if (!ex || pos < 0) return null;
  const kind = KINDS[ex.exercise_type] ?? 'weighted';
  const { kg, reps } = _plannedValues(ex, pos, isGhost);
  // A warm-up is never a PR (as in _justDone): no thresholds, so a Lock Screen Done can't claim one.
  const { prKg, prReps } = ex.sets[pos].set_type === 'warmup'
    ? { prKg: null, prReps: null }
    : _prThresholds(_earlierSets(exercises, ex.name, workoutId, Infinity), kind, kg);
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    setPosition: pos,
    setIndex: pos + 1,
    setCount: ex.sets.length,
    kind,
    kg,
    reps,
    ..._lastTime(ex, pos, isGhost),
    prKg,
    prReps,
    setStates: ex.sets.map((s, i) => (s.completed ? 'd' : i === pos ? 'c' : 'p')).join(''),
  };
}

/** The workout as it would be once `card`'s set is ticked off with the values shown. */
function _withCardDone(exercises: ActiveExercise[], card: WorkoutLiveActivitySetCard, at: number): ActiveExercise[] {
  return exercises.map((ex) => {
    if (ex.id !== card.exerciseId) return ex;
    const sets = ex.sets.map((s, i) => (i === card.setPosition
      ? {
          ...s,
          kg: s.kg.trim() === '' && card.kg != null ? String(card.kg) : s.kg,
          reps: card.reps != null ? String(card.reps) : s.reps,
          completed: true,
          completedAt: at,
        }
      : s));
    return { ...ex, sets };
  });
}

/** The set ticked off most recently, and how it compares; null before the first. */
function _justDone(exercises: ActiveExercise[], isGhost: boolean, workoutId: string | null): WorkoutLiveActivityDoneSet | null {
  let best: { ex: ActiveExercise; pos: number; at: number } | null = null;
  exercises.forEach((ex) => ex.sets.forEach((s, pos) => {
    const at = s.completedAt ?? 0;
    if (s.completed && at > 0 && (!best || at >= best.at)) best = { ex, pos, at };
  }));
  if (!best) return null;
  const { ex, pos, at } = best as { ex: ActiveExercise; pos: number; at: number };
  const set = ex.sets[pos];
  const kind = KINDS[ex.exercise_type] ?? 'weighted';
  const kg = _usesKg(kind) ? _num(set.kg) : null;
  const repsRaw = _num(set.reps);
  const reps = repsRaw != null && repsRaw > 0 ? Math.round(repsRaw) : null;
  const { prKg, prReps } = set.set_type === 'warmup'
    ? { prKg: null, prReps: null }
    : _prThresholds(_earlierSets(exercises, ex.name, workoutId, at), kind, kg);
  return {
    exerciseName: ex.name,
    setIndex: pos + 1,
    kind,
    kg,
    reps,
    ..._lastTime(ex, pos, isGhost),
    prLabel: _prLabel(kind, kg, reps, prKg, prReps),
  };
}

export function _buildSnapshot(
  state: Pick<
    ActiveWorkoutState,
    'startTime' | 'exercises' | 'isResting' | 'restStartedAt' | 'restDuration' | 'restTotal' | 'workoutTitle' | 'ghostUserName' | 'workoutId'
  >,
): WorkoutActivitySnapshot {
  const { exercises, workoutId } = state;
  const isGhost = !!state.ghostUserName;
  const info = _getExerciseInfo(exercises);

  let completedSets = 0;
  let workoutSets = 0;
  let lastCompletedAt = 0;
  for (const e of exercises) {
    workoutSets += e.sets.length;
    for (const s of e.sets) {
      if (!s.completed) continue;
      completedSets++;
      lastCompletedAt = Math.max(lastCompletedAt, s.completedAt ?? 0);
    }
  }

  const current = _setCard(exercises, info.exerciseIndex, isGhost, workoutId);
  let after: WorkoutLiveActivitySetCard | null = null;
  if (current) {
    const simulated = _withCardDone(exercises, current, Math.max(Date.now(), lastCompletedAt + 1));
    after = _setCard(simulated, _getExerciseInfo(simulated).exerciseIndex, isGhost, workoutId);
  }

  return {
    startTime: state.startTime!,
    workoutId,
    workoutTitle: state.workoutTitle?.trim() || null,
    exerciseName: info.name,
    currentSet: info.currentSet,
    totalSets: info.totalSets,
    nextExerciseName: info.nextName,
    completedSets,
    workoutSets,
    restSeconds: _restSeconds,
    lastCompletedAt: lastCompletedAt > 0 ? lastCompletedAt : null,
    current,
    after,
    justDone: _justDone(exercises, isGhost, workoutId),
    isResting: state.isResting,
    restStartedAt: state.restStartedAt,
    restDuration: state.restDuration,
    restTotal: state.restTotal,
  };
}
