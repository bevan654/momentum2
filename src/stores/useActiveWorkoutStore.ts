import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase, rebuildClient } from '../lib/supabase';
import { saveWorkout, loadWorkoutAsync, clearWorkout, saveRestPreference, loadRestPreference, addPendingWorkoutDelete, loadPendingWorkoutDeletes, removePendingWorkoutDeletes } from '../utils/workoutStorage';
import { buildWorkoutPayload } from '../utils/workoutPayload';
import { buildFeedExerciseDetails } from '../utils/feedExerciseDetails';
import { suggestSets } from '../utils/exerciseProgress';
import { makeUuid } from '../utils/uuid';
import { useWorkoutStore } from './useWorkoutStore';
import { useStreakStore } from './useStreakStore';
import { useRankStore } from './useRankStore';
import { useProgramStore } from './useProgramStore';
import { useRoutineStore } from './useRoutineStore';
import { useAuthStore } from './useAuthStore';
import { useWeightStore } from './useWeightStore';
import { startWorkoutActivity, updateWorkoutActivity, stopWorkoutActivity, clearStaleWorkoutActivity } from '../services/liveActivityManager';
import type { WorkoutActivitySnapshot } from '../services/liveActivityManager';

const REST_NOTIF_ID = 'rest-timer';
const SUPABASE_TIMEOUT = 20_000; // 20s per request

/** Race a promise against a timeout — rejects with an error if it takes too long */
function withTimeout<T>(promise: PromiseLike<T>, ms: number = SUPABASE_TIMEOUT): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([Promise.resolve(promise), timer]).finally(() => clearTimeout(id));
}

/**
 * Run a Supabase query with a timeout; on timeout, rebuild the wedged client
 * and retry once. After backgrounding, the client's auth lock can be stuck so
 * requests hang before ever reaching the network (supabase/supabase#36046) —
 * a rebuild + retry recovers without the user force-closing the app. Takes a
 * factory because a PostgrestBuilder can't be re-executed after it settles.
 */
async function runWithRecovery<T>(makeQuery: () => PromiseLike<T>): Promise<T> {
  try {
    return await withTimeout(makeQuery());
  } catch (e: any) {
    if (e?.message !== 'Request timed out') throw e;
    console.warn('[runWithRecovery] request hung — rebuilding supabase client and retrying');
    rebuildClient();
    return await withTimeout(makeQuery());
  }
}

// ── Types ──────────────────────────────────────────────

export interface ActiveSet {
  kg: string;
  reps: string;
  completed: boolean;
  set_type: 'working' | 'warmup' | 'drop' | 'failure';
  parent_set_number: number | null;
  /** When the set was ticked off (ms). Cleared when it's unticked. */
  completedAt?: number | null;
  /** The weight and reps the app suggested when the set was ticked off. */
  target?: { kg: number; reps: number; source: 'progression' | 'previous' } | null;
}

export interface ActiveExercise {
  /** Stable per-session id, used as the React key so cards survive reorder/remove. */
  id: string;
  name: string;
  exercise_type: 'weighted' | 'bodyweight' | 'duration' | 'weighted+bodyweight';
  category: string | null;
  sets: ActiveSet[];
  prevSets: { kg: number; reps: number }[];
  supersetWith: number | null;
  notes?: string;
  /** Color tag for today's note: 'green' | 'orange' | 'red' (undefined = none) */
  noteColor?: string;
  /** Note history from previous sessions, newest first (read-only) */
  prevNotes?: { note: string; date: string; color?: string }[];
}

export interface SummaryExercise {
  name: string;
  category: string | null;
  exercise_type: string;
  sets: { kg: number; reps: number; completed: boolean; set_type: string; parent_set_number: number | null }[];
}

export interface GhostExerciseData {
  name: string;
  sets: { kg: number; reps: number }[];
}

export interface WorkoutSummary {
  workoutId?: string;
  duration: number;
  totalVolume: number;
  totalSets: number;
  totalExercises: number;
  exerciseNames: string[];
  exercises: SummaryExercise[];
  prCount: number;
  ghostUserName?: string | null;
  ghostExercises?: GhostExerciseData[];
  /** Snapshot of prevMap at finish time so background refetches don't overwrite it */
  prevMap?: Record<string, { kg: number; reps: number }[]>;
}

