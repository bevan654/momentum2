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
 * next read. If today's totals couldn't be reloaded yet, today's taps also stay and are read again
 * shortly (their saves are then recognised as done). Taps for another account are dropped.
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
  const { error } = await supabase.from('supplement_entries').delete().eq('id', id).eq('user_id', userId);
  return !error;
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

/** Saves the taps in order, one at a time, then brings the outbox, the app and the widget in line. */
async function _apply(taps: PendingSupplementWidgetTap[], userId: string): Promise<void> {
  const today = toLocalDateString();
  const oldest = parseLocalDate(today);
  oldest.setDate(oldest.getDate() - MAX_DAYS_BACK);
  const earliest = toLocalDateString(oldest);

  /** Done taps (saved, or dropped: another account, too old, unreadable) → their day ('' = dropped). */
  const done = new Map<string, string>();
  /** Saved adds: outbox key → entry id. */
  const saved = new Map<string, string>();
  const valid: PendingSupplementWidgetTap[] = [];
  for (const t of taps) {
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
      const ok = tap.type === 'add' ? await _add(userId, tap) : await _delete(userId, tap.id);
      if (!ok) continue; // stays in the outbox for the next read
      if (tap.type === 'add') saved.set(tap._key, tap.id);
      done.set(tap._key, tap.day);
    } catch (e) {
      if (__DEV__) console.warn('[SupplementWidget] saving a tap failed:', e);
    }
  }
  if (done.size === 0 || useAuthStore.getState().user?.id !== userId) return;

  // Today's totals first, while the taps are still on the widget. Not reloaded: today's taps wait
  // (still showing) and are read again shortly.
  const savedDays = new Set([...done.values()].filter(Boolean));
  let toRemove = [...done.keys()];
  if (savedDays.has(today) && !(await _reloadToday(userId))) {
    toRemove = toRemove.filter((key) => done.get(key) !== today);
    _retrySoon();
  }
  const store = useSupplementStore.getState();
  if (store.dateEntriesDate && savedDays.has(store.dateEntriesDate)) {
    store.fetchDateSupplements(userId, store.dateEntriesDate).catch(() => {});
  }
  if (toRemove.length === 0) return;

  const removed = await WorkoutLiveActivity.removeSupplementTaps(toRemove);
  if (!removed) {
    // Unknown whether they went: leave them; their saves are recognised as done next time.
    _retrySoon();
    return;
  }
  _retries = 0;
  await flushHomeWidgets(['supplements']);

  // An add the widget took back (Undo) while it was being saved: delete the entry it created,
  // then update the app and the widget again.
  const takenBack = [...saved].filter(([key]) => toRemove.includes(key) && !removed.includes(key));
  if (takenBack.length === 0) return;
  for (const [, id] of takenBack) await _delete(userId, id).catch(() => false);
  await _reloadToday(userId);
  await flushHomeWidgets(['supplements']);
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
      if (taps.length > 0) await _apply(taps, userId);
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
    if (s.initialized !== prev.initialized || s.user?.id !== prev.user?.id) _read();
  });
  _read();
}
