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
const MAX_RETRIES = 5;

/** Saves an add under its own id; true once it's saved (now or by an earlier try). */
async function _add(userId: string, tap: PendingSupplementWidgetTap): Promise<boolean> {
  const { error } = await supabase
    .from('supplement_entries')
    .insert({ id: tap.id, user_id: userId, type: tap.key, amount: tap.amount, date: tap.day });
  return !error || error.code === ALREADY_SAVED;
}

/** Deletes the entry with this id; true once it's gone (deleting a missing one is fine too). */
async function _delete(userId: string, id: string): Promise<boolean> {
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

/** Reloads today's totals; true when they were reloaded (false: a save in the app is running, offline...). */
async function _reloadToday(userId: string): Promise<boolean> {
  const store = useSupplementStore.getState();
  const before = store.todayFor;
  await store.fetchTodaySupplements(userId).catch(() => {});
  const after = useSupplementStore.getState().todayFor;
  return after !== before && after?.userId === userId && after.day === toLocalDateString();
}

function _retrySoon(): void {
  if (_retryTimer || _retries >= MAX_RETRIES) return;
  _retries++;
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    _read();
  }, RETRY_MS);
}

type Held = { userId: string; day: string; keys: string[]; saved: Map<string, string> };

/**
 * Today's saved taps waiting for today's totals to reload (a save in the app was running, or the
 * reload failed). They're released the moment the totals reload, before the app's own (delayed)
 * widget write, so the widget never counts them twice. Reads leave them alone meanwhile.
 */
let _held: Held | null = null;
let _heldUnsubscribe: (() => void) | null = null;

function _hold(userId: string, day: string, keys: string[], saved: Map<string, string>): void {
  const earlier = _held && _held.userId === userId && _held.day === day ? _held : null;
  const mine = [...saved].filter(([key]) => keys.includes(key));
  _held = {
    userId,
    day,
    keys: [...new Set([...(earlier ? earlier.keys : []), ...keys])],
    saved: new Map([...(earlier ? [...earlier.saved] : []), ...mine]),
  };
  if (_heldUnsubscribe) return;
  _heldUnsubscribe = useSupplementStore.subscribe((s, prev) => {
    const current = _held;
    if (!current || s.todayFor === prev.todayFor) return;
    if (s.todayFor?.userId !== current.userId || s.todayFor.day !== current.day) return;
    const released = _takeHeld(current.userId, current.day);
    if (released) _finish(released.userId, released.keys, released.saved).catch(() => {});
  });
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
 * outbox without being removed here, and the entry it may have saved is deleted.
 */
const _unconfirmed = new Map<string, { userId: string; id: string }>();

/** Undo deletes (of adds taken back while being saved) that failed: tried again on each read. */
let _failedDeletes: { userId: string; id: string }[] = [];

/**
 * Removes done taps from the outbox and writes the widget data at once. An add the widget took
 * back (Undo) while it was being saved is no longer there: its entry is deleted again.
 */
async function _finish(userId: string, keys: string[], saved: Map<string, string>): Promise<void> {
  if (keys.length === 0) return;
  // Gone because this module removed them earlier (another account's read dropped them), not
  // taken back on the widget: never deleted as an Undo.
  const removedEarlier = new Set(keys.filter((key) => _removed.has(key)));
  keys.forEach((key) => _removing.add(key));
  let removed: string[] | null = null;
  try {
    removed = await WorkoutLiveActivity.removeSupplementTaps(keys);
    // Into _removed before leaving _removing, so a read never sees them in neither.
    removed?.forEach((key) => _removed.add(key));
    // Oldest first (insertion order); only a guard, far beyond one run's taps.
    for (const key of _removed) {
      if (_removed.size <= MAX_REMEMBERED) break;
      _removed.delete(key);
    }
  } finally {
    keys.forEach((key) => _removing.delete(key));
  }
  if (!removed) {
    // Unknown whether they went: leave them; their saves are recognised as done next time.
    _retrySoon();
    return;
  }
  await flushHomeWidgets(['supplements']);
  const takenBack = [...saved]
    .filter(([key]) => keys.includes(key) && !removed.includes(key) && !removedEarlier.has(key))
    .map(([, id]) => id);
  if (takenBack.length === 0) return;
  for (const id of takenBack) {
    if (!(await _delete(userId, id))) _failedDeletes.push({ userId, id });
  }
  if (await _reloadToday(userId)) await flushHomeWidgets(['supplements']);
}

/** Saves the taps in order, one at a time, then brings the outbox, the app and the widget in line. */
async function _apply(taps: PendingSupplementWidgetTap[], userId: string): Promise<void> {
  const today = toLocalDateString();
  const oldest = parseLocalDate(today);
  oldest.setDate(oldest.getDate() - MAX_DAYS_BACK);
  const earliest = toLocalDateString(oldest);

  // Undo deletes that failed earlier.
  let retriedDelete = false;
  const failed = _failedDeletes.filter((d) => d.userId === userId);
  _failedDeletes = _failedDeletes.filter((d) => d.userId !== userId);
  for (const d of failed) {
    if (await _delete(userId, d.id)) retriedDelete = true;
    else _failedDeletes.push(d);
  }

  // Adds that failed to save and have since been taken back on the widget: delete what they may have saved.
  const listed = new Set(taps.map((t) => t?._key));
  for (const [key, entry] of [..._unconfirmed]) {
    if (entry.userId !== userId || listed.has(key) || _removing.has(key) || _removed.has(key)) continue;
    _unconfirmed.delete(key);
    if (await _delete(userId, entry.id)) retriedDelete = true;
    else _failedDeletes.push(entry);
  }

  /** Done taps (saved, or dropped: another account, too old, unreadable) → their day ('' = dropped). */
  const done = new Map<string, string>();
  /** Saved adds: outbox key → entry id. */
  const saved = new Map<string, string>();
  // Held on an earlier day: that day's totals never reload now, so let this read save them again
  // (already saved) and remove them.
  if (_held && _held.userId === userId && _held.day !== today) _takeHeld(userId, _held.day);
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
    if (useAuthStore.getState().user?.id !== userId) return;
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
  if (useAuthStore.getState().user?.id !== userId) return;

  // Today's totals first, while the taps are still on the widget.
  const savedDays = new Set([...done.values()].filter(Boolean));
  const todayKeys = [...done.keys()].filter((key) => done.get(key) === today);
  let keys = [...done.keys()].filter((key) => done.get(key) !== today);
  let finishSaved = saved;
  if (todayKeys.length > 0 || held.size > 0 || retriedDelete) {
    if (await _reloadToday(userId)) {
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
      if (todayKeys.length > 0) _hold(userId, today, todayKeys, saved);
      _retrySoon();
    }
  }
  const store = useSupplementStore.getState();
  if (store.dateEntriesDate && savedDays.has(store.dateEntriesDate)) {
    store.fetchDateSupplements(userId, store.dateEntriesDate).catch(() => {});
  }
  if (keys.length === 0) return;
  if (!_held) _retries = 0;
  await _finish(userId, keys, finishSaved);
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
    if (s.user?.id !== prev.user?.id && _held) _takeHeld(_held.userId, _held.day);
    if (s.initialized !== prev.initialized || s.user?.id !== prev.user?.id) _read();
  });
  _read();
}