// ── Constants ──────────────────────────────────────────

const EMPTY_SET: ActiveSet = {
  kg: '',
  reps: '',
  completed: false,
  set_type: 'working',
  parent_set_number: null,
};

const EXERCISE_TYPE_CYCLE: Record<string, string> = {
  weighted: 'bodyweight',
  bodyweight: 'duration',
  duration: 'weighted+bodyweight',
  'weighted+bodyweight': 'weighted',
};

const SET_TYPE_CYCLE: Record<string, string> = {
  working: 'warmup',
  warmup: 'drop',
  drop: 'failure',
  failure: 'working',
};

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

/** The user's preferred rest length (what each new rest starts at). */
export type RestAnchor = { exerciseIndex: number; setIndex: number } | null;

/** Keep the rest anchor on the same set when a set is inserted before it. */
function _shiftAnchorForInsert(anchor: RestAnchor, exerciseIndex: number, insertAt: number): RestAnchor {
  if (!anchor || anchor.exerciseIndex !== exerciseIndex || anchor.setIndex < insertAt) return anchor;
  return { ...anchor, setIndex: anchor.setIndex + 1 };
}

export function getPreferredRestDuration(): number {
  return _preferredRestDuration;
}

// ── Store interface ────────────────────────────────────

interface ActiveWorkoutState {
  isActive: boolean;
  sheetVisible: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  exercises: ActiveExercise[];

  /** Seconds from restStartedAt until the current rest ends (restStartedAt + restDuration = end). */
  restDuration: number;
  restRemaining: number;
  restStartedAt: number | null;
  isResting: boolean;
  /** Full length of the current rest incl. ±15s adjustments — for the progress bar only. */
  restTotal: number;
  /** When the last rest ran out on its own (not skipped) — drives the "rest done" moment. */
  restEndedAt: number | null;
  /** Routine / program-day name shown in the header; null = plain workout. */
  workoutTitle: string | null;
  /** The set whose completion started the current/last rest — the inline rest row renders under it. */
  restAnchor: RestAnchor;

  // Summary + share
  showSummary: boolean;
  summaryData: WorkoutSummary | null;
  pendingFeedPayload: Record<string, any> | null;

  startedFromRoutine: string | null;
  startedFromProgram: string | null;
  programWeek: number | null;
  ghostUserName: string | null;
  /** The workout's id in the database, generated when it starts so saving it twice can't duplicate it. */
  workoutId: string | null;
  /** 'replace' after Undo: the workout is already saved, and finishing again overwrites it. */
  saveMode: 'create' | 'replace';

  // Workout lifecycle
  startWorkout: () => void;
  startFromRoutine: (
    routine: { id: string; name?: string; exercises: { name: string; default_sets: number; exercise_type: string }[] },
    catalogMap: Record<string, { category: string; exercise_type: string }>,
    prevMap: Record<string, { kg: number; reps: number }[]>,
    ghostUserName?: string,
  ) => void;
  startFromProgram: (
    routine: { id: string; name?: string; exercises: { name: string; default_sets: number; exercise_type: string }[] },
    catalogMap: Record<string, { category: string; exercise_type: string }>,
    prevMap: Record<string, { kg: number; reps: number }[]>,
    programId: string,
    programWeek: number,
  ) => void;
  discardWorkout: () => void;
  finishWorkout: (userId: string, durationOverride?: number) => Promise<{
    error: string | null;
    incompleteCount?: number;
    workoutId?: string;
  }>;
  restoreWorkout: () => Promise<void>;
  /** Signing out: drop the in-memory workout (its saved copy stays for the same account). */
  resetForSignOut: () => void;
  showSheet: () => void;
  hideSheet: () => void;
  dismissSummary: () => void;
  commitFeedPost: (opts?: {
    visibility?: 'public' | 'friends' | 'private';
    title?: string;
    caption?: string;
  }) => Promise<void>;
  undoFinish: () => void;

  // Exercise management
  addExercise: (name: string, exerciseType: string, category: string | null, prevSets?: { kg: number; reps: number }[]) => void;
  removeExercise: (index: number) => void;
  replaceExercise: (index: number, name: string, exerciseType: string, category: string | null, prevSets: { kg: number; reps: number }[]) => void;
  moveExercise: (fromIndex: number, direction: 'up' | 'down') => void;
  cycleExerciseType: (index: number) => void;
  setExerciseNotes: (index: number, notes: string) => void;
  setExerciseNoteColor: (index: number, color: string | undefined) => void;

