import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { saveWorkout, loadWorkoutAsync, clearWorkout, saveRestPreference, loadRestPreference, addPendingWorkoutDelete, loadPendingWorkoutDeletes, removePendingWorkoutDeletes } from '../utils/workoutStorage';
import { buildWorkoutPayload } from '../utils/workoutPayload';
import { makeUuid } from '../utils/uuid';
import { useWorkoutStore } from './useWorkoutStore';
import { useStreakStore } from './useStreakStore';
import { useRankStore } from './useRankStore';
import { useAuthStore } from './useAuthStore';
import { useWeightStore } from './useWeightStore';
import { startWorkoutActivity, updateWorkoutActivity, stopWorkoutActivity, clearStaleWorkoutActivity } from '../services/liveActivityManager';
import { REST_NOTIF_ID, EMPTY_SET } from './activeWorkout/constants';
import { runWithRecovery } from './activeWorkout/supabaseRecovery';
import { type ActiveSet, type ActiveExercise, type ActiveWorkoutState, type FinishResult, type UndoSnapshot } from './activeWorkout/types';
import { createExerciseActions } from './activeWorkout/exerciseActions';
import { _buildSnapshot } from './activeWorkout/liveActivitySnapshot';
import { _scheduleRestNotification } from './activeWorkout/restNotification';
import { programDayOf, buildFeedPayload, toRankExercises, buildSummary } from './activeWorkout/finishHelpers';
export { type ActiveSet, type ActiveExercise, type SummaryExercise, type WorkoutSummary } from './activeWorkout/types';

// ── Module-level refs ──────────────────────────────────

let _timerInterval: ReturnType<typeof setInterval> | null = null;

let _persistTimeout: ReturnType<typeof setTimeout> | null = null;

let _workoutRestored = false; // Guard: prevent _persist before restore

let _restoring: Promise<void> | null = null; // In-flight restore, shared by concurrent callers

let _finishing: Promise<FinishResult> | null = null; // In-flight finish, shared by concurrent callers

// Bumped on sign-out: a restore or finish that was in flight then belongs to the
// previous account and must not write into the store afterwards.
let _sessionGen = 0;

let _undoSnapshot: UndoSnapshot | null = null; // The finished workout as it was, for Undo

let _preferredRestDuration = 90; // Loaded from AsyncStorage at module init

loadRestPreference().then((d) => { _preferredRestDuration = d; });

export function getPreferredRestDuration(): number {
  return _preferredRestDuration;
}

// ── Live Activity snapshot helper ──────────────────────

let _exerciseSeq = 0;

/** Unique within a device session; only used for React keys, never stored in the DB. */
function _newExerciseId(): string {
  _exerciseSeq += 1;
  return `ex-${Date.now().toString(36)}-${_exerciseSeq}`;
}

// ── Store ──────────────────────────────────────────────

