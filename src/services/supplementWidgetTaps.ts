/**
 * Supplements widget taps (iOS 17+, 1.0.39+): water or a supplement added from the home screen,
 * and Undo. The widget runs outside the app, so it leaves each tap in a shared outbox
 * (targets/workout-activity/HomeWidgetTaps.swift) and already shows it; this saves the taps.
 *
 * Each read:
 * 1. Save every tap to `supplement_entries`: an add under the id the widget made for it (a retry
 *    after a lost reply is then "already saved", never a second entry), to the day it was tapped
 *    (up to a week back, the app not opened since); an Undo deletes the entry with its add's id.
 * 2. Reload the app's totals for today, while the taps are still in the outbox (so the widget,
 *    which adds them to the app's last data, never shows too little meanwhile).
 * 3. Remove the done taps from the outbox and write the widget data at once, so the widget swaps
 *    its own copy of them for the saved amounts in one go.
 * A tap whose save failed (offline) stays, still showing on the widget, and is tried again on the
 * next read. If today's totals couldn't be reloaded yet (a save in the app is running, offline),
 * today's saved taps stay too and are removed the moment the totals do reload. An Undo delete that
 * fails is tried again on the next read. Taps for another account are dropped.
 *
 * Read when a tap pings the app, when the app comes to the foreground, when the signed-in user
 * changes, and at start (taps made while the app wasn't running). Only while signed in. Plain
 * module, no React state.
 */

import { AppState } from 'react-native';
import * as WorkoutLiveActivity from '../../modules/workout-live-activity';
import type { PendingSupplementWidgetTap } from '../../modules/workout-live-activity';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { parseLocalDate, toLocalDateString } from '../utils/localDate';
import { flushHomeWidgets } from './homeWidgets';

/** How far back a tap the app hadn't seen is still saved. */
const MAX_DAYS_BACK = 7;
/** When today's totals couldn't be reloaded (an in-app save running, offline), read again after this. */
const RETRY_MS = 2000;
/** Postgres unique violation: an entry with this id is already saved. */
const ALREADY_SAVED = '23505';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let _started = false;
/** One read at a time; a ping during a read reads again once it's done. */
let _reading: Promise<void> | null = null;
let _readAgain = false;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;
/** Quick re-reads in a row; after MAX_RETRIES the taps wait for the next ping or foreground. */
let _retries = 0;
/** The last outbox remove failed: quick retries don't start over (a remove that keeps failing stops). */
let _removeFailed = false;
const MAX_RETRIES = 5;

/** Saves an add under its own id; true once it's saved (now or by an earlier try). */
async function _add(userId: string, tap: PendingSupplementWidgetTap): Promise<boolean> {
  const { error } = await supabase
    .from('supplement_entries')
    .insert({ id: tap.id, user_id: userId, type: tap.key, amount: tap.amount, date: tap.day });
  return !error || error.code === ALREADY_SAVED;
}

/**
 * Deletes the entry with this id; true once it's gone (deleting a missing one is fine too). False
 * while another account is signed in: row security would match nothing and report no error, so
 * the delete waits for this account instead.
 */
async function _delete(userId: string, id: string): Promise<boolean> {
  if (useAuthStore.getState().user?.id !== userId) return false;
  try {
    const { error } = await supabase.from('supplement_entries').delete().eq('id', id).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

function _isValid(t: PendingSupplementWidgetTap, earliest: string, today: string): boolean {
  return !!t && typeof t._key === 'string' && typeof t.id === 'string' && UUID.test(t.id)
    && typeof t.day === 'string' && t.day >= earliest && t.day <= today
    && typeof t.key === 'string' && Number.isFinite(t.amount) && t.amount > 0
    && (t.type === 'add' || t.type === 'undo');
}

/**
 * Reloads today's totals (and the goals, if they never loaded: the widget data needs both);
 * `done` when both are in (not: a save in the app is running, offline...); `today` when today's
 * totals reloaded (the goals may still be missing).
 */
async function _reloadToday(userId: string): Promise<{ today: boolean; done: boolean }> {
  const store = useSupplementStore.getState();
  const before = store.todayFor;
  await Promise.all([
    store.fetchTodaySupplements(userId).catch(() => {}),
    store.goalsFor === userId ? null : store.fetchSupplementGoals(userId).catch(() => {}),
  ]);
  const s = useSupplementStore.getState();
  const after = s.todayFor;
  const today = after !== before && after?.userId === userId && after.day === toLocalDateString();
  return { today, done: today && s.goalsFor === userId };
}

function _retrySoon(): void {
  if (_retryTimer || _retries >= MAX_RETRIES) return;
  _retries++;
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    _read();
  }, RETRY_MS);
}

