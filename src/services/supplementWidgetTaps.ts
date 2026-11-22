/**
 * Supplements widget taps (iOS 17+, 1.0.39+): water or a supplement added from the home screen,
 * and Undo. The widget runs outside the app, so it leaves each tap in a shared outbox
 * (targets/workout-activity/HomeWidgetTaps.swift) and already shows it; this saves the taps.
 *
 * Each read: save every tap (a tap from an earlier day, the app not opened since, goes to that
 * day, up to a week back), reload the app's supplement totals, remove from the outbox the taps
 * that are done, then write the widget data and redraw the widget, so it swaps its own copy of
 * the taps for the saved amounts in one go. A tap whose save failed (offline) stays in the outbox,
 * still showing on the widget, and is tried again on the next read. Taps for another account are
 * dropped.
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
/** Allowance for the phone's clock against the server's when matching an undo to its add. */
const CLOCK_SLACK_MS = 2 * 60 * 1000;

let _started = false;
/** One read at a time; a ping during a read reads again once it's done. */
let _reading: Promise<void> | null = null;
let _readAgain = false;

/** Saves an add to its own day; the new entry's id, or null when the save failed. */
async function _add(userId: string, tap: PendingSupplementWidgetTap): Promise<string | null> {
  const { data, error } = await supabase
    .from('supplement_entries')
    .insert({ user_id: userId, type: tap.key, amount: tap.amount, date: tap.day })
    .select('id')
    .single();
  return error || !data ? null : String(data.id);
}

/**
 * Takes back the add an Undo refers to: the latest entry of that supplement, amount and day saved
 * since the tap (the widget only sends an Undo once its add left the outbox, i.e. was saved).
 * Nothing matching = nothing to undo, so an entry logged another way is never removed instead.
 * False when it couldn't be checked or removed (offline): tried again later.
 */
async function _undo(userId: string, tap: PendingSupplementWidgetTap): Promise<boolean> {
  const since = new Date((tap.addedAt ?? tap.at) - CLOCK_SLACK_MS).toISOString();
  const { data, error } = await supabase
    .from('supplement_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', tap.day)
    .eq('type', tap.key)
    .eq('amount', tap.amount)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return false;
  if (!data) return true;
  return _delete(data.id);
}

async function _delete(id: string): Promise<boolean> {
  const { error } = await supabase.from('supplement_entries').delete().eq('id', id);
  return !error;
}

function _isValid(t: PendingSupplementWidgetTap, earliest: string, today: string): boolean {
  return !!t && typeof t._key === 'string' && typeof t.day === 'string' && t.day >= earliest && t.day <= today
    && typeof t.key === 'string' && Number.isFinite(t.amount) && t.amount > 0
    && (t.type === 'add' || t.type === 'undo');
}

/** Saves the taps in order, one at a time; resolves when the outbox, the app and the widget agree. */
async function _apply(taps: PendingSupplementWidgetTap[], userId: string): Promise<void> {
  const today = toLocalDateString();
  const oldest = parseLocalDate(today);
  oldest.setDate(oldest.getDate() - MAX_DAYS_BACK);
  const earliest = toLocalDateString(oldest);

  /** Outbox keys to remove: saved, or dropped (another account, too old, unreadable). */
  const done: string[] = [];
  /** Saved adds: outbox key → the entry it created. */
  const saved = new Map<string, string>();
  const days = new Set<string>();
  const valid: PendingSupplementWidgetTap[] = [];
  for (const t of taps) {
    if (t?.userId === userId && _isValid(t, earliest, today)) valid.push(t);
    else if (typeof t?._key === 'string') done.push(t._key);
  }
  // An undo whose add is in the same batch cancels it here, without saving either.
  const skip = new Set<number>();
  valid.forEach((tap, i) => {
    if (tap.type !== 'undo') return;
    for (let j = i - 1; j >= 0; j--) {
      const add = valid[j];
      if (!skip.has(j) && add.type === 'add' && add.key === tap.key && add.day === tap.day && add.amount === tap.amount) {
        skip.add(j);
        skip.add(i);
        done.push(add._key, tap._key);
        return;
      }
    }
  });
  for (let i = 0; i < valid.length; i++) {
    if (skip.has(i)) continue;
    const tap = valid[i];
    // Signed out (or switched account) meanwhile: leave the rest for their account.
    if (useAuthStore.getState().user?.id !== userId) break;
    try {
      if (tap.type === 'add') {
        const id = await _add(userId, tap);
        if (!id) continue; // not saved: stays in the outbox for the next read
        saved.set(tap._key, id);
      } else if (!(await _undo(userId, tap))) {
        continue;
      }
      done.push(tap._key);
      days.add(tap.day);
    } catch (e) {
      if (__DEV__) console.warn('[SupplementWidget] saving a tap failed:', e);
    }
  }

  // The widget may have taken an add back (Undo) while it was being saved: then remove the entry
  // it created. Keys still there are removed now; the widget's own copy of them goes with them.
  const removed = new Set(await WorkoutLiveActivity.removeSupplementTaps(done));
  for (const [key, id] of saved) {
    if (!removed.has(key)) await _delete(id).catch(() => false);
  }

  // The app's totals and day list, then the widget's data, from the saved entries.
  if (days.size > 0 && useAuthStore.getState().user?.id === userId) {
    const store = useSupplementStore.getState();
    if (days.has(today)) await store.fetchTodaySupplements(userId).catch(() => {});
    if (store.dateEntriesDate && days.has(store.dateEntriesDate)) {
      await store.fetchDateSupplements(userId, store.dateEntriesDate).catch(() => {});
    }
  }
  if (done.length > 0) await flushHomeWidgets(['supplements']);
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
  AppState.addEventListener('change', (s) => { if (s === 'active') _read(); });
  useAuthStore.subscribe((s, prev) => {
    if (s.initialized !== prev.initialized || s.user?.id !== prev.user?.id) _read();
  });
  _read();
}