/** Retries deletes of discarded (undone) workouts that failed offline. */
async function _flushPendingDeletes(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  // Only this account's: another account's delete would match no rows under RLS
  // and be dropped from the queue without ever running.
  const ids = (await loadPendingWorkoutDeletes()).filter((d) => d.userId === userId).map((d) => d.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from('workouts').delete().in('id', ids).eq('user_id', userId);
  if (error) return; // try again next launch
  await removePendingWorkoutDeletes(ids);
  if (useAuthStore.getState().user?.id === userId) useWorkoutStore.getState().fetchWorkoutHistory(userId);
}

/** Loads the persisted workout (if any) into the store. Use `restoreWorkout`, which runs this once. */
async function _restoreSavedWorkout(
  set: (partial: Partial<ActiveWorkoutState>) => void,
  get: () => ActiveWorkoutState,
): Promise<void> {
  _flushPendingDeletes().catch(() => {});
  const gen = _sessionGen;
  let saved = await loadWorkoutAsync();
  if (_workoutRestored) return; // A workout was started while storage was loading
  if (gen !== _sessionGen) return; // Signed out while loading; the next sign-in restores again
  // A workout another account left on this device isn't this user's to continue.
  // Its copy is left in storage, so it's still there if that account signs back in.
  const userId = useAuthStore.getState().user?.id;
  if (saved?.userId && userId && saved.userId !== userId) {
    saved = null;
  }
  if (!saved) {
    _workoutRestored = true;
    // The app was closed during a workout that isn't coming back (finished, or an
    // abandoned empty one): its sticky notification and any scheduled rest alert
    // are still pending.
    clearStaleWorkoutActivity();
    Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
    return;
  }

  if (_timerInterval) clearInterval(_timerInterval);

  // Back-fill category for exercises saved before category field was added
  const { catalogMap } = useWorkoutStore.getState();
  const exercises = saved.exercises.map((ex) => ({
    ...ex,
    // Workouts saved before exercises had ids
    id: ex.id || _newExerciseId(),
    category: ex.category || catalogMap[ex.name]?.category || null,
  }));

  // Recover rest timer if it was active and hasn't expired
  let isResting = false;
  let restRemaining = 0;
  let restStartedAt: number | null = null;
  let restTotal = 0;
  if (saved.restStartedAt) {
    const restElapsed = Math.floor((Date.now() - saved.restStartedAt) / 1000);
    const remaining = Math.max(0, saved.restDuration - restElapsed);
    if (remaining > 0) {
      isResting = true;
      restRemaining = remaining;
      restStartedAt = saved.restStartedAt;
      // Workouts saved before restTotal was persisted: restDuration is the length from
      // restStartedAt, the closest to the full rest they have.
      restTotal = Math.max(saved.restTotal ?? saved.restDuration, remaining);
    }
  }

  const elapsed = Math.floor((Date.now() - saved.startTime) / 1000);

  set({
    isActive: true,
    sheetVisible: false,
    startTime: saved.startTime,
    elapsedSeconds: elapsed,
    exercises,
    restDuration: saved.restDuration,
    workoutTitle: saved.workoutTitle ?? null,
    restAnchor: saved.restAnchor ?? null,
    startedFromRoutine: saved.startedFromRoutine,
    startedFromProgram: saved.startedFromProgram || null,
    programWeek: saved.programWeek || null,
    ghostUserName: saved.ghostUserName ?? null,
    // Workouts saved by builds before workoutId get one now.
    workoutId: saved.workoutId ?? makeUuid(),
    saveMode: saved.saveMode ?? 'create',
    isResting,
    restRemaining,
    restStartedAt,
    restTotal,
    restEndedAt: null,
  });

  _workoutRestored = true;
  _timerInterval = setInterval(() => get().tick(), 1000);
  startWorkoutActivity(_buildSnapshot(get()));
}

/** Workout fields cleared whenever a session ends (finish, discard, sign-out). Each caller adds its own extras. */
const SESSION_CLEARED = {
  isActive: false,
  sheetVisible: false,
  exercises: [],
  workoutTitle: null,
  restAnchor: null,
  startedFromRoutine: null,
  startedFromProgram: null,
  programWeek: null,
  ghostUserName: null,
  workoutId: null,
  saveMode: 'create',
  isResting: false,
  restRemaining: 0,
  restStartedAt: null,
  restEndedAt: null,
} satisfies Partial<ActiveWorkoutState>;

/** Stop what a running session keeps going: the Live Activity, the rest notification, the 1 s tick and a pending save. */
function _stopSessionEffects() {
  stopWorkoutActivity();
  Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  if (_persistTimeout) { clearTimeout(_persistTimeout); _persistTimeout = null; }
  _workoutRestored = false;
}

/** After a new workout's set(): tick every second, then save and start the Live Activity once the sheet has mounted. */
function _startSessionEffects(get: () => ActiveWorkoutState) {
  _timerInterval = setInterval(() => get().tick(), 1000);
  setTimeout(() => {
    get()._persist();
    startWorkoutActivity(_buildSnapshot(get()));
  }, 0);
}

/** Saves the active workout and opens the summary. Use `finishWorkout`, which runs one at a time. */
async function _finishWorkout(
  set: (partial: Partial<ActiveWorkoutState>) => void,
  get: () => ActiveWorkoutState,
  userId: string,
  durationOverride?: number,
): Promise<FinishResult> {
  const { exercises, elapsedSeconds, ghostUserName } = get();
  const gen = _sessionGen;
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  // Validate: at least 1 exercise — resurrect timer and bail
  if (exercises.length === 0) {
    if (!_timerInterval) _timerInterval = setInterval(() => get().tick(), 1000);
    return { error: 'Add at least one exercise before finishing.' };
  }

  // Count incomplete sets
  const incompleteCount = exercises.reduce(
    (n, ex) => n + ex.sets.filter((s) => !s.completed).length, 0
  );

  const duration = durationOverride ?? elapsedSeconds;
  const restoreTimer = () => {
    if (gen !== _sessionGen) return; // signed out during the save: there's no workout to resume
    if (!_timerInterval) _timerInterval = setInterval(() => get().tick(), 1000);
  };

  const { startTime, startedFromRoutine, startedFromProgram, programWeek, saveMode } = get();
  let workoutId = get().workoutId;
  if (!workoutId) {
    // Only a workout restored from a build before workoutId could get here; restore assigns one.
    workoutId = makeUuid();
    set({ workoutId });
  }

  const endTime = Date.now();
  const start = startTime ?? endTime - duration * 1000;
  const { programDayOfWeek, programDayLabel } = programDayOf(start, startedFromProgram);

  // Drops sets with nothing entered and exercises left with no sets
  const built = buildWorkoutPayload(exercises, {
    workoutId,
    mode: saveMode,
    startTime: start,
    endTime,
    duration,
    ghostUserName,
    routineId: startedFromRoutine,
    programId: startedFromProgram,
    programWeek,
    programDayOfWeek,
    programDayLabel,
    bodyweightKg: useWeightStore.getState().current,
  });
  const filteredExercises = built.saved;

  if (filteredExercises.length === 0) {
    restoreTimer();
    return { error: 'No valid sets to save.' };
  }

  const { totalVolume, totalSets } = built;

  // One call saves the workout, its exercises and sets in a single transaction
  // (upsert_workout). It's keyed by workoutId, so retrying after a timeout or a
  // lost response can't save the workout twice.
  try {
    const res = await runWithRecovery(() =>
      supabase.rpc('upsert_workout', { p: built.payload })
    );
    let saveErr = res.error;
    // created: false means an earlier Finish that showed an error (a timeout whose
    // request still reached the server) already saved this id, and 'create' left
    // that copy untouched. Sets may have been added or edited since, so overwrite
    // it with the workout as it is now.
    if (!saveErr && built.payload.mode === 'create' && (res.data as { created?: boolean } | null)?.created === false) {
      if (__DEV__) console.warn('[finishWorkout] already saved by an earlier attempt — replacing it');
      ({ error: saveErr } = await runWithRecovery(() =>
        supabase.rpc('upsert_workout', { p: { ...built.payload, mode: 'replace' } })
      ));
    }
    if (saveErr) {
      if (__DEV__) console.error('[finishWorkout] save error:', saveErr);
      restoreTimer();
      return { error: 'Failed to save workout — check your connection and try again.' };
    }
  } catch (e: any) {
    if (__DEV__) console.error('[finishWorkout] save threw:', e);
    restoreTimer();
    return { error: 'Failed to save workout — check your connection and try again.' };
  }

  if (gen !== _sessionGen) {
    // Signed out while saving: the workout is saved under the previous account,
    // so drop its stored copy, but don't open its summary (or Undo) for whoever
    // is signed in now.
    const stored = await loadWorkoutAsync();
    if (stored?.workoutId === workoutId) clearWorkout();
    return { error: null, incompleteCount, workoutId };
  }

  // Non-critical operations — fire and forget, never block summary
  try {
    // Deferred: actual insert happens when the user taps Post on the Share screen
    // (or skips, in which case it does not post). See commitFeedPost / dismissShare.
    set({
      pendingFeedPayload: buildFeedPayload(filteredExercises, {
        userId, workoutId, duration, totalVolume, totalSets, ghostUserName,
        routineId: startedFromRoutine, programId: startedFromProgram, programWeek, programDayOfWeek,
        liveExercises: exercises,
      }),
    });
  } catch (feedCrash) {
    if (__DEV__) console.error('[finishWorkout] feed block crashed:', feedCrash);
  }

  try {
    const { refreshStreak } = useStreakStore.getState();
    refreshStreak(userId).catch(() => {});
  } catch {}

  try {
    useRankStore.getState().updateFromWorkout(toRankExercises(filteredExercises), userId);
  } catch {}

  const summaryData = buildSummary(filteredExercises, { workoutId, duration, totalVolume, totalSets, ghostUserName, liveExercises: exercises });

  _undoSnapshot = {
    workoutId,
    exercises,
    startTime: start,
    restDuration: get().restDuration,
    workoutTitle: get().workoutTitle,
    startedFromRoutine,
    startedFromProgram,
    programWeek,
    ghostUserName,
  };

  _stopSessionEffects();
  set({ ...SESSION_CLEARED, showSummary: true, summaryData });

  clearWorkout();
  return { error: null, incompleteCount, workoutId };
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  isActive: false,
  sheetVisible: false,
  startTime: null,
  elapsedSeconds: 0,
  exercises: [],

  restDuration: 90,
  restRemaining: 0,
  restStartedAt: null,
  isResting: false,
  restTotal: 0,
  restEndedAt: null,
  workoutTitle: null,
  restAnchor: null,

  showSummary: false,
  summaryData: null,
  pendingFeedPayload: null,

  startedFromRoutine: null,
  startedFromProgram: null,
  programWeek: null,
  ghostUserName: null,
  workoutId: null,
  saveMode: 'create',

  // ── Workout lifecycle ─────────────────────────────

  startWorkout: () => {
    if (_finishing) return; // the workout is being saved; starting another now would be wiped when it finishes
    if (_timerInterval) clearInterval(_timerInterval);

    const now = Date.now();
    _workoutRestored = true;
    set({
      isActive: true,
      sheetVisible: true,
      startTime: now,
      elapsedSeconds: 0,
      exercises: [],
      restDuration: _preferredRestDuration,
      workoutTitle: null,
      restAnchor: null,
      startedFromRoutine: null,
      startedFromProgram: null,
      programWeek: null,
      ghostUserName: null,
      workoutId: makeUuid(),
      saveMode: 'create',
      isResting: false,
      restRemaining: 0,
      restStartedAt: null,
      showSummary: false,
      summaryData: null,
    });

    _startSessionEffects(get);
  },

  startFromRoutine: (routine, catalogMap, prevMap, ghostUserName) => {
    if (_finishing) return; // the workout is being saved; starting another now would be wiped when it finishes
    if (_timerInterval) clearInterval(_timerInterval);

    const prevNoteMap = useWorkoutStore.getState().prevNoteMap;
    const exercises: ActiveExercise[] = routine.exercises.map((ex) => {
      const catalog = catalogMap[ex.name];
      const sets: ActiveSet[] = Array.from({ length: Math.max(ex.default_sets, 1) }, () => ({ ...EMPTY_SET }));
      return {
        id: _newExerciseId(),
        name: ex.name,
        exercise_type: (ex.exercise_type || catalog?.exercise_type || 'weighted') as ActiveExercise['exercise_type'],
        category: catalog?.category || null,
        sets,
        prevSets: prevMap[ex.name] || [],
        supersetWith: null,
        prevNotes: prevNoteMap[ex.name] || undefined,
      };
    });

    const now = Date.now();
    _workoutRestored = true;
    set({
      isActive: true,
      sheetVisible: true,
      startTime: now,
      elapsedSeconds: 0,
      exercises,
      restDuration: _preferredRestDuration,
      workoutTitle: routine.name || (ghostUserName ? `vs ${ghostUserName}` : null),
      restAnchor: null,
      startedFromRoutine: routine.id,
      ghostUserName: ghostUserName || null,
      workoutId: makeUuid(),
      saveMode: 'create',
      isResting: false,
      restRemaining: 0,
      restStartedAt: null,
      showSummary: false,
      summaryData: null,
    });

    _startSessionEffects(get);
  },

  startFromProgram: (routine, catalogMap, prevMap, programId, programWeek) => {
    if (_finishing) return; // the workout is being saved; starting another now would be wiped when it finishes
    // Reuse startFromRoutine logic, then tag with program context
    get().startFromRoutine(routine, catalogMap, prevMap);
    set({ startedFromProgram: programId, programWeek });
  },

  discardWorkout: () => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    // Discarding a workout reopened with Undo deletes the saved copy, as Undo used to.
    const { workoutId, saveMode } = get();
    if (saveMode === 'replace' && workoutId) {
      const ownerId = useAuthStore.getState().user?.id;
      supabase.from('workouts').delete().eq('id', workoutId).then(({ error }) => {
        if (error) {
          // Offline or failed: retried on the next launch (_flushPendingDeletes)
          if (__DEV__) console.warn('[discardWorkout] delete of the undone workout failed:', error);
          if (ownerId) addPendingWorkoutDelete(workoutId, ownerId).catch(() => {});
          return;
        }
        const userId = useAuthStore.getState().user?.id;
        if (userId) useWorkoutStore.getState().fetchWorkoutHistory(userId);
      }, () => { if (ownerId) addPendingWorkoutDelete(workoutId, ownerId).catch(() => {}); });
    }
    _stopSessionEffects();
    set({ ...SESSION_CLEARED, startTime: null, elapsedSeconds: 0, restTotal: 0, showSummary: false, summaryData: null });
    clearWorkout();
  },

  isSaving: () => _finishing !== null,

  finishWorkout: (userId: string, durationOverride?: number) => {
    // A second call while saving (double tap) shares the first save instead of starting another.
    if (!_finishing) _finishing = _finishWorkout(set, get, userId, durationOverride).finally(() => { _finishing = null; });
    return _finishing;
  },

  resetForSignOut: () => {
    _sessionGen++;
    _restoring = null; // an in-flight restore is for the previous account; the next call starts afresh
    _stopSessionEffects();
    _undoSnapshot = null;
    set({ ...SESSION_CLEARED, startTime: null, elapsedSeconds: 0, showSummary: false, summaryData: null, pendingFeedPayload: null });
  },

  restoreWorkout: () => {
    // Called from both the splash preload and TabNavigator. Only the first call
    // restores; a second one would reset the timer and overwrite the store with
    // the saved copy, dropping anything changed in between.
    if (_workoutRestored) return Promise.resolve();
    if (!_restoring) _restoring = _restoreSavedWorkout(set, get).finally(() => { _restoring = null; });
    return _restoring;
  },

  showSheet: () => set({ sheetVisible: true }),
  hideSheet: () => set({ sheetVisible: false }),

  dismissSummary: () => {
    _undoSnapshot = null;
    set({
      showSummary: false,
      summaryData: null,
      pendingFeedPayload: null,
      sheetVisible: false,
      startTime: null,
      elapsedSeconds: 0,
    });
  },

  commitFeedPost: async (opts) => {
    const payload = get().pendingFeedPayload;
    if (!payload) return;
    // Clear immediately so a double-tap can't double-post
    set({ pendingFeedPayload: null });

    const visibility = opts?.visibility ?? 'public';
    // Private: don't create a feed row at all. Workout already saved to DB.
    if (visibility === 'private') {
      return;
    }

    const title = opts?.title?.trim() || null;
    const caption = opts?.caption?.trim() || null;
    const finalPayload = {
      ...payload,
      friends_only: visibility === 'friends',
      ...(title ? { title } : {}),
      ...(caption ? { caption } : {}),
    };

    try {
      const { error } = await supabase.from('activity_feed').insert(finalPayload);
      if (__DEV__ && error) console.error('[commitFeedPost] insert error:', JSON.stringify(error));
    } catch (e) {
      if (__DEV__) console.error('[commitFeedPost] threw:', e);
    }
  },

  undoFinish: () => {
    const { summaryData } = get();
    const snap = _undoSnapshot;
    if (!summaryData || !snap) return;
    _undoSnapshot = null;

    // The workout stays saved; it's reopened under the same id, and finishing it
    // again replaces the saved copy (Discard deletes it). Nothing is deleted
    // here, so the workout can't be lost between Undo and finishing again.
    if (_timerInterval) clearInterval(_timerInterval);
    _workoutRestored = true;
    set({
      isActive: true,
      sheetVisible: true,
      exercises: snap.exercises,
      startTime: snap.startTime,
      elapsedSeconds: snap.startTime ? Math.floor((Date.now() - snap.startTime) / 1000) : summaryData.duration,
      restDuration: snap.restDuration,
      workoutTitle: snap.workoutTitle,
      restAnchor: null,
      startedFromRoutine: snap.startedFromRoutine,
      startedFromProgram: snap.startedFromProgram,
      programWeek: snap.programWeek,
      ghostUserName: snap.ghostUserName,
      workoutId: snap.workoutId,
      saveMode: 'replace',
      isResting: false,
      restRemaining: 0,
      restStartedAt: null,
      restEndedAt: null,
      showSummary: false,
      summaryData: null,
      pendingFeedPayload: null,
    });
    _timerInterval = setInterval(() => get().tick(), 1000);
    get()._persist();
    startWorkoutActivity(_buildSnapshot(get()));
  },

  // ── Exercise and set management (activeWorkout/exerciseActions) ──

  ...createExerciseActions(set, get, { isFinishing: () => _finishing !== null, newExerciseId: _newExerciseId }),

  setRestDuration: (seconds) => {
    // While resting, restDuration is re-anchored to the remaining time, so the
    // delta must come from the previous preference, not restDuration.
    const prevPreferred = _preferredRestDuration;
    _preferredRestDuration = seconds;
    saveRestPreference(seconds);

    const { isResting, restRemaining: prevRemaining, restTotal: prevTotal } = get();
    if (!isResting) {
      set({ restDuration: seconds });
      get()._persist();
      return;
    }

    // Apply the change to the running timer by the same delta.
    const delta = seconds - prevPreferred;
    const newRemaining = prevRemaining + delta;

    if (newRemaining <= 0) {
      get().stopRest();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // Re-anchor so restStartedAt + restDuration is always the real end time
    // (the Live Activity and crash-restore both compute the end that way).
    set({
      restDuration: newRemaining,
      restRemaining: newRemaining,
      restTotal: Math.max(prevTotal + delta, newRemaining),
      restStartedAt: Date.now(),
    });
    _scheduleRestNotification(newRemaining);
    updateWorkoutActivity(_buildSnapshot(get()));
    get()._persist();
  },

  startRest: () => {
    // Pick up any preference change made during a previous rest.
    const restDuration = _preferredRestDuration;
    set({ isResting: true, restDuration, restTotal: restDuration, restRemaining: restDuration, restStartedAt: Date.now(), restEndedAt: null });
    updateWorkoutActivity(_buildSnapshot(get()));

    // Await cancel before scheduling to avoid race condition on Android
    _scheduleRestNotification(restDuration);
  },

  stopRest: () => {
    set({ isResting: false, restRemaining: 0, restStartedAt: null });
    updateWorkoutActivity(_buildSnapshot(get()));
    Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
    get()._persist();
  },

  adjustRest: (deltaSeconds) => {
    const { isResting, restRemaining, restTotal } = get();
    if (!isResting) return;
    const newRemaining = restRemaining + deltaSeconds;
    if (newRemaining <= 0) {
      get().stopRest();
      return;
    }
    const newTotal = Math.max(restTotal + deltaSeconds, newRemaining);
    set({ restDuration: newRemaining, restRemaining: newRemaining, restTotal: newTotal, restStartedAt: Date.now() });
    _scheduleRestNotification(newRemaining);
    updateWorkoutActivity(_buildSnapshot(get()));
    get()._persist();
  },

  tick: () => {
    const { startTime, isResting, restDuration, restStartedAt } = get();
    const patch: Partial<ActiveWorkoutState> = {};

    if (startTime) {
      patch.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }

    if (isResting && restStartedAt) {
      const elapsed = Math.floor((Date.now() - restStartedAt) / 1000);
      const remaining = Math.max(0, restDuration - elapsed);
      if (remaining <= 0) {
        // Apply elapsed update first, then stop rest (separate set to avoid stale merge)
        if (patch.elapsedSeconds !== undefined) set(patch);
        get().stopRest();
        set({ restEndedAt: Date.now() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      patch.restRemaining = remaining;
    }

    // Single batched set() — one render cycle instead of two
    if (Object.keys(patch).length > 0) set(patch);
  },

  // ── Internal ──────────────────────────────────────

  _persist: () => {
    if (!_workoutRestored) return; // Don't persist before restore has run
    if (_persistTimeout) clearTimeout(_persistTimeout);
    _persistTimeout = setTimeout(() => {
      const { isActive, startTime, exercises, restDuration, restStartedAt, restTotal, startedFromRoutine, startedFromProgram, programWeek, workoutTitle, restAnchor, ghostUserName, workoutId, saveMode } = get();
      if (!isActive || !startTime) return;
      const userId = useAuthStore.getState().user?.id ?? null;
      saveWorkout({ startTime, exercises, restDuration, restStartedAt, restTotal, startedFromRoutine, startedFromProgram, programWeek, workoutTitle, restAnchor, ghostUserName, workoutId, saveMode, userId });
    }, 500);
  },
}));
