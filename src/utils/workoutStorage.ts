import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveExercise } from '../stores/useActiveWorkoutStore';

const KEY = 'active_workout_state';

export interface PersistedWorkout {
  startTime: number;
  exercises: ActiveExercise[];
  restDuration: number;
  restStartedAt: number | null;
  startedFromRoutine: string | null;
}

export function saveWorkout(state: PersistedWorkout): void {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export async function loadWorkoutAsync(): Promise<PersistedWorkout | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Guard: must have exercises + startTime
    if (!parsed.startTime || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      return null;
    }
    return {
      startTime: parsed.startTime,
      exercises: parsed.exercises,
      restDuration: parsed.restDuration ?? 90,
      restStartedAt: parsed.restStartedAt ?? null,
      startedFromRoutine: parsed.startedFromRoutine ?? null,
    };
  } catch {
    return null;
  }
}

export function clearWorkout(): void {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