/** `reloaded`: today's totals have reloaded since the last taps were held (the goals may still be missing). */
type Held = { userId: string; day: string; keys: string[]; saved: Map<string, string>; reloaded: boolean };

/**
 * Today's saved taps waiting for today's totals (and the goals, if they never loaded) to reload
 * (a save in the app was running, or the reload failed). They're released the moment both are in,
 * before the app's own (delayed) widget write, so the widget never counts them twice or drops
 * them. Reads leave them alone meanwhile.
 */
let _held: Held | null = null;
let _heldUnsubscribe: (() => void) | null = null;

/** `reloaded`: today's totals already reloaded after these taps were saved (only the goals are missing). */
function _hold(userId: string, day: string, keys: string[], saved: Map<string, string>, reloaded: boolean): void {
  const earlier = _held && _held.userId === userId && _held.day === day ? _held : null;
  // Another account's or day's hold being replaced: watch its saved adds instead.
  if (_held && !earlier) _watchDropped(_held);
  const mine = [...saved].filter(([key]) => keys.includes(key));
  _held = {
    userId,
    day,
    keys: [...new Set([...(earlier ? earlier.keys : []), ...keys])],
    saved: new Map([...(earlier ? [...earlier.saved] : []), ...mine]),
    // Every held tap was saved before the reload that just ran; if it brought today's totals in,
    // only the goals are awaited (or the app's own widget write would count the taps twice).
    reloaded,
  };
  if (_heldUnsubscribe) return;
  _heldUnsubscribe = useSupplementStore.subscribe((s, prev) => {
    const current = _held;
    if (!current) return;
    if (s.todayFor !== prev.todayFor && s.todayFor?.userId === current.userId && s.todayFor.day === current.day) {
      current.reloaded = true;
    }
    if (!current.reloaded || s.goalsFor !== current.userId) return;
    const released = _takeHeld(current.userId, current.day);
    if (released) _finish(released.userId, released.keys, released.saved).catch(() => {});
  });
}

/**
 * Saved adds dropped without the taken-back check (a hold dropped on a new day or an account
 * switch, a read cut short by an account switch): watched as unconfirmed, so if the widget takes
 * one back before a read removes it, the next read still deletes its entry.
 */
function _watchDropped(dropped: { userId: string; saved: Map<string, string> }): void {
  for (const [key, id] of dropped.saved) {
    if (!_removed.has(key)) _unconfirmed.set(key, { userId: dropped.userId, id });
  }
}

/** The held taps for this user and day, now released (null when none). */
function _takeHeld(userId: string, day: string): Held | null {
  const held = _held;
  if (!held || held.userId !== userId || held.day !== day) return null;
  _held = null;
  _heldUnsubscribe?.();
  _heldUnsubscribe = null;
  return held;
}

/**
 * Outbox keys this run is removing or has removed. A read that started before a remove finished
 * can still list them; it skips them, or it would save them again and then, finding them gone
 * from the outbox, take them for an Undo and delete their entry. Keys are unique (time + UUID).
 */
const _removing = new Set<string>();
const _removed = new Set<string>();
const MAX_REMEMBERED = 500;

/**
 * Adds whose save failed (outbox key → entry): the insert may still have gone through (reply
 * lost). If the widget then takes the tap back (Undo before the app saved it), the key leaves the
 * outbox without being removed here, and the entry it may have saved is deleted. Also saved adds
 * dropped without the taken-back check (see _watchDropped).
 */
const _unconfirmed = new Map<string, { userId: string; id: string }>();

/** Undo deletes (of adds taken back while being saved) that failed: tried again on each read. */
let _failedDeletes: { userId: string; id: string }[] = [];

/**
 * Removes done taps from the outbox and writes the widget data at once. An add the widget took
 * back (Undo) while it was being saved is no longer there: its entry is deleted again. False when
 * it's unknown whether the taps were removed.
 */
