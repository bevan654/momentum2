/**
 * Applies Lock Screen taps (Done set, − / + reps, End rest) to the active workout, and keeps the
 * Lock Screen current when exercise history (for PRs) arrives. Wired up once by
 * useActiveWorkoutStore via `connectLockScreen`.
 *
 * Each tap goes through the same store actions as tapping in the app (updateSet,
 * toggleSetComplete, stopRest), then gets the tap's own time: the set's completedAt and the rest
 * start are when the user tapped, not when the app got round to it. A tap whose set has changed
 * since (ticked or removed in the app, another workout) is skipped.
 */
import type { StoreApi } from 'zustand';
import type { WorkoutLiveActivityAction } from '../../../modules/workout-live-activity';
import { forceNextWorkoutActivityUpdate, updateWorkoutActivity } from '../../services/liveActivityManager';
import { setLockScreenTapHandler } from '../../services/liveActivityTaps';
import { onExerciseRecordsLoaded } from '../../services/exerciseRecords';
import { _buildSnapshot } from './liveActivitySnapshot';
import { _scheduleRestNotification } from './restNotification';
import type { ActiveWorkoutState } from './types';

type Get = () => ActiveWorkoutState;
type Set = StoreApi<ActiveWorkoutState>['setState'];

function _applyComplete(
  a: Extract<WorkoutLiveActivityAction, { type: 'complete' }>,
  exIdx: number,
  get: Get,
  set: Set,
): boolean {
  const pos = a.setPosition;
  const before = get().exercises[exIdx].sets[pos];
  if (a.kg != null && before.kg.trim() === '') get().updateSet(exIdx, pos, 'kg', String(a.kg));
  if (a.reps > 0) get().updateSet(exIdx, pos, 'reps', String(a.reps));
  get().toggleSetComplete(exIdx, pos);

  const s = get();
  if (!s.exercises[exIdx]?.sets[pos]?.completed) {
    // The app's rules said no (e.g. no weight): put back what the tap typed in, so the set
    // isn't left with the Lock Screen's numbers but unticked.
    const now = s.exercises[exIdx]?.sets[pos];
    if (now && now.kg !== before.kg) get().updateSet(exIdx, pos, 'kg', before.kg);
    if (now && now.reps !== before.reps) get().updateSet(exIdx, pos, 'reps', before.reps);
    return false;
  }

  set({
    exercises: s.exercises.map((ex, i) => (i !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((x, j) => (j !== pos ? x : { ...x, completedAt: a.at })),
    })),
  });

  // toggleSetComplete started the rest now; it started at the tap.
  if (s.isResting) {
    const total = s.restTotal;
    const remaining = Math.round(total - (Date.now() - a.at) / 1000);
    if (remaining <= 0) {
      get().stopRest();
    } else {
      set({ restStartedAt: a.at, restDuration: total, restRemaining: remaining });
      _scheduleRestNotification(remaining);
    }
  }
  return true;
}

function _applyTaps(actions: WorkoutLiveActivityAction[], get: Get, set: Set): void {
  let changed = false;
  for (const a of actions) {
    const s = get();
    if (!s.isActive || !s.workoutId || a.workoutId !== s.workoutId) continue;

    if (a.type === 'endRest') {
      if (s.isResting && (s.restStartedAt ?? 0) <= a.at) {
        s.stopRest();
        changed = true;
      }
      continue;
    }

    const exIdx = s.exercises.findIndex((ex) => ex.id === a.exerciseId);
    const target = exIdx >= 0 ? s.exercises[exIdx].sets[a.setPosition] : undefined;
    if (!target || target.completed) continue;

    if (a.type === 'reps') {
      if (a.reps > 0) {
        s.updateSet(exIdx, a.setPosition, 'reps', String(a.reps));
        changed = true;
      }
      continue;
    }
    if (_applyComplete(a, exIdx, get, set)) changed = true;
  }

  if (changed) get()._persist();
  // The Lock Screen already shows the taps; send the app's version (also undoes a skipped tap).
  forceNextWorkoutActivityUpdate();
  if (get().isActive) updateWorkoutActivity(_buildSnapshot(get()));
}

/** Call once, after the store is created. */
export function connectLockScreen(get: Get, set: Set): void {
  setLockScreenTapHandler((actions) => _applyTaps(actions, get, set));
  // PR thresholds come from history that loads in the background.
  onExerciseRecordsLoaded(() => {
    if (get().isActive && get().startTime) updateWorkoutActivity(_buildSnapshot(get()));
  });
}
