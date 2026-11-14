import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveExercise } from '../stores/useActiveWorkoutStore';

const KEY = 'active_workout_state';
const REST_PREF_KEY = 'rest_duration_preference';

interface PersistedWorkout {
  startTime: number;
  exercises: ActiveExercise[];
  restDuration: number;
  restStartedAt: number | null;
  startedFromRoutine: string | null;
  startedFromProgram?: string | null;
  programWeek?: number | null;
  workoutTitle?: string | null;
  restAnchor?: { exerciseIndex: number; setIndex: number } | null;
}

export function saveWorkout(state: PersistedWorkout): void {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

/**
 * A workout with no exercises yet (e.g. "Start Empty") is still restored, so it
 * doesn't vanish on the next launch while the running app shows it in progress.
 * Past this age an empty workout is treated as abandoned and dropped instead of
 * coming back with a huge elapsed time.
 */
const EMPTY_WORKOUT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function parseRestAnchor(value: unknown): PersistedWorkout['restAnchor'] {
  if (!value || typeof value !== 'object') return null;
  const { exerciseIndex, setIndex } = value as Record<string, unknown>;
  return Number.isInteger(exerciseIndex) && Number.isInteger(setIndex)
    ? { exerciseIndex: exerciseIndex as number, setIndex: setIndex as number }
    : null;
}

export async function loadWorkoutAsync(): Promise<PersistedWorkout | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.startTime || !Array.isArray(parsed.exercises)) {
      return null;
    }
    if (parsed.exercises.length === 0 && Date.now() - parsed.startTime > EMPTY_WORKOUT_MAX_AGE_MS) {
      clearWorkout();
      return null;
    }
    return {
      startTime: parsed.startTime,
      exercises: parsed.exercises,
      restDuration: parsed.restDuration ?? 90,
      restStartedAt: parsed.restStartedAt ?? null,
      startedFromRoutine: parsed.startedFromRoutine ?? null,
      startedFromProgram: parsed.startedFromProgram ?? null,
      programWeek: parsed.programWeek ?? null,
      workoutTitle: typeof parsed.workoutTitle === 'string' ? parsed.workoutTitle : null,
      restAnchor: parseRestAnchor(parsed.restAnchor),
    };
  } catch {
    return null;
  }
}

export function clearWorkout(): void {
  AsyncStorage.removeItem(KEY).catch(() => {});
}

export function saveRestPreference(seconds: number): void {
  AsyncStorage.setItem(REST_PREF_KEY, String(seconds)).catch(() => {});
}

export async function loadRestPreference(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(REST_PREF_KEY);
    if (raw) {
      const n = parseInt(raw, 10);
      if (n > 0) return n;
    }
  } catch {}
  return 90;
}