async function _finish(userId: string, keys: string[], saved: Map<string, string>): Promise<boolean> {
  if (keys.length === 0) return true;
  // Gone because this module removed them earlier (another account's read dropped them), not
  // taken back on the widget: never deleted as an Undo.
  const removedEarlier = new Set(keys.filter((key) => _removed.has(key)));
  keys.forEach((key) => _removing.add(key));
  let removed: string[] | null = null;
  try {
    removed = await WorkoutLiveActivity.removeSupplementTaps(keys);
    // Into _removed before leaving _removing, so a read never sees them in neither.
    removed?.forEach((key) => {
      _removed.add(key);
      // Removed here, not taken back: nothing left to watch (and once _removed forgets the key,
      // a stale entry would look taken back and delete a saved add).
      _unconfirmed.delete(key);
    });
    // Oldest first (insertion order); only a guard, far beyond one run's taps.
    for (const key of _removed) {
      if (_removed.size <= MAX_REMEMBERED) break;
      _removed.delete(key);
    }
  } finally {
    keys.forEach((key) => _removing.delete(key));
  }
  if (!removed) {
    // Unknown whether they went: leave them; their saves are recognised as done next time. (Not
    // watched as unconfirmed: if they did go, the next read would take them for an Undo and
    // delete saved adds; for the same reason, those already watched stop being watched: a lost
    // Undo is better than a deleted entry.)
    for (const key of keys) {
      _unconfirmed.delete(key);
    }
    _retrySoon();
    return false;
  }
  await flushHomeWidgets(['supplements']);
  const takenBack = [...saved]
    .filter(([key]) => keys.includes(key) && !removed.includes(key) && !removedEarlier.has(key))
    .map(([, id]) => id);
  if (takenBack.length === 0) return true;
  let failedDelete = false;
  for (const id of takenBack) {
    if (await _delete(userId, id)) continue;
    _failedDeletes.push({ userId, id });
    failedDelete = true;
  }
  const stillSignedIn = useAuthStore.getState().user?.id === userId;
  // Another account's deletes wait for it to sign in again: no quick retries for them.
  if (failedDelete && stillSignedIn) _retrySoon();
  if (stillSignedIn && (await _reloadToday(userId)).done) {
    await flushHomeWidgets(['supplements']);
  }
  return true;
}

