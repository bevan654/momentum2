import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { saveWorkout, loadWorkoutAsync, clearWorkout, saveRestPreference, loadRestPreference } from '../utils/workoutStorage';
import { useWorkoutStore } from './useWorkoutStore';
import { useStreakStore } from './useStreakStore';
import { useRankStore } from './useRankStore';
import { useProgramStore } from './useProgramStore';
import { useRoutineStore } from './useRoutineStore';
import { useAuthStore } from './useAuthStore';
import { startWorkoutActivity, updateWorkoutActivity, stopWorkoutActivity } from '../services/liveActivityManager';
import { playBeep } from '../utils/beepSound';
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

// ── Types ──────────────────────────────────────────────

export interface ActiveSet {
  kg: string;
  reps: string;
  completed: boolean;
  set_type: 'working' | 'warmup' | 'drop' | 'failure';
  parent_set_number: number | null;
}

export interface ActiveExercise {
  name: string;
  exercise_type: 'weighted' | 'bodyweight' | 'duration' | 'weighted+bodyweight';
  category: string | null;
  sets: ActiveSet[];
  prevSets: { kg: number; reps: number }[];
  supersetWith: number | null;
}

export interface SummaryExercise {
  name: string;
  category: string | null;
  exercise_type: string;
  sets: { kg: number; reps: number; completed: boolean; set_type: string }[];
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
let _restResumeBase: number | null = null; // Remaining seconds when rest was resumed after pause
let _preferredRestDuration = 90; // Loaded from AsyncStorage at module init
loadRestPreference().then((d) => { _preferredRestDuration = d; });

// ── Store interface ────────────────────────────────────

interface ActiveWorkoutState {
  isActive: boolean;
  sheetVisible: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  exercises: ActiveExercise[];

  restDuration: number;
  restRemaining: number;
  restStartedAt: number | null;
  isResting: boolean;
  restPaused: boolean;

  // Summary
  showSummary: boolean;
  summaryData: WorkoutSummary | null;

  startedFromRoutine: string | null;
  startedFromProgram: string | null;
  programWeek: number | null;
  ghostUserName: string | null;

  // Stubs: HealthKit
  heartRate: number | null;
  activeCalories: number | null;

  // Workout lifecycle
  startWorkout: () => void;
  startFromRoutine: (
    routine: { id: string; exercises: { name: string; default_sets: number; exercise_type: string }[] },
    catalogMap: Record<string, { category: string; exercise_type: string }>,
    prevMap: Record<string, { kg: number; reps: number }[]>,
    ghostUserName?: string,
  ) => void;
  startFromProgram: (
    routine: { id: string; exercises: { name: string; default_sets: number; exercise_type: string }[] },
    catalogMap: Record<string, { category: string; exercise_type: string }>,
    prevMap: Record<string, { kg: number; reps: number }[]>,
    programId: string,
    programWeek: number,
  ) => void;
  discardWorkout: () => void;
  finishWorkout: (userId: string, durationOverride?: number) => Promise<{ error: string | null; incompleteCount?: number }>;
  restoreWorkout: () => Promise<void>;
  showSheet: () => void;
  hideSheet: () => void;
  dismissSummary: () => void;
  undoFinish: () => void;

  // Exercise management
  addExercise: (name: string, exerciseType: string, category: string | null, prevSets?: { kg: number; reps: number }[]) => void;
  removeExercise: (index: number) => void;
  replaceExercise: (index: number, name: string, exerciseType: string, category: string | null, prevSets: { kg: number; reps: number }[]) => void;
  moveExercise: (fromIndex: number, direction: 'up' | 'down') => void;
  cycleExerciseType: (index: number) => void;

  // Set management
  addSet: (exerciseIndex: number) => void;
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
  pauseRest: () => void;
  resumeRest: () => void;
  tick: () => void;

  // Stubs
  pollHealthKit: () => void;

