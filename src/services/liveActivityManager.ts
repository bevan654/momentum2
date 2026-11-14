/**
 * Live Activity Manager — the active workout on the Lock Screen / status bar.
 *
 * Native path (binaries with modules/workout-live-activity, 1.0.37+): an
 * ActivityKit Live Activity on iOS 16.2+ and an ongoing notification on Android.
 * Both timers tick natively, so JS only sends a snapshot when what's displayed
 * changes (exercise, set, next exercise, rest start/end), never per tick.
 *
 * Legacy path (older iOS binaries, iOS < 16.2, Live Activities turned off): a
 * sticky expo-notification re-posted by a JS ticker (1s while resting, 30s idle).
 *
 * Plain module, no React state.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as WorkoutLiveActivity from '../../modules/workout-live-activity';
import type { WorkoutLiveActivityState } from '../../modules/workout-live-activity';
import { formatClock } from '../utils/formatDuration';

// ── Types ──────────────────────────────────────────────────

export interface WorkoutActivitySnapshot {
  startTime: number;
  exerciseName: string;
  currentSet: number;
  totalSets: number;
  /** The exercise after the current one, if any. */
  nextExerciseName: string | null;
  isResting: boolean;
  restStartedAt: number | null;
  /** Seconds from restStartedAt to the rest's end (the store re-anchors on adjustments). */
  restDuration: number;
  /** Full length of the current rest incl. adjustments, in seconds. */
  restTotal: number;
}

// ── Constants ─────────────────────────────────────────────

const WORKOUT_NOTIF_ID = 'workout-active';
const IOS_IDLE_TICK_MS = 30_000;
const IOS_REST_TICK_MS = 1_000;

// ── Module state ───────────────────────────────────────────

let _active = false;
/** Which path the running activity uses; decided when it starts. */
let _mode: 'native' | 'legacy' | null = null;

// Native path
let _lastNativeKey = '';
/** Keeps native calls in order (an update can't overtake the start it follows). */
let _nativeQueue: Promise<unknown> = Promise.resolve();

// Legacy path
let _tickInterval: ReturnType<typeof setInterval> | null = null;
let _snapshot: WorkoutActivitySnapshot | null = null;
let _currentTickMs = 0;
let _presenting = false;
let _lastTitle = '';
let _lastBody = '';

// ── Native path ────────────────────────────────────────────

function toNativeState(snapshot: WorkoutActivitySnapshot): WorkoutLiveActivityState {
  const resting = snapshot.isResting && snapshot.restStartedAt != null;
  // restStartedAt + restDuration is the rest's end. After an adjustment restStartedAt
  // is re-anchored to "now" and restDuration is what's left, so the original start is
  // end − restTotal. restTotal is never meant to be shorter than restDuration (a workout
  // saved before restTotal was persisted restores it as restDuration); the max guards that.
  const restEndsAt = resting ? snapshot.restStartedAt! + snapshot.restDuration * 1000 : null;
  const restStartedAt = restEndsAt != null
    ? restEndsAt - Math.max(snapshot.restTotal, snapshot.restDuration) * 1000
    : null;
  return {
    workoutStartedAt: snapshot.startTime,
    exerciseName: snapshot.exerciseName,
    setIndex: snapshot.currentSet,
    setCount: snapshot.totalSets,
    nextExerciseName: snapshot.nextExerciseName,
    restStartedAt,
    restEndsAt,
  };
}

function enqueueNative(label: string, call: () => Promise<unknown>): void {
  _nativeQueue = _nativeQueue.then(call).catch((e) => {
    if (__DEV__) console.warn(`[LiveActivity] ${label} failed:`, e);
  });
}

function sendNative(snapshot: WorkoutActivitySnapshot, kind: 'start' | 'update'): void {
  const state = toNativeState(snapshot);
  const key = JSON.stringify(state);
  if (kind === 'update' && key === _lastNativeKey) return;
  _lastNativeKey = key;
  enqueueNative(kind, () => (kind === 'start' ? WorkoutLiveActivity.start(state) : WorkoutLiveActivity.update(state)));
}

// ── Legacy path: notification content ─────────────────────

function buildNotifContent(snapshot: WorkoutActivitySnapshot): {
  title: string;
  body: string;
} {
  const elapsed = formatClock((Date.now() - snapshot.startTime) / 1000);

  const title = `Workout Active · ${elapsed}`;
  let body = '';

  if (snapshot.exerciseName) {
    body = `${snapshot.exerciseName} — Set ${snapshot.currentSet}/${snapshot.totalSets}`;
  } else {
    body = 'No exercises added yet';
  }

  if (snapshot.isResting && snapshot.restStartedAt) {
    const restElapsed = Math.floor((Date.now() - snapshot.restStartedAt) / 1000);
    const remaining = Math.max(0, snapshot.restDuration - restElapsed);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    body += `\nRest: ${m}:${s.toString().padStart(2, '0')}`;
  }

  return { title, body };
}

async function presentNotification(snapshot: WorkoutActivitySnapshot, force = false): Promise<void> {
  if (_presenting) return;

  const { title, body } = buildNotifContent(snapshot);
  if (!force && title === _lastTitle && body === _lastBody) return;

  _presenting = true;
  try {
    _lastTitle = title;
    _lastBody = body;
    await Notifications.scheduleNotificationAsync({
      identifier: WORKOUT_NOTIF_ID,
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        sound: false,
        data: { type: 'workout_active' },
      },
      trigger: null,
    });
  } finally {
    _presenting = false;
  }
}

