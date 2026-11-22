/**
 * Supplements widget taps (iOS 17+, 1.0.39+): water or a supplement added from the home screen,
 * and Undo. The widget runs outside the app, so it leaves each tap in a shared outbox
 * (targets/workout-activity/HomeWidgetTaps.swift) and already shows it; this reads the outbox and
 * saves the taps with the same store actions as the app's own buttons.
 *
 * Read when a tap pings the app, when the app comes to the foreground, when the signed-in user
 * changes, and at start (taps made while the app wasn't running). Only while signed in: a tap
 * for another account, or from an earlier day, is dropped. Plain module, no React state.
 */

import { AppState } from 'react-native';
import * as WorkoutLiveActivity from '../../modules/workout-live-activity';
import type { SupplementWidgetTap } from '../../modules/workout-live-activity';
import { useAuthStore } from '../stores/useAuthStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { toLocalDateString } from '../utils/localDate';

let _started = false;
/** One read at a time; a ping during a read reads again once it's done. */
let _reading: Promise<void> | null = null;
let _readAgain = false;

/** Adds and undos in order, one at a time (an undo must see the add before it saved). */
async function _apply(taps: SupplementWidgetTap[], userId: string): Promise<void> {
  const today = toLocalDateString();
  const valid = taps.filter((t) =>
    t && t.userId === userId && t.day === today && typeof t.key === 'string'
    && Number.isFinite(t.amount) && t.amount > 0 && (t.type === 'add' || t.type === 'undo'));
  // An undo whose add is in the same batch cancels it here, without saving either.
  const skip = new Set<number>();
  valid.forEach((tap, i) => {
    if (tap.type !== 'undo') return;
    for (let j = i - 1; j >= 0; j--) {
      const earlier = valid[j];
      if (!skip.has(j) && earlier.type === 'add' && earlier.key === tap.key) {
        skip.add(j);
        skip.add(i);
        return;
      }
    }
  });
  const store = useSupplementStore.getState();
  for (let i = 0; i < valid.length; i++) {
    if (skip.has(i)) continue;
    const tap = valid[i];
    // Signed out (or switched account) meanwhile: the rest belong to someone else.
    if (useAuthStore.getState().user?.id !== userId) return;
    try {
      if (tap.key === 'water') {
        await (tap.type === 'add' ? store.addWater(userId, tap.amount) : store.undoLastWater(userId));
      } else {
        await (tap.type === 'add' ? store.addSupplement(userId, tap.key, tap.amount) : store.undoLastSupplement(userId, tap.key));
      }
    } catch (e) {
      if (__DEV__) console.warn('[SupplementWidget] applying a tap failed:', e);
    }
  }
}

async function _read(): Promise<void> {
  if (_reading) {
    _readAgain = true;
    return _reading;
  }
  _reading = (async () => {
    do {
      _readAgain = false;
      const auth = useAuthStore.getState();
      const userId = auth.user?.id;
      // Not signed in (yet): leave the taps until someone is.
      if (!auth.initialized || !userId) return;
      const taps = await WorkoutLiveActivity.takePendingSupplementTaps();
      if (taps.length > 0) await _apply(taps, userId);
    } while (_readAgain);
  })().finally(() => { _reading = null; });
  return _reading;
}

/** Starts applying Supplements widget taps (and applies any already waiting). Call once at app start. */
export function watchSupplementWidgetTaps(): void {
  if (_started) return;
  // Binaries without the widget (before 1.0.39): nothing to read.
  if (!WorkoutLiveActivity.addSupplementTapListener(() => { _read(); })) return;
  _started = true;
  AppState.addEventListener('change', (s) => { if (s === 'active') _read(); });
  useAuthStore.subscribe((s, prev) => {
    if (s.initialized !== prev.initialized || s.user?.id !== prev.user?.id) _read();
  });
  _read();
}
