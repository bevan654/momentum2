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
  // end − restTotal. After a crash-restore restTotal is only what was left while
  // restDuration is still the full length, hence the max.
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

/** A stop still dismissing the previous workout's notification; a start waits for it. */
let _stopping: Promise<void> | null = null;

export async function startWorkoutActivity(snapshot: WorkoutActivitySnapshot): Promise<void> {
  if (WorkoutLiveActivity.isSupported()) {
    // Upgrading mid-workout from a build without the module leaves its sticky notification.
    if (Platform.OS === 'ios') Notifications.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch(() => {});
    _mode = 'native';
    _active = true;
    sendNative(snapshot, 'start');
    return;
  }

  if (Platform.OS !== 'ios') return;
  _mode = 'legacy';
  _active = true;
  try {
    // Replacing a workout stops and starts in the same tick: a late dismiss would remove the
    // new workout's notification and clear _active after it was set.
    if (_stopping) await _stopping;
    await presentNotification(snapshot);
    startTicker(snapshot);
  } catch (e) {
    _active = false;
    _mode = null;
    if (__DEV__) console.warn('[LiveActivity] start failed:', e);
  }
}

export function updateWorkoutActivity(snapshot: WorkoutActivitySnapshot): void {
  if (_mode === 'native') {
    if (_active) sendNative(snapshot, 'update');
    return;
  }

  if (Platform.OS !== 'ios' || !_active) return;
  const restChanged = _snapshot?.isResting !== snapshot.isResting;
  _snapshot = snapshot;

  presentNotification(snapshot).catch(() => {});

  if (restChanged) {
    startTicker(snapshot);
  }
}

export async function stopWorkoutActivity(): Promise<void> {
  if (!_active) return;

  if (_mode === 'native') {
    _active = false;
    _mode = null;
    _lastNativeKey = '';
    enqueueNative('stop', () => WorkoutLiveActivity.end());
    await _nativeQueue;
    return;
  }

  if (Platform.OS !== 'ios') return;

  stopTicker();
  _active = false;
  _mode = null;

  const stopping = Notifications.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch((e) => {
    if (__DEV__) console.warn('[LiveActivity] stop failed:', e);
  });
  _stopping = stopping;
  await stopping;
  if (_stopping === stopping) _stopping = null;
}

/**
 * Ends a workout activity left over from a previous app run (the app was killed
 * mid-workout). `stopWorkoutActivity` can't, because its "active" flag doesn't
 * survive a restart. Call it only when no workout is active.
 */
export function clearStaleWorkoutActivity(): void {
  if (_active) return;
  enqueueNative('clear stale', () => WorkoutLiveActivity.endAll());
  // A sticky notification from the legacy path (or from the build before this one).
  if (Platform.OS === 'ios') Notifications.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch(() => {});
}
