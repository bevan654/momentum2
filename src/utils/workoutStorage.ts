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
  /** Set when racing a friend's workout ("vs <name>"); the ghost's sets are each exercise's prevSets. */
  ghostUserName?: string | null;
  /** Database id for the workout (generated at start); see upsert_workout. */
  workoutId?: string | null;
  saveMode?: 'create' | 'replace';
  /** Account the workout belongs to; another account signing in on the device doesn't restore it. */
  userId?: string | null;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      ghostUserName: typeof parsed.ghostUserName === 'string' && parsed.ghostUserName ? parsed.ghostUserName : null,
      workoutId: typeof parsed.workoutId === 'string' && UUID_RE.test(parsed.workoutId) ? parsed.workoutId : null,
      saveMode: parsed.saveMode === 'replace' ? 'replace' : 'create',
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
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

// ── Deletes that couldn't reach the server (Discard after Undo, offline) ──

const PENDING_DELETES_KEY = 'pending_workout_deletes';

export async function loadPendingWorkoutDeletes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETES_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function addPendingWorkoutDelete(id: string): Promise<void> {
  const ids = await loadPendingWorkoutDeletes();
  if (!ids.includes(id)) ids.push(id);
  await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids)).catch(() => {});
}

export async function setPendingWorkoutDeletes(ids: string[]): Promise<void> {
  if (ids.length === 0) await AsyncStorage.removeItem(PENDING_DELETES_KEY).catch(() => {});
  else await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids)).catch(() => {});
}