  // Internal
  _persist: () => void;
}

// ── Live Activity snapshot helper ──────────────────────

function _getExerciseInfo(exercises: ActiveExercise[]): { name: string; currentSet: number; totalSets: number } {
  if (exercises.length === 0) return { name: '', currentSet: 0, totalSets: 0 };
  for (let i = exercises.length - 1; i >= 0; i--) {
    const ex = exercises[i];
    const done = ex.sets.filter((s) => s.completed).length;
    if (done < ex.sets.length) return { name: ex.name, currentSet: done + 1, totalSets: ex.sets.length };
  }
  const last = exercises[exercises.length - 1];
  return { name: last.name, currentSet: last.sets.length, totalSets: last.sets.length };
}

function _buildSnapshot(state: Pick<ActiveWorkoutState, 'startTime' | 'exercises' | 'isResting' | 'restStartedAt' | 'restDuration'>): WorkoutActivitySnapshot {
  const info = _getExerciseInfo(state.exercises);
  return {
    startTime: state.startTime!,
    exerciseName: info.name,
    currentSet: info.currentSet,
    totalSets: info.totalSets,
    isResting: state.isResting,
    restStartedAt: state.restStartedAt,
    restDuration: state.restDuration,
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
  restPaused: false,

  showSummary: false,
  summaryData: null,

  startedFromRoutine: null,
  startedFromProgram: null,
  programWeek: null,
  ghostUserName: null,
  heartRate: null,
  activeCalories: null,

  // ── Workout lifecycle ─────────────────────────────

  startWorkout: () => {
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
      startedFromRoutine: null,
      startedFromProgram: null,
      programWeek: null,
      ghostUserName: null,
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
    if (_timerInterval) clearInterval(_timerInterval);

    const exercises: ActiveExercise[] = routine.exercises.map((ex) => {
      const catalog = catalogMap[ex.name];
      const sets: ActiveSet[] = Array.from({ length: Math.max(ex.default_sets, 1) }, () => ({ ...EMPTY_SET }));
      return {
        name: ex.name,
        exercise_type: (ex.exercise_type || catalog?.exercise_type || 'weighted') as ActiveExercise['exercise_type'],
        category: catalog?.category || null,
        sets,
        prevSets: prevMap[ex.name] || [],
        supersetWith: null,
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
      startedFromRoutine: routine.id,
      ghostUserName: ghostUserName || null,
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
    // Reuse startFromRoutine logic, then tag with program context
    get().startFromRoutine(routine, catalogMap, prevMap);
    set({ startedFromProgram: programId, programWeek });
  },

  discardWorkout: () => {
    stopWorkoutActivity();
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    if (_persistTimeout) { clearTimeout(_persistTimeout); _persistTimeout = null; }
    _workoutRestored = false;
    set({
      isActive: false,
      sheetVisible: false,
      startTime: null,
      elapsedSeconds: 0,
      exercises: [],
      startedFromRoutine: null,
      startedFromProgram: null,
      programWeek: null,
      ghostUserName: null,
      isResting: false,
      restRemaining: 0,
      showSummary: false,
      summaryData: null,
    });
    clearWorkout();
  },

  finishWorkout: async (userId: string, durationOverride?: number) => {
    // Debug: check Supabase connectivity
    console.log('[finishWorkout] supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log('[finishWorkout] userId:', userId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      console.log('[finishWorkout] session exists:', !!sess?.session);
      console.log('[finishWorkout] token expires at:', sess?.session?.expires_at ? new Date(sess.session.expires_at * 1000).toISOString() : 'N/A');
    } catch (e) {
      console.error('[finishWorkout] getSession failed:', e);
    }

    const { exercises, elapsedSeconds, ghostUserName } = get();
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

    // Filter: remove empty sets, then remove empty exercises
    const filteredExercises = exercises
      .map((ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.kg.trim() !== '' || s.reps.trim() !== ''),
      }))
      .filter((ex) => ex.sets.length > 0);

    if (filteredExercises.length === 0) {
      if (!_timerInterval) _timerInterval = setInterval(() => get().tick(), 1000);
      return { error: 'No valid sets to save.' };
    }

    // Calculate summary
    let totalVolume = 0;
    let totalSets = 0;
    const exerciseNames: string[] = [];

    for (const ex of filteredExercises) {
      exerciseNames.push(ex.name);
      for (const s of ex.sets) {
        totalSets++;
        totalVolume += (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0);
      }
    }

    const duration = durationOverride ?? elapsedSeconds;

    const restoreTimer = () => {
      if (!_timerInterval) _timerInterval = setInterval(() => get().tick(), 1000);
    };

    // Insert workout
    console.log('[finishWorkout] inserting workout...');
    let workout: { id: string } | null = null;
    try {
      const { data, error: workoutErr } = await withTimeout(
        supabase
          .from('workouts')
          .insert({
            user_id: userId,
            duration,
            total_exercises: filteredExercises.length,
            total_sets: totalSets,
            ...(ghostUserName ? { ghost_username: ghostUserName } : {}),
            ...(get().startedFromProgram ? { program_id: get().startedFromProgram, program_week: get().programWeek } : {}),
          })
          .select('id')
          .single()
      );
      if (workoutErr || !data) {
        console.error('[finishWorkout] workout insert error:', workoutErr);
        restoreTimer();
        return { error: workoutErr?.message || 'Failed to save workout' };
      }
      workout = data;
      console.log('[finishWorkout] workout saved:', workout.id);
    } catch (e: any) {
      console.error('[finishWorkout] workout insert threw:', e);
      restoreTimer();
      return { error: 'Failed to save workout — check your connection and try again.' };
    }

    // Bulk-insert exercises
    console.log('[finishWorkout] inserting exercises...');
    try {
      const exerciseRows = filteredExercises.map((ex, i) => ({
        workout_id: workout!.id,
        name: ex.name,
        exercise_order: i + 1,
        exercise_type: ex.exercise_type,
      }));

      const { data: exDataArr, error: exErr } = await withTimeout(
        supabase
          .from('exercises')
          .insert(exerciseRows)
          .select('id, exercise_order')
      );

      if (exErr || !exDataArr || exDataArr.length === 0) {
        console.error('[finishWorkout] exercises insert error:', exErr);
        restoreTimer();
        return { error: exErr?.message || 'Failed to save exercises — please try again.' };
      }

      console.log('[finishWorkout] exercises saved, inserting sets...');

      // Map exercise_order → exercise id for set assignment
      const orderToId = new Map<number, string>();
      for (const row of exDataArr) orderToId.set(row.exercise_order, row.id);

      // Build all set rows at once
      const allSetRows: {
        exercise_id: string;
        set_number: number;
        kg: number;
        reps: number;
        completed: boolean;
        set_type: string;
        parent_set_number: number | null;
      }[] = [];

      for (let i = 0; i < filteredExercises.length; i++) {
        const exId = orderToId.get(i + 1);
        if (!exId) continue;
        for (let j = 0; j < filteredExercises[i].sets.length; j++) {
          const s = filteredExercises[i].sets[j];
          allSetRows.push({
            exercise_id: exId,
            set_number: j + 1,
            kg: parseFloat(s.kg) || 0,
            reps: parseInt(s.reps, 10) || 0,
            completed: s.completed,
            set_type: s.set_type,
            parent_set_number: s.parent_set_number,
          });
        }
      }

      if (allSetRows.length > 0) {
        const { error: setErr } = await withTimeout(
          supabase.from('sets').insert(allSetRows)
        );
        if (setErr) {
          console.warn('[finishWorkout] sets insert error:', setErr);
        } else {
          console.log('[finishWorkout] sets saved');
        }
      }
    } catch (e: any) {
      console.error('[finishWorkout] exercises/sets threw:', e);
      restoreTimer();
      return { error: 'Failed to save exercises — check your connection and try again.' };
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
          const jsDay = new Date().getDay();
          const dow = jsDay === 0 ? 6 : jsDay - 1;
          const dayEntry = prog.days.find((d) => d.day_of_week === dow);
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
      const exerciseDetailsJson = filteredExercises.map((ex) => {
        const completedSets = ex.sets.filter((s) => s.kg.trim() !== '' || s.reps.trim() !== '');
        let bestKg = 0;
        let bestReps = 0;
        let vol = 0;
        for (const s of completedSets) {
          const kg = parseFloat(s.kg) || 0;
          const reps = parseInt(s.reps, 10) || 0;
          vol += kg * reps;
          if (kg > bestKg) { bestKg = kg; bestReps = reps; }
        }
        const cat = catalogMap[ex.name];
        return {
          name: ex.name,
          sets_count: completedSets.length,
          best_kg: bestKg,
          best_reps: bestReps,
          total_volume: Math.round(vol),
          category: cat?.category || null,
          primary_muscles: cat?.primary_muscles || [],
          secondary_muscles: cat?.secondary_muscles || [],
        };
      });

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
      console.log('[finishWorkout] feed payload:', JSON.stringify(feedPayload));

      supabase.from('activity_feed').insert(feedPayload).then(({ error: feedErr }) => {
        if (feedErr) console.error('[finishWorkout] feed insert error:', JSON.stringify(feedErr));
        else console.log('[finishWorkout] feed insert ok');
      }, (e) => console.error('[finishWorkout] feed insert threw:', e));
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

    stopWorkoutActivity();
    if (_persistTimeout) { clearTimeout(_persistTimeout); _persistTimeout = null; }
    _workoutRestored = false;
    set({
      isActive: false,
      sheetVisible: false,
      exercises: [],
      startedFromRoutine: null,
      startedFromProgram: null,
      programWeek: null,
      ghostUserName: null,
      isResting: false,
      restRemaining: 0,
      restStartedAt: null,
      showSummary: true,
      summaryData,
    });

    clearWorkout();
    return { error: null, incompleteCount };
  },

  restoreWorkout: async () => {
    const saved = await loadWorkoutAsync();
    if (!saved) {
      _workoutRestored = true;
      return;
    }

    if (_timerInterval) clearInterval(_timerInterval);

    // Back-fill category for exercises saved before category field was added
    const { catalogMap } = useWorkoutStore.getState();
    const exercises = saved.exercises.map((ex) => ({
      ...ex,
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
      startedFromRoutine: saved.startedFromRoutine,
      startedFromProgram: saved.startedFromProgram || null,
      programWeek: saved.programWeek || null,
      isResting,
      restRemaining,
      restStartedAt,
    });

    _workoutRestored = true;
    _timerInterval = setInterval(() => get().tick(), 1000);
    startWorkoutActivity(_buildSnapshot(get()));
  },

  showSheet: () => set({ sheetVisible: true }),
  hideSheet: () => set({ sheetVisible: false }),

  dismissSummary: () => set({
    showSummary: false,
    summaryData: null,
    sheetVisible: false,
    startTime: null,
    elapsedSeconds: 0,
  }),

  undoFinish: () => {
    const { summaryData } = get();
    if (!summaryData) return;

    // Delete the already-saved workout from DB so re-finish is a clean insert
    if (summaryData.workoutId) {
      supabase.from('workouts').delete().eq('id', summaryData.workoutId).then(() => {
        // Also refresh workout history so it doesn't show the deleted entry
        const userId = useAuthStore.getState().user?.id;
        if (userId) useWorkoutStore.getState().fetchWorkoutHistory(userId);
      });
    }

    const catalogMap = useWorkoutStore.getState().catalogMap;
    const prevMap = useWorkoutStore.getState().prevMap;

    const exercises: ActiveExercise[] = summaryData.exercises.map((ex) => {
      const catalogEntry = catalogMap[ex.name];
      return {
        name: ex.name,
        exercise_type: (catalogEntry?.exercise_type as ActiveExercise['exercise_type']) || 'weighted',
        category: ex.category,
        sets: ex.sets.map((s) => ({
          kg: String(s.kg),
          reps: String(s.reps),
          completed: s.completed,
          set_type: (s.set_type as ActiveSet['set_type']) || 'working',
          parent_set_number: null,
        })),
        prevSets: prevMap[ex.name] || [],
        supersetWith: null,
      };
    });

    set({
      isActive: true,
      sheetVisible: true,
      exercises,
      startTime: Date.now() - summaryData.duration * 1000,
      elapsedSeconds: summaryData.duration,
      showSummary: false,
      summaryData: null,
    });
  },

  // ── Exercise management ───────────────────────────

  addExercise: (name, exerciseType, category, prevSets = []) => {
    set((s) => ({
      exercises: [
        ...s.exercises,
        {
          name,
          exercise_type: exerciseType as ActiveExercise['exercise_type'],
          category,
          sets: [{ ...EMPTY_SET }],
          prevSets,
          supersetWith: null,
        },
      ],
    }));
    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  removeExercise: (index) => {
    set((s) => {
      const exercises = s.exercises.filter((_, i) => i !== index);
      // Fix superset refs
      return {
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
    set((s) => {
      const exercises = [...s.exercises];
      exercises[index] = {
        ...exercises[index],
        name,
        exercise_type: exerciseType as ActiveExercise['exercise_type'],
        category,
        prevSets,
      };
      return { exercises };
    });
    get()._persist();
  },

  moveExercise: (fromIndex, direction) => {
    set((s) => {
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= s.exercises.length) return s;

      const exercises = [...s.exercises];
      [exercises[fromIndex], exercises[toIndex]] = [exercises[toIndex], exercises[fromIndex]];

      // Fix superset refs
      return {
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
  },

  cycleExerciseType: (index) => {
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

  // ── Set management ────────────────────────────────

  addSet: (exerciseIndex) => {
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      ex.sets = [...ex.sets, { ...EMPTY_SET }];
      exercises[exerciseIndex] = ex;
      return { exercises };
    });
    get()._persist();
  },

  removeSet: (exerciseIndex, setIndex) => {
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      if (ex.sets.length <= 1) return s;
      ex.sets = ex.sets.filter((_, i) => i !== setIndex);
      exercises[exerciseIndex] = ex;
      return { exercises };
    });
    get()._persist();
  },

  updateSet: (exerciseIndex, setIndex, field, value) => {
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
    const exercises = [...get().exercises];
    const ex = { ...exercises[exerciseIndex] };
    const sets = [...ex.sets];
    const wasCompleted = sets[setIndex].completed;
    sets[setIndex] = { ...sets[setIndex], completed: !wasCompleted };
    ex.sets = sets;
    exercises[exerciseIndex] = ex;
    set({ exercises });

    if (!wasCompleted) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      get().startRest();
    }

    get()._persist();
    updateWorkoutActivity(_buildSnapshot(get()));
  },

  cycleSetType: (exerciseIndex, setIndex) => {
    set((s) => {
      const exercises = [...s.exercises];
      const ex = { ...exercises[exerciseIndex] };
      const sets = [...ex.sets];
      const current = sets[setIndex].set_type;
      const next = (SET_TYPE_CYCLE[current] || 'working') as ActiveSet['set_type'];
      sets[setIndex] = {
        ...sets[setIndex],
        set_type: next,
        parent_set_number: next === 'drop' ? setIndex : null,
      };
      ex.sets = sets;
      exercises[exerciseIndex] = ex;
      return { exercises };
    });
    get()._persist();
  },

  // ── Superset ──────────────────────────────────────

  linkSuperset: (exerciseIndex) => {
    set((s) => {
      const nextIdx = exerciseIndex + 1;
      if (nextIdx >= s.exercises.length) return s;
      const exercises = [...s.exercises];
      exercises[exerciseIndex] = { ...exercises[exerciseIndex], supersetWith: nextIdx };
      exercises[nextIdx] = { ...exercises[nextIdx], supersetWith: exerciseIndex };
      return { exercises };
    });
    get()._persist();
  },

  unlinkSuperset: (exerciseIndex) => {
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
  },

  // ── Rest timer ────────────────────────────────────

  setRestDuration: (seconds) => {
    if (get().isResting) return;
    set({ restDuration: seconds });
    _preferredRestDuration = seconds;
    saveRestPreference(seconds);
    get()._persist();
  },

  startRest: () => {
    const { restDuration } = get();
    _restResumeBase = null;
    set({ isResting: true, restPaused: false, restRemaining: restDuration, restStartedAt: Date.now() });
    updateWorkoutActivity(_buildSnapshot(get()));

    // Await cancel before scheduling to avoid race condition on Android
    _scheduleRestNotification(restDuration);
  },

  stopRest: () => {
    _restResumeBase = null;
    set({ isResting: false, restPaused: false, restRemaining: 0, restStartedAt: null });
    updateWorkoutActivity(_buildSnapshot(get()));
    Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
  },

  pauseRest: () => {
    const { isResting, restRemaining } = get();
    if (!isResting || restRemaining <= 0) return;
    set({ restPaused: true, restStartedAt: null });
    Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
  },

  resumeRest: () => {
    const { isResting, restPaused, restRemaining } = get();
    if (!isResting || !restPaused || restRemaining <= 0) return;
    _restResumeBase = restRemaining;
    set({ restPaused: false, restStartedAt: Date.now() });
    _scheduleRestNotification(restRemaining);
  },

  tick: () => {
    const { startTime, isResting, restDuration, restStartedAt } = get();
    const patch: Partial<ActiveWorkoutState> = {};

    if (startTime) {
      patch.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }

    const restPaused = get().restPaused;
    if (isResting && restStartedAt && !restPaused) {
      const base = _restResumeBase ?? restDuration;
      const elapsed = Math.floor((Date.now() - restStartedAt) / 1000);
      const remaining = Math.max(0, base - elapsed);
      if (remaining <= 0) {
        // Apply elapsed update first, then stop rest (separate set to avoid stale merge)
        if (patch.elapsedSeconds !== undefined) set(patch);
        get().stopRest();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        playBeep();
        return;
      }
      // Beep at 3, 2, 1
      if (remaining <= 3 && remaining !== get().restRemaining) {
        playBeep();
      }
      patch.restRemaining = remaining;
    }

    // Single batched set() — one render cycle instead of two
    if (Object.keys(patch).length > 0) set(patch);
  },

  // ── Stubs ─────────────────────────────────────────

  pollHealthKit: () => { /* TODO: Query HealthKit for heart rate + active calories */ },

  // ── Internal ──────────────────────────────────────

  _persist: () => {
    if (!_workoutRestored) return; // Don't persist before restore has run
    if (_persistTimeout) clearTimeout(_persistTimeout);
    _persistTimeout = setTimeout(() => {
      const { isActive, startTime, exercises, restDuration, restStartedAt, startedFromRoutine, startedFromProgram, programWeek } = get();
      if (!isActive || !startTime) return;
      saveWorkout({ startTime, exercises, restDuration, restStartedAt, startedFromRoutine, startedFromProgram, programWeek });
    }, 500);
  },
}));
