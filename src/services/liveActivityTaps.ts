/**
 * Lock Screen taps (iOS 17+, 1.0.38+): Done set, − / + reps and End rest on the workout Live
 * Activity. The native side has already updated the activity and saved the tap in a shared
 * outbox; this reads the outbox and hands the taps to the store (setLockScreenTapHandler),
 * which applies them with the same actions as tapping in the app.
 *
 * Read when a tap pings the app, when the app comes to the foreground, and when watching starts
 * (taps made while the app wasn't running). Plain module, no React state.
 */

import { AppState } from 'react-native';
import type { NativeEventSubscription } from 'react-native';
import * as WorkoutLiveActivity from '../../modules/workout-live-activity';
import type { WorkoutLiveActivityAction } from '../../modules/workout-live-activity';

type TapHandler = (actions: WorkoutLiveActivityAction[]) => void;

let _handler: TapHandler | null = null;
let _tapSub: { remove(): void } | null = null;
let _appStateSub: NativeEventSubscription | null = null;
/** One read at a time; a ping during a read reads again once it's done. */
let _reading: Promise<void> | null = null;
let _readAgain = false;

/** The store's applier. Set once at startup. */
export function setLockScreenTapHandler(handler: TapHandler): void {
  _handler = handler;
}

async function _read(): Promise<void> {
  if (_reading) {
    _readAgain = true;
    return _reading;
  }
  _reading = (async () => {
    do {
      _readAgain = false;
      const actions = await WorkoutLiveActivity.takePendingActions();
      if (actions.length > 0 && _handler) {
        try {
          _handler(actions);
        } catch (e) {
          if (__DEV__) console.warn('[LiveActivity] applying Lock Screen taps failed:', e);
        }
      }
    } while (_readAgain);
  })().finally(() => { _reading = null; });
  return _reading;
}

/** Starts applying taps (and applies any already waiting). Safe to call twice. */
export function watchLockScreenTaps(): void {
  if (!_tapSub) _tapSub = WorkoutLiveActivity.addActionListener(() => { _read(); });
  if (!_appStateSub) {
    _appStateSub = AppState.addEventListener('change', (s) => { if (s === 'active') _read(); });
  }
  _read();
}

export function stopWatchingLockScreenTaps(): void {
  _tapSub?.remove();
  _tapSub = null;
  _appStateSub?.remove();
  _appStateSub = null;
}

/** Throws away waiting taps: the workout they were for is gone. */
export function dropLockScreenTaps(): void {
  WorkoutLiveActivity.clearPendingActions();
}