  // Set management
  addSet: (exerciseIndex: number) => void;
  addDropSet: (exerciseIndex: number, parentSetIndex: number) => void;
  duplicateSet: (exerciseIndex: number, setIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: 'kg' | 'reps', value: string) => void;
  toggleSetComplete: (exerciseIndex: number, setIndex: number) => void;
  cycleSetType: (exerciseIndex: number, setIndex: number) => void;

  // Superset
  linkSuperset: (exerciseIndex: number) => void;
  unlinkSuperset: (exerciseIndex: number) => void;

  // Rest timer
  setRestDuration: (seconds: number) => void;
  startRest: () => void;
  stopRest: () => void;
  /** Add or remove time from the running rest (e.g. ±15s). Ending at ≤0 stops the rest. */
  adjustRest: (deltaSeconds: number) => void;
  tick: () => void;

  // Internal
  _persist: () => void;
}

// ── Live Activity snapshot helper ──────────────────────

let _exerciseSeq = 0;
/** Unique within a device session; only used for React keys, never stored in the DB. */
function _newExerciseId(): string {
  _exerciseSeq += 1;
  return `ex-${Date.now().toString(36)}-${_exerciseSeq}`;
}

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

function _buildSnapshot(
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

/**
 * Cancel any pending rest notification, then schedule a new one.
 * Awaits the cancel so Android doesn't race and kill the new one.
 * Uses the high-priority 'rest_timer' channel on Android for exact delivery.
 */
async function _scheduleRestNotification(seconds: number) {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID);
  } catch {}
  Notifications.scheduleNotificationAsync({
    identifier: REST_NOTIF_ID,
    content: {
      title: 'Rest Complete!',
      body: 'Time for your next set.',
      sound: 'default',
      data: { type: 'rest_complete' },
      ...(Platform.OS === 'android' ? { channelId: 'rest_timer' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  }).catch(() => {});
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
  if (saved.restStartedAt) {
    const restElapsed = Math.floor((Date.now() - saved.restStartedAt) / 1000);
    const remaining = Math.max(0, saved.restDuration - restElapsed);
    if (remaining > 0) {
      isResting = true;
      restRemaining = remaining;
      restStartedAt = saved.restStartedAt;
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
    restTotal: restRemaining,
    restEndedAt: null,
  });

  _workoutRestored = true;
  _timerInterval = setInterval(() => get().tick(), 1000);
  startWorkoutActivity(_buildSnapshot(get()));
}

type FinishResult = { error: string | null; incompleteCount?: number; workoutId?: string };

/** The workout as it was when finished, so Undo can reopen it exactly (same id, sets, notes, context). */
type UndoSnapshot = Pick<
  ActiveWorkoutState,
  'exercises' | 'startTime' | 'restDuration' | 'workoutTitle' | 'startedFromRoutine' | 'startedFromProgram' | 'programWeek' | 'ghostUserName'
> & { workoutId: string };

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
  // Program day: the weekday the workout was started on (0 = Monday)
  let programDayOfWeek: number | null = null;
  let programDayLabel: string | null = null;
  if (startedFromProgram) {
    const jsDay = new Date(start).getDay();
    programDayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
    const prog = useProgramStore.getState().programs.find((p) => p.id === startedFromProgram);
    programDayLabel = prog?.days.find((d) => d.day_of_week === programDayOfWeek)?.label || null;
  }

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

  const totalVolume = built.totalVolume;
  const totalSets = built.totalSets;
  const exerciseNames = filteredExercises.map((ex) => ex.name);

  // One call saves the workout, its exercises and sets in a single transaction
  // (upsert_workout). It's keyed by workoutId, so retrying after a timeout or a
  // lost response can't save the workout twice.
  console.log('[finishWorkout] saving workout', workoutId, built.payload.mode);
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
      console.warn('[finishWorkout] already saved by an earlier attempt — replacing it');
      ({ error: saveErr } = await runWithRecovery(() =>
        supabase.rpc('upsert_workout', { p: { ...built.payload, mode: 'replace' } })
      ));
    }
    if (saveErr) {
      console.error('[finishWorkout] save error:', saveErr);
      restoreTimer();
      return { error: 'Failed to save workout — check your connection and try again.' };
    }
  } catch (e: any) {
    console.error('[finishWorkout] save threw:', e);
    restoreTimer();
    return { error: 'Failed to save workout — check your connection and try again.' };
  }
  const workout = { id: workoutId };

  if (gen !== _sessionGen) {
    // Signed out while saving: the workout is saved under the previous account,
    // so drop its stored copy, but don't open its summary (or Undo) for whoever
    // is signed in now.
    const stored = await loadWorkoutAsync();
    if (stored?.workoutId === workoutId) clearWorkout();
    return { error: null, incompleteCount, workoutId };
  }

  console.log('[finishWorkout] done, showing summary');

  // Non-critical operations — fire and forget, never block summary
  try {
    let ghostResult: string | null = null;
    if (ghostUserName) {
      let w = 0, l = 0;
      for (const ex of filteredExercises) {
        const completed = ex.sets.filter((s: any) => s.completed);
        for (let i = 0; i < Math.min(completed.length, ex.prevSets.length); i++) {
          const uk = parseFloat(completed[i].kg) || 0, ur = parseInt(completed[i].reps) || 0;
          const gk = ex.prevSets[i].kg, gr = ex.prevSets[i].reps;
          if (uk < gk) l++;
          else if (uk === gk) { if (ur > gr) w++; else if (ur < gr) l++; }
          else { if (uk * ur > gk * gr) w++; else if (uk * ur < gk * gr) l++; }
        }
      }
      ghostResult = w > l ? 'victory' : l > w ? 'defeated' : 'draw';
    }
    console.log('[finishWorkout] feed insert starting, ghost:', ghostUserName, ghostResult);

    // Resolve routine context for feed
    let routineFeedData: Record<string, any> = {};
    if (get().startedFromRoutine) {
      const routines = useRoutineStore.getState().routines;
      const routine = routines.find((r) => r.id === get().startedFromRoutine);
      if (routine) {
        routineFeedData = { routine_name: routine.name };
      }
    }

    // Resolve program context for feed
    let programFeedData: Record<string, any> = {};
    console.log('[finishWorkout] program context:', get().startedFromProgram, get().programWeek);
    if (get().startedFromProgram) {
      const { programs, getDurationWeeks } = useProgramStore.getState();
      console.log('[finishWorkout] programs in store:', programs.length);
      const prog = programs.find((p) => p.id === get().startedFromProgram);
      console.log('[finishWorkout] matched program:', prog?.name ?? 'NOT FOUND');
      if (prog) {
        // The day the workout was started on, as saved on the workout row
        const dayEntry = prog.days.find((d) => d.day_of_week === programDayOfWeek);
        programFeedData = {
          program_id: prog.id,
          program_name: prog.name,
          program_week: get().programWeek,
          program_total_weeks: getDurationWeeks(prog) || null,
          program_day_label: dayEntry?.label || null,
        };
      }
    }

    // Build per-exercise detail snapshot for the feed
    const { catalogMap } = useWorkoutStore.getState();
    const exerciseDetailsJson = buildFeedExerciseDetails(filteredExercises, catalogMap);

    const feedPayload = {
      user_id: userId,
      workout_id: workout!.id,
      duration,
      total_volume: Math.round(totalVolume),
      exercise_names: exerciseNames,
      total_exercises: filteredExercises.length,
      total_sets: totalSets,
      exercise_details: exerciseDetailsJson,
      ...routineFeedData,
      ...programFeedData,
      ...(ghostUserName ? {
        ghost_username: ghostUserName,
        ghost_result: ghostResult,
        ghost_exercises: filteredExercises.map((ex) => ({
          name: ex.name,
          sets: ex.prevSets.map((ps: any) => ({ kg: ps.kg, reps: ps.reps })),
        })),
      } : {}),
    };
    console.log('[finishWorkout] feed payload prepared, deferred until share confirm');
    // Deferred: actual insert happens when the user taps Post on the Share screen
    // (or skips, in which case it does not post). See commitFeedPost / dismissShare.
    set({ pendingFeedPayload: feedPayload });
  } catch (feedCrash) {
    console.error('[finishWorkout] feed block crashed:', feedCrash);
  }

  try {
    const { refreshStreak } = useStreakStore.getState();
    refreshStreak(userId).catch(() => {});
  } catch {}

  try {
    useRankStore.getState().updateFromWorkout(
      filteredExercises.map((ex) => ({
        name: ex.name,
        exercise_type: ex.exercise_type,
        sets: ex.sets.map((s) => ({
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
          set_type: s.set_type,
        })),
      })),
      userId,
    );
  } catch {}

  const summaryExercises: SummaryExercise[] = filteredExercises.map((ex) => ({
    name: ex.name,
    category: ex.category,
    exercise_type: ex.exercise_type,
    sets: ex.sets.map((s) => ({
      kg: parseFloat(s.kg) || 0,
      reps: parseInt(s.reps, 10) || 0,
      completed: s.completed,
      set_type: s.set_type,
      parent_set_number: s.parent_set_number,
    })),
  }));

  const summaryData: WorkoutSummary = {
    workoutId: workout!.id,
    duration,
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalExercises: filteredExercises.length,
    exerciseNames,
    exercises: summaryExercises,
    prCount: 0,
    ghostUserName: ghostUserName || null,
    ghostExercises: ghostUserName ? filteredExercises.map((ex) => ({
      name: ex.name,
      sets: ex.prevSets.map((s) => ({ kg: s.kg, reps: s.reps })),
    })) : undefined,
    prevMap: { ...useWorkoutStore.getState().prevMap },
  };

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

  stopWorkoutActivity();
  Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
  if (_persistTimeout) { clearTimeout(_persistTimeout); _persistTimeout = null; }
  _workoutRestored = false;
  set({
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
    showSummary: true,
    summaryData,
  });

  clearWorkout();
  return { error: null, incompleteCount, workoutId: workout!.id };

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

    _timerInterval = setInterval(() => get().tick(), 1000);
    // Defer heavy async work so the sheet mounts instantly
    setTimeout(() => {
      get()._persist();
      startWorkoutActivity(_buildSnapshot(get()));
    }, 0);
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

    _timerInterval = setInterval(() => get().tick(), 1000);
    // Defer heavy async work so the sheet mounts instantly
    setTimeout(() => {
      get()._persist();
      startWorkoutActivity(_buildSnapshot(get()));
    }, 0);
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
          console.warn('[discardWorkout] delete of the undone workout failed:', error);
          if (ownerId) addPendingWorkoutDelete(workoutId, ownerId).catch(() => {});
          return;
        }
        const userId = useAuthStore.getState().user?.id;
        if (userId) useWorkoutStore.getState().fetchWorkoutHistory(userId);
      }, () => { if (ownerId) addPendingWorkoutDelete(workoutId, ownerId).catch(() => {}); });
    }
    stopWorkoutActivity();
    Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    if (_persistTimeout) { clearTimeout(_persistTimeout); _persistTimeout = null; }
    _workoutRestored = false;
    set({
      isActive: false,
      sheetVisible: false,
      startTime: null,
      elapsedSeconds: 0,
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
      restEndedAt: null,
      showSummary: false,
      summaryData: null,
    });
    clearWorkout();
  },

  finishWorkout: (userId: string, durationOverride?: number) => {
    // A second call while saving (double tap) shares the first save instead of starting another.
    if (!_finishing) _finishing = _finishWorkout(set, get, userId, durationOverride).finally(() => { _finishing = null; });
    return _finishing;
  },

  resetForSignOut: () => {
    _sessionGen++;
    _restoring = null; // an in-flight restore is for the previous account; the next call starts afresh
    stopWorkoutActivity();
    Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    if (_persistTimeout) { clearTimeout(_persistTimeout); _persistTimeout = null; }
    _workoutRestored = false;
    _undoSnapshot = null;
    set({
      isActive: false,
      sheetVisible: false,
      startTime: null,
      elapsedSeconds: 0,
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
      showSummary: false,
      summaryData: null,
      pendingFeedPayload: null,
    });
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
      console.log('[commitFeedPost] private — skipping feed insert');
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
      if (error) console.error('[commitFeedPost] insert error:', JSON.stringify(error));
      else console.log('[commitFeedPost] feed insert ok');
    } catch (e) {
      console.error('[commitFeedPost] threw:', e);
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

  // ── Exercise management ───────────────────────────

  addExercise: (name, exerciseType, category, prevSets = []) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    const prevNotes = useWorkoutStore.getState().prevNoteMap[name] || undefined;
    set((s) => ({
      exercises: [
        ...s.exercises,
        {
          id: _newExerciseId(),
          name,
          exercise_type: exerciseType as ActiveExercise['exercise_type'],
          category,
          sets: [{ ...EMPTY_SET }],
          prevSets,
          supersetWith: null,
          prevNotes,
        },
      ],
    }));
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  removeExercise: (index) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = s.exercises.filter((_, i) => i !== index);
      const a = s.restAnchor;
      const restAnchor = !a || a.exerciseIndex < index ? a
        : a.exerciseIndex === index ? null
        : { ...a, exerciseIndex: a.exerciseIndex - 1 };
      // Fix superset refs
      return {
        restAnchor,
        exercises: exercises.map((ex, i) => {
          let sw = ex.supersetWith;
          if (sw === null) return ex;
          if (sw === index) sw = null; // partner removed
          else if (sw > index) sw = sw - 1; // shift down
          return { ...ex, supersetWith: sw };
        }),
      };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  replaceExercise: (index, name, exerciseType, category, prevSets) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      exercises[index] = {
        ...exercises[index],
        id: _newExerciseId(),
        name,
        exercise_type: exerciseType as ActiveExercise['exercise_type'],
        category,
        prevSets,
      };
      const restAnchor = s.restAnchor?.exerciseIndex === index ? null : s.restAnchor;
      return { exercises, restAnchor };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  moveExercise: (fromIndex, direction) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= s.exercises.length) return s;

      const exercises = [...s.exercises];
      [exercises[fromIndex], exercises[toIndex]] = [exercises[toIndex], exercises[fromIndex]];
      const a = s.restAnchor;
      const restAnchor = !a ? a
        : a.exerciseIndex === fromIndex ? { ...a, exerciseIndex: toIndex }
        : a.exerciseIndex === toIndex ? { ...a, exerciseIndex: fromIndex }
        : a;

      // Fix superset refs
      return {
        restAnchor,
        exercises: exercises.map((ex) => {
          let sw = ex.supersetWith;
          if (sw === null) return ex;
          if (sw === fromIndex) sw = toIndex;
          else if (sw === toIndex) sw = fromIndex;
          return { ...ex, supersetWith: sw };
        }),
      };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  cycleExerciseType: (index) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = exercises[index];
      exercises[index] = {
        ...ex,
        exercise_type: (EXERCISE_TYPE_CYCLE[ex.exercise_type] || 'weighted') as ActiveExercise['exercise_type'],
      };
      return { exercises };
    });
    get()._persist();
  },

  setExerciseNotes: (index, notes) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      if (!exercises[index]) return s;
      exercises[index] = { ...exercises[index], notes };
      return { exercises };
    });
    get()._persist();
  },

  setExerciseNoteColor: (index, color) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      if (!exercises[index]) return s;
      exercises[index] = { ...exercises[index], noteColor: color };
      return { exercises };
    });
    get()._persist();
  },

  // ── Set management ────────────────────────────────

  addSet: (exerciseIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      ex.sets = [...ex.sets, { ...EMPTY_SET }];
      exercises[exerciseIndex] = ex;
      return { exercises };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  addDropSet: (exerciseIndex, parentSetIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      const sets = [...ex.sets];
      const parentSetNumber = parentSetIndex + 1; // 1-indexed
      // Find insertion point: after the last consecutive drop child of this parent
      let insertAt = parentSetIndex + 1;
      while (
        insertAt < sets.length &&
        sets[insertAt].set_type === 'drop' &&
        sets[insertAt].parent_set_number === parentSetNumber
      ) {
        insertAt++;
      }
      const dropSet: ActiveSet = {
        kg: '',
        reps: '',
        completed: false,
        set_type: 'drop',
        parent_set_number: parentSetNumber,
      };
      sets.splice(insertAt, 0, dropSet);
      ex.sets = sets;
      exercises[exerciseIndex] = ex;
      return { exercises, restAnchor: _shiftAnchorForInsert(s.restAnchor, exerciseIndex, insertAt) };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  duplicateSet: (exerciseIndex, setIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      const sets = [...ex.sets];
      const original = sets[setIndex];
      if (!original) return s;

      // For non-drop sets, insert AFTER any drop children so the drop chain stays contiguous.
      // For drop sets, insert immediately after (preserving the drop chain).
      let insertAt = setIndex + 1;
      if (original.set_type !== 'drop') {
        const parentNum = setIndex + 1;
        while (
          insertAt < sets.length &&
          sets[insertAt].set_type === 'drop' &&
          sets[insertAt].parent_set_number === parentNum
        ) {
          insertAt++;
        }
      }

      const dup: ActiveSet = {
        kg: original.kg,
        reps: original.reps,
        completed: false,
        set_type: original.set_type,
        parent_set_number: original.parent_set_number,
      };
      sets.splice(insertAt, 0, dup);

      // Bump parent_set_number for any drop sets whose parent index shifted by the insertion
      for (let i = insertAt + 1; i < sets.length; i++) {
        const cur = sets[i];
        if (cur.set_type === 'drop' && cur.parent_set_number != null && cur.parent_set_number >= insertAt + 1) {
          sets[i] = { ...cur, parent_set_number: cur.parent_set_number + 1 };
        }
      }

      ex.sets = sets;
      exercises[exerciseIndex] = ex;
      return { exercises, restAnchor: _shiftAnchorForInsert(s.restAnchor, exerciseIndex, insertAt) };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  removeSet: (exerciseIndex, setIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      const oldSets = ex.sets;
      const deletedSet = oldSets[setIndex];

      // Build set of indices to remove
      const removeIndices = new Set<number>([setIndex]);
      if (deletedSet.set_type !== 'drop') {
        // Cascade-remove drop children of this parent
        const parentSetNumber = setIndex + 1;
        for (let i = 0; i < oldSets.length; i++) {
          if (oldSets[i].set_type === 'drop' && oldSets[i].parent_set_number === parentSetNumber) {
            removeIndices.add(i);
          }
        }
      }

      const newSets = oldSets.filter((_, i) => !removeIndices.has(i));
      if (newSets.length === 0) return s; // Keep at least one set

      // Reindex: map old 1-indexed positions to new for surviving non-drop sets
      const posMap = new Map<number, number>();
      let newPos = 0;
      for (let i = 0; i < oldSets.length; i++) {
        if (!removeIndices.has(i)) {
          newPos++;
          if (oldSets[i].set_type !== 'drop') {
            posMap.set(i + 1, newPos);
          }
        }
      }

      ex.sets = newSets.map((st) => {
        if (st.set_type === 'drop' && st.parent_set_number !== null) {
          const newParent = posMap.get(st.parent_set_number);
          return { ...st, parent_set_number: newParent ?? null };
        }
        return st;
      });

      exercises[exerciseIndex] = ex;
      let restAnchor = s.restAnchor;
      if (restAnchor && restAnchor.exerciseIndex === exerciseIndex) {
        if (removeIndices.has(restAnchor.setIndex)) restAnchor = null;
        else {
          let below = 0;
          removeIndices.forEach((i) => { if (i < restAnchor!.setIndex) below++; });
          restAnchor = { ...restAnchor, setIndex: restAnchor.setIndex - below };
        }
      }
      return { exercises, restAnchor };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  updateSet: (exerciseIndex, setIndex, field, value) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      const sets = [...ex.sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      ex.sets = sets;
      exercises[exerciseIndex] = ex;
      return { exercises };
    });
    get()._persist();
  },

  toggleSetComplete: (exerciseIndex, setIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    const exercises = [...get().exercises];
    const ex = { ...exercises[exerciseIndex] };
    const sets = [...ex.sets];
    const wasCompleted = sets[setIndex].completed;

    // A set can only be completed once it has the required inputs:
    // reps for every type, plus kg for straight weighted exercises.
    if (!wasCompleted) {
      const cur = sets[setIndex];
      const needsKg = ex.exercise_type === 'weighted';
      if (cur.reps.trim() === '' || (needsKg && cur.kg.trim() === '')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
    }
    if (wasCompleted) {
      sets[setIndex] = { ...sets[setIndex], completed: false, completedAt: null, target: null };
    } else {
      // What the set row was suggesting (the friend's set in ghost mode, else the progression hint)
      const ghostPrev = get().ghostUserName ? ex.prevSets[setIndex] : undefined;
      const suggested = ghostPrev ? null : suggestSets(ex.sets, ex.prevSets, ex.exercise_type)[setIndex];
      const target = ghostPrev
        ? { kg: ghostPrev.kg, reps: ghostPrev.reps, source: 'previous' as const }
        : suggested
          ? { kg: suggested.kg, reps: suggested.reps, source: 'progression' as const }
          : null;
      sets[setIndex] = { ...sets[setIndex], completed: true, completedAt: Date.now(), target };
    }
    ex.sets = sets;
    exercises[exerciseIndex] = ex;
    set({ exercises });

    if (!wasCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      set({ restAnchor: { exerciseIndex, setIndex } });
      get().startRest();
    }

    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  cycleSetType: (exerciseIndex, setIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      const sets = [...ex.sets];
      const current = sets[setIndex].set_type;
      let next = (SET_TYPE_CYCLE[current] || 'working') as ActiveSet['set_type'];

      // When cycling to 'drop', find nearest preceding working set as parent
      let parentSetNumber: number | null = null;
      if (next === 'drop') {
        for (let i = setIndex - 1; i >= 0; i--) {
          if (sets[i].set_type === 'working' || sets[i].set_type === 'warmup' || sets[i].set_type === 'failure') {
            // Use the nearest non-drop set as parent (typically a working set)
            if (sets[i].set_type === 'working') {
              parentSetNumber = i + 1; // 1-indexed
              break;
            }
          }
        }
        // No valid parent found — skip 'drop', go to 'failure'
        if (parentSetNumber === null) {
          next = 'failure';
        }
      }

      sets[setIndex] = {
        ...sets[setIndex],
        set_type: next,
        parent_set_number: next === 'drop' ? parentSetNumber : null,
      };
      ex.sets = sets;
      exercises[exerciseIndex] = ex;
      return { exercises };
    });
    get()._persist();
  },

  // ── Superset ──────────────────────────────────────

  linkSuperset: (exerciseIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const nextIdx = exerciseIndex + 1;
      if (nextIdx >= s.exercises.length) return s;
      const exercises = [...s.exercises];

      // Clear any existing partners on either side before re-linking
      const existingA = exercises[exerciseIndex].supersetWith;
      if (existingA !== null && existingA !== nextIdx && exercises[existingA]) {
        exercises[existingA] = { ...exercises[existingA], supersetWith: null };
      }
      const existingB = exercises[nextIdx].supersetWith;
      if (existingB !== null && existingB !== exerciseIndex && exercises[existingB]) {
        exercises[existingB] = { ...exercises[existingB], supersetWith: null };
      }

      exercises[exerciseIndex] = { ...exercises[exerciseIndex], supersetWith: nextIdx };
      exercises[nextIdx] = { ...exercises[nextIdx], supersetWith: exerciseIndex };
      return { exercises };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  unlinkSuperset: (exerciseIndex) => {
    if (_finishing) return; // the workout is being saved; a change now wouldn't be in it
    set((s) => {
      const exercises = [...s.exercises];
      const partnerIdx = exercises[exerciseIndex].supersetWith;
      exercises[exerciseIndex] = { ...exercises[exerciseIndex], supersetWith: null };
      if (partnerIdx !== null && exercises[partnerIdx]) {
        exercises[partnerIdx] = { ...exercises[partnerIdx], supersetWith: null };
      }
      return { exercises };
    });
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  // ── Rest timer ────────────────────────────────────

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
      const { isActive, startTime, exercises, restDuration, restStartedAt, startedFromRoutine, startedFromProgram, programWeek, workoutTitle, restAnchor, ghostUserName, workoutId, saveMode } = get();
      if (!isActive || !startTime) return;
      const userId = useAuthStore.getState().user?.id ?? null;
      saveWorkout({ startTime, exercises, restDuration, restStartedAt, startedFromRoutine, startedFromProgram, programWeek, workoutTitle, restAnchor, ghostUserName, workoutId, saveMode, userId });
    }, 500);
  },
}));