function startTicker(snapshot: WorkoutActivitySnapshot): void {
  _snapshot = snapshot;

  const interval = snapshot.isResting ? IOS_REST_TICK_MS : IOS_IDLE_TICK_MS;
  if (_tickInterval && _currentTickMs === interval) return;

  if (_tickInterval) clearInterval(_tickInterval);
  _currentTickMs = interval;

  _tickInterval = setInterval(() => {
    if (!_snapshot) return;
    presentNotification(_snapshot).catch(() => {});
  }, interval);
}

function stopTicker(): void {
  if (_tickInterval) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
  _snapshot = null;
  _currentTickMs = 0;
  _lastTitle = '';
  _lastBody = '';
}

// ── Public API ─────────────────────────────────────────────

/** Bumped by every start and stop, so a start that resolves after a newer call knows it's stale. */
let _gen = 0;
/** Legacy path: a start is waiting for an earlier dismiss; updates only record the snapshot meanwhile. */
let _legacyStarting = false;
/** Legacy path: dismisses of the sticky notification still in flight. A start waits for them. */
let _stopping: Promise<void> | null = null;

/**
 * Dismisses the legacy sticky notification. Replacing a workout stops and starts in the same
 * tick: a dismiss landing after the next start would remove the new workout's notification,
 * so starts wait for every pending dismiss (`_stopping`).
 */
function dismissLegacy(): Promise<void> {
  const dismissing = Notifications.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch((e) => {
    if (__DEV__) console.warn('[LiveActivity] dismiss failed:', e);
  });
  const stopping = _stopping ? Promise.all([_stopping, dismissing]).then(() => {}) : dismissing;
  _stopping = stopping;
  stopping.then(() => { if (_stopping === stopping) _stopping = null; });
  return stopping;
}

export async function startWorkoutActivity(snapshot: WorkoutActivitySnapshot): Promise<void> {
  const gen = ++_gen;
  _legacyStarting = false;

  if (WorkoutLiveActivity.isSupported()) {
    // Upgrading mid-workout from a build without the module leaves its sticky notification.
    if (Platform.OS === 'ios') dismissLegacy();
    _mode = 'native';
    _active = true;
    // Queued: it runs after any earlier end, and a stop called before it resolves runs after it.
    sendNative(snapshot, 'start');
    return;
  }

  if (Platform.OS !== 'ios') return;
  _mode = 'legacy';
  _active = true;
  _snapshot = snapshot;
  _legacyStarting = true;
  try {
    if (_stopping) await _stopping;
    if (gen !== _gen) return; // stopped or restarted while waiting
    _legacyStarting = false;
    // Updates while waiting only recorded their snapshot.
    const latest = _snapshot ?? snapshot;
    await presentNotification(latest);
    if (gen !== _gen) {
      // Stopped while posting: its dismiss may have run before the post landed.
      if (_mode !== 'legacy') dismissLegacy();
      return;
    }
    startTicker(_snapshot ?? latest);
  } catch (e) {
    if (gen === _gen) {
      _active = false;
      _mode = null;
      _legacyStarting = false;
      stopTicker();
    }
    if (__DEV__) console.warn('[LiveActivity] start failed:', e);
  }
}

/** Sends what's displayed now. Does nothing unless a workout activity was started (and not stopped). */
export function updateWorkoutActivity(snapshot: WorkoutActivitySnapshot): void {
  if (!_active) return;

  if (_mode === 'native') {
    sendNative(snapshot, 'update');
    return;
  }
  if (_mode !== 'legacy') return;

  const restChanged = _snapshot?.isResting !== snapshot.isResting;
  _snapshot = snapshot;
  // The start posts the latest snapshot once earlier dismisses are done.
  if (_legacyStarting) return;

  presentNotification(snapshot).catch(() => {});

  if (restChanged) {
    startTicker(snapshot);
  }
}

export async function stopWorkoutActivity(): Promise<void> {
  if (!_active) return;
  const mode = _mode;
  // Synchronously, so a start in the same tick (Replace) isn't undone when this resolves,
  // and an in-flight start sees it was stopped.
  _gen++;
  _active = false;
  _mode = null;
  _legacyStarting = false;

  if (mode === 'native') {
    _lastNativeKey = '';
    // Queued after the start, so a stop before the start resolved still ends it.
    enqueueNative('stop', () => WorkoutLiveActivity.end());
    await _nativeQueue;
    return;
  }

  stopTicker();
  await dismissLegacy();
}

/**
 * Ends a workout activity left over from a previous app run (the app was killed
 * mid-workout). `stopWorkoutActivity` can't, because its "active" flag doesn't
 * survive a restart. Call it only when no workout is active.
 *
 * A workout started right after this keeps its activity: the native end runs before the
 * start in the queue and is skipped if a start came first (native start adopts a leftover
 * activity anyway), and a legacy start waits for the dismiss.
 */
export function clearStaleWorkoutActivity(): void {
  if (_active) return;
  const gen = _gen;
  enqueueNative('clear stale', async () => {
    if (gen === _gen) await WorkoutLiveActivity.endAll();
  });
  // A sticky notification from the legacy path (or from the build before this one).
  if (Platform.OS === 'ios') dismissLegacy();
}
