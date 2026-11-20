/**
 * Native active-workout "live activity": an ActivityKit Live Activity on iOS 16.2+
 * (Lock Screen + Dynamic Island, UI in targets/workout-activity) and an ongoing
 * notification with a native chronometer on Android.
 *
 * Every call is a no-op when the native module isn't in the binary (builds before
 * 1.0.37, Expo Go), so JS shipped over the air can call it safely. The Lock Screen
 * fields and buttons need 1.0.38+ (iOS only; Android ignores them).
 */

import { requireOptionalNativeModule } from 'expo';

/** What addListener returns (expo-modules-core's EventSubscription). */
interface EventSubscription {
  remove(): void;
}

/** `kind` of a set: how the Lock Screen shows and compares it. */
export type WorkoutSetKind = 'weighted' | 'bodyweight' | 'weightedBodyweight' | 'duration';

/** One set as the Lock Screen shows it. Mirrors WorkoutSetCard in the Swift attributes. */
export interface WorkoutLiveActivitySetCard {
  /** ActiveExercise.id; with setPosition, identifies the set a button tap is for. */
  exerciseId: string;
  exerciseName: string;
  /** 0-based index into the exercise's sets. */
  setPosition: number;
  /** 1-based label ("set 2 of 4") and the exercise's set count. */
  setIndex: number;
  setCount: number;
  kind: WorkoutSetKind;
  /** Planned weight (added weight for weightedBodyweight) and reps (seconds for duration). */
  kg: number | null;
  reps: number | null;
  /** The same set last session. */
  lastKg: number | null;
  lastReps: number | null;
  /** Best before this set: heaviest weight, and most reps at this weight or heavier. Null = no history. */
  prKg: number | null;
  prReps: number | null;
  /** One letter per set: d = done, c = this one, p = to do. */
  setStates: string;
}

/** The set ticked off most recently. Mirrors WorkoutDoneSet in the Swift attributes. */
export interface WorkoutLiveActivityDoneSet {
  exerciseName: string;
  setIndex: number;
  kind: WorkoutSetKind;
  kg: number | null;
  reps: number | null;
  lastKg: number | null;
  lastReps: number | null;
  /** "Heaviest ever", "Most reps at 80 kg"…; null when it isn't a PR. */
  prLabel: string | null;
}

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

  // 1.0.38+ (iOS Lock Screen). Older binaries and Android ignore these.
  workoutId: string | null;
  /** Routine / program-day name; null for a plain workout. */
  workoutTitle: string | null;
  /** Sets ticked off across the whole workout, and the workout's set count. */
  completedSets: number;
  workoutSets: number;
  /** The app's accent colour as "#RRGGBB". */
  accentHex: string;
  /** Length of a new rest (the user's preference); a Lock Screen "Done" starts one this long. */
  restSeconds: number;
  /** Epoch ms the latest set was ticked off; null before the first. */
  lastCompletedAt: number | null;
  /** The set the user is on (while resting: the one coming up). */
  current: WorkoutLiveActivitySetCard | null;
  /** The set after `current`, so "Done" on the Lock Screen can move on without JS. */
  after: WorkoutLiveActivitySetCard | null;
  /** The set ticked off most recently (the stat shown while resting). */
  justDone: WorkoutLiveActivityDoneSet | null;
}

/** A Lock Screen tap the app hasn't applied yet. `at` is epoch ms. */
export type WorkoutLiveActivityAction =
  | { type: 'complete'; workoutId: string; exerciseId: string; setPosition: number; kg?: number; reps: number; at: number }
  | { type: 'reps'; workoutId: string; exerciseId: string; setPosition: number; reps: number; at: number }
  | { type: 'endRest'; workoutId: string; at: number };

interface WorkoutLiveActivityNative {
  isSupported(): boolean;
  start(state: WorkoutLiveActivityState): Promise<string | null>;
  update(state: WorkoutLiveActivityState): Promise<void>;
  end(): Promise<void>;
  endAll(): Promise<void>;
  // 1.0.38+ on iOS only.
  takePendingActions?(): Promise<WorkoutLiveActivityAction[]>;
  clearPendingActions?(): Promise<void>;
  addListener?(event: 'onAction', listener: () => void): EventSubscription;
  setHomeWidgetData?(json: string | null): Promise<void>;
  getHomeWidgetData?(): Promise<string | null>;
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

/** Lock Screen taps not applied yet, oldest first; reading them clears them. [] where unsupported. */
export async function takePendingActions(): Promise<WorkoutLiveActivityAction[]> {
  if (!Native?.takePendingActions) return [];
  try {
    const actions = await Native.takePendingActions();
    return Array.isArray(actions) ? actions : [];
  } catch {
    return [];
  }
}

/** Drops pending taps (no workout to apply them to). */
export async function clearPendingActions(): Promise<void> {
  if (!Native?.clearPendingActions) return;
  try {
    await Native.clearPendingActions();
  } catch {}
}

/** Calls `listener` when a Lock Screen button is tapped; null where unsupported. */
export function addActionListener(listener: () => void): EventSubscription | null {
  if (!Native?.addListener || !Native.takePendingActions) return null;
  try {
    return Native.addListener('onAction', listener);
  } catch {
    return null;
  }
}

/**
 * Hands the home screen widgets their data (a JSON string; null clears it) and redraws them if it
 * changed. Returns false where the binary has no widgets (Android, iOS builds before 1.0.38).
 */
export async function setHomeWidgetData(json: string | null): Promise<boolean> {
  if (!Native?.setHomeWidgetData) return false;
  try {
    await Native.setHomeWidgetData(json);
    return true;
  } catch {
    return false;
  }
}

/** What the home screen widgets show now (JSON from an earlier write), or null. */
export async function getHomeWidgetData(): Promise<string | null> {
  if (!Native?.getHomeWidgetData) return null;
  try {
    return (await Native.getHomeWidgetData()) ?? null;
  } catch {
    return null;
  }
}