/** Saves the taps in order, one at a time, then brings the outbox, the app and the widget in line. */
async function _apply(taps: PendingSupplementWidgetTap[], userId: string): Promise<void> {
  const today = toLocalDateString();
  const oldest = parseLocalDate(today);
  oldest.setDate(oldest.getDate() - MAX_DAYS_BACK);
  const earliest = toLocalDateString(oldest);

  // Held on an earlier day: that day's totals never reload now, so let this read save them again
  // (already saved) and remove them. Watched meanwhile, in case the widget took one back.
  if (_held && _held.userId === userId && _held.day !== today) {
    const dropped = _takeHeld(userId, _held.day);
    if (dropped) _watchDropped(dropped);
  }

  // Undo deletes that failed earlier.
  let retriedDelete = false;
  let failedDelete = false;
  const failed = _failedDeletes.filter((d) => d.userId === userId);
  _failedDeletes = _failedDeletes.filter((d) => d.userId !== userId);
  for (const d of failed) {
    if (await _delete(userId, d.id)) retriedDelete = true;
    else {
      _failedDeletes.push(d);
      failedDelete = true;
    }
  }

  // Adds that may be saved (a failed save, a dropped hold) and have since been taken back on the
  // widget: delete what they may have saved.
  const listed = new Set(taps.map((t) => t?._key));
  for (const [key, entry] of [..._unconfirmed]) {
    if (_removed.has(key)) {
      _unconfirmed.delete(key); // removed here, not taken back
      continue;
    }
    if (entry.userId !== userId || listed.has(key) || _removing.has(key)) continue;
    _unconfirmed.delete(key);
    if (await _delete(userId, entry.id)) retriedDelete = true;
    else {
      _failedDeletes.push(entry);
      failedDelete = true;
    }
  }
  if (failedDelete) _retrySoon();

  /** Done taps (saved, or dropped: another account, too old, unreadable) → their day ('' = dropped). */
  const done = new Map<string, string>();
  /** Saved adds: outbox key → entry id. */
  const saved = new Map<string, string>();
  const held = new Set(_held && _held.userId === userId ? _held.keys : []);
  const valid: PendingSupplementWidgetTap[] = [];
  for (const t of taps) {
    if (t && held.has(t._key)) continue; // saved already, waiting for today's totals
    if (t && (_removing.has(t._key) || _removed.has(t._key))) continue; // being removed (or gone) already
    if (t?.userId === userId && _isValid(t, earliest, today)) valid.push(t);
    else if (typeof t?._key === 'string') done.set(t._key, '');
  }
  // An undo whose add is in the same batch cancels it here, without saving either.
  const skip = new Set<number>();
  valid.forEach((tap, i) => {
    if (tap.type !== 'undo') return;
    const j = valid.findIndex((add, k) => k < i && !skip.has(k) && add.type === 'add' && add.id === tap.id);
    if (j < 0) return;
    skip.add(j);
    skip.add(i);
    done.set(valid[j]._key, '');
    done.set(tap._key, '');
  });
  for (let i = 0; i < valid.length; i++) {
    if (skip.has(i)) continue;
    const tap = valid[i];
    // Signed out (or switched account) meanwhile: leave the rest for their account.
    if (useAuthStore.getState().user?.id !== userId) {
      _watchDropped({ userId, saved });
      return;
    }
    try {
      if (tap.type === 'add') _unconfirmed.set(tap._key, { userId, id: tap.id });
      const ok = tap.type === 'add' ? await _add(userId, tap) : await _delete(userId, tap.id);
      if (!ok) continue; // stays in the outbox for the next read
      _unconfirmed.delete(tap._key);
      if (tap.type === 'add') saved.set(tap._key, tap.id);
      done.set(tap._key, tap.day);
    } catch (e) {
      if (__DEV__) console.warn('[SupplementWidget] saving a tap failed:', e);
    }
  }
  if (useAuthStore.getState().user?.id !== userId) {
    _watchDropped({ userId, saved });
    return;
  }

  // Today's totals first, while the taps are still on the widget.
  const savedDays = new Set([...done.values()].filter(Boolean));
  const todayKeys = [...done.keys()].filter((key) => done.get(key) === today);
  let keys = [...done.keys()].filter((key) => done.get(key) !== today);
  let finishSaved = saved;
  if (todayKeys.length > 0 || held.size > 0 || retriedDelete) {
    const reload = await _reloadToday(userId);
    // Signed out (or switched account) meanwhile: not held for an account that's gone; watched.
    if (useAuthStore.getState().user?.id !== userId) {
      _watchDropped({ userId, saved });
      return;
    }
    if (reload.done) {
      keys = [...keys, ...todayKeys];
      // Taps held from an earlier read go with them (unless the reload already released them).
      const earlier = _takeHeld(userId, today);
      if (earlier) {
        keys = [...keys, ...earlier.keys];
        finishSaved = new Map([...saved, ...earlier.saved]);
      }
      if (keys.length === 0) await flushHomeWidgets(['supplements']);
    } else if (todayKeys.length > 0 || held.size > 0) {
      // Not reloaded: today's taps wait (still showing) until it is.
      if (todayKeys.length > 0) _hold(userId, today, todayKeys, saved, reload.today);
      _retrySoon();
    }
  }
  const store = useSupplementStore.getState();
  if (store.dateEntriesDate && savedDays.has(store.dateEntriesDate)) {
    store.fetchDateSupplements(userId, store.dateEntriesDate).catch(() => {});
  }
  if (keys.length === 0) return;
  // Before _finish, so a failed delete in it can still retry; not after a failed remove, so a
  // remove that keeps failing stops after MAX_RETRIES instead of retrying every 2 s for good.
  if (!_held && !_removeFailed) _retries = 0;
  _removeFailed = !(await _finish(userId, keys, finishSaved));
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
      const taps = await WorkoutLiveActivity.readPendingSupplementTaps();
      // The read failed: a missing tap would look taken back (and its saved entry be deleted).
      if (taps === null) {
        _retrySoon();
        continue;
      }
      // Also with an empty outbox: an unconfirmed add may have been taken back, a delete may need a retry.
      if (taps.length > 0 || _unconfirmed.size > 0 || _failedDeletes.length > 0) await _apply(taps, userId);
    } while (_readAgain);
  })().finally(() => { _reading = null; });
  return _reading;
}

/** Starts saving Supplements widget taps (and saves any already waiting). Call once at app start. */
export function watchSupplementWidgetTaps(): void {
  if (_started) return;
  // Binaries without the widget (before 1.0.39): nothing to read.
  if (!WorkoutLiveActivity.addSupplementTapListener(() => { _read(); })) return;
  _started = true;
  AppState.addEventListener('change', (s) => {
    if (s !== 'active') return;
    _retries = 0;
    _read();
  });
  useAuthStore.subscribe((s, prev) => {
    // Another account (or none): the previous one's held taps are dropped from the outbox by the
    // next read (they're saved), so they must not be released later as if taken back.
    // Watched meanwhile, in case the widget takes one back first.
    if (s.user?.id !== prev.user?.id && _held) {
      const dropped = _takeHeld(_held.userId, _held.day);
      if (dropped) _watchDropped(dropped);
    }
    if (s.initialized !== prev.initialized || s.user?.id !== prev.user?.id) _read();
  });
  _read();
}
