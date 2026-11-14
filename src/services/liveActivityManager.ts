/**
 * Live Activity Manager — iOS-only sticky workout notification
 * using expo-notifications.
 *
 * Adaptive tick: 1s while resting (countdown precision), 30s idle.
 * In-flight guard + content dedup minimise bridge calls.
 *
 * Plain module, no React state.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatClock } from '../utils/formatDuration';

// ── Types ──────────────────────────────────────────────────

export interface WorkoutActivitySnapshot {
  startTime: number;
  exerciseName: string;
  currentSet: number;
  totalSets: number;
  isResting: boolean;
  restStartedAt: number | null;
  restDuration: number; // seconds
}

// ── Constants ─────────────────────────────────────────────

const WORKOUT_NOTIF_ID = 'workout-active';
const IOS_IDLE_TICK_MS = 30_000;
const IOS_REST_TICK_MS = 1_000;

// ── Module state ───────────────────────────────────────────

let _active = false;
let _tickInterval: ReturnType<typeof setInterval> | null = null;
let _snapshot: WorkoutActivitySnapshot | null = null;
let _currentTickMs = 0;
let _presenting = false;
let _lastTitle = '';
let _lastBody = '';

// ── Helpers ────────────────────────────────────────────────

// ── Notification content ──────────────────────────────────

function buildNotifContent(snapshot: WorkoutActivitySnapshot): {
  title: string;
  body: string;
} {
  const elapsed = formatClock((Date.now() - snapshot.startTime) / 1000);

  const title = `Workout Active \u00b7 ${elapsed}`;
  let body = '';

  if (snapshot.exerciseName) {
    body = `${snapshot.exerciseName} \u2014 Set ${snapshot.currentSet}/${snapshot.totalSets}`;
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
  if (Platform.OS !== 'ios') return;
  try {
    // Replacing a workout stops and starts in the same tick: a late dismiss would remove the
    // new workout's notification and clear _active after it was set.
    if (_stopping) await _stopping;
    await presentNotification(snapshot);
    startTicker(snapshot);
    _active = true;
  } catch (e) {
    if (__DEV__) console.warn('[LiveActivity] start failed:', e);
  }
}

export function updateWorkoutActivity(snapshot: WorkoutActivitySnapshot): void {
  if (Platform.OS !== 'ios') return;
  const restChanged = _snapshot?.isResting !== snapshot.isResting;
  _snapshot = snapshot;

  presentNotification(snapshot).catch(() => {});

  if (restChanged) {
    startTicker(snapshot);
  }
}

export async function stopWorkoutActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !_active) return;

  stopTicker();
  _active = false;

  const stopping = Notifications.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch((e) => {
    if (__DEV__) console.warn('[LiveActivity] stop failed:', e);
  });
  _stopping = stopping;
  await stopping;
  if (_stopping === stopping) _stopping = null;
}

/**
 * Dismisses a workout notification left over from a previous app run (the app
 * was killed mid-workout). `stopWorkoutActivity` can't, because its "active"
 * flag doesn't survive a restart. Call it only when no workout is active.
 */
export function clearStaleWorkoutActivity(): void {
  if (Platform.OS !== 'ios' || _active) return;
  Notifications.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch(() => {});
}
