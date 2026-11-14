/**
 * Native active-workout "live activity": an ActivityKit Live Activity on iOS 16.2+
 * (Lock Screen + Dynamic Island, UI in targets/workout-activity) and an ongoing
 * notification with a native chronometer on Android.
 *
 * Every call is a no-op when the native module isn't in the binary (builds before
 * 1.0.37, Expo Go), so JS shipped over the air can call it safely.
 */

import { requireOptionalNativeModule } from 'expo';

export interface WorkoutLiveActivityState {
  /** Epoch ms; the elapsed timer counts up from here. */
  workoutStartedAt: number;
  /** Current exercise; '' when the workout has none yet. */
  exerciseName: string;
  /** 1-based set the user is on. */
  setIndex: number;
  setCount: number;
  /** The exercise after the current one, if any. */
  nextExerciseName: string | null;
  /** Epoch ms of the rest's original start (for the progress bar); null when not resting. */
  restStartedAt: number | null;
  /** Epoch ms of the rest's end; null when not resting. */
  restEndsAt: number | null;
}

interface WorkoutLiveActivityNative {
  isSupported(): boolean;
  start(state: WorkoutLiveActivityState): Promise<string | null>;
  update(state: WorkoutLiveActivityState): Promise<void>;
  end(): Promise<void>;
  endAll(): Promise<void>;
}

const Native = requireOptionalNativeModule<WorkoutLiveActivityNative>('WorkoutLiveActivity');

/** True when the binary has the module and (on iOS) Live Activities are available and enabled. */
export function isSupported(): boolean {
  if (!Native) return false;
  try {
    return Native.isSupported();
  } catch {
    return false;
  }
}

/** Shows the activity, adopting one left from a previous launch. Resolves its id, or null. */
export async function start(state: WorkoutLiveActivityState): Promise<string | null> {
  if (!Native) return null;
  return Native.start(state);
}

/** Updates the running activity; does nothing if none is showing or the user dismissed it. */
export async function update(state: WorkoutLiveActivityState): Promise<void> {
  if (!Native) return;
  return Native.update(state);
}

export async function end(): Promise<void> {
  if (!Native) return;
  return Native.end();
}

/** Ends every workout activity, including ones left from a previous launch. */
export async function endAll(): Promise<void> {
  if (!Native) return;
  return Native.endAll();
}
