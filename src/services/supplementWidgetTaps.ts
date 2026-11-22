/**
 * Supplements widget taps (iOS 17+, 1.0.39+): water or a supplement added from the home screen,
 * and Undo. The widget runs outside the app, so it leaves each tap in a shared outbox
 * (targets/workout-activity/HomeWidgetTaps.swift) and already shows it; this reads the outbox and
 * saves the taps.
 *
 * Read when a tap pings the app, when the app comes to the foreground, when the signed-in user
 * changes, and at start (taps made while the app wasn't running). Only while signed in: a tap
 * for another account is dropped. A tap from an earlier day (the app wasn't opened since) is saved
 * to that day, up to a week back. Plain module, no React state.
 */

import { AppState } from 'react-native';
import * as WorkoutLiveActivity from '../../modules/workout-live-activity';
import type { SupplementWidgetTap } from '../../modules/workout-live-activity';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { parseLocalDate, toLocalDateString } from '../utils/localDate';

/** How far back a tap the app hadn't seen is still saved. */
const MAX_DAYS_BACK = 7;
/** Allowance for the phone's clock against the server's when matching an undo to its add. */
const CLOCK_SLACK_MS = 10 * 60 * 1000;

let _started = false;
/** One read at a time; a ping during a read reads again once it's done. */
let _reading: Promise<void> | null = null;
let _readAgain = false;

/** Reloads what the app shows for `day` after a change made around the store. */
function _refresh(userId: string, day: string): void {
  const store = useSupplementStore.getState();
  if (day === toLocalDateString()) store.fetchTodaySupplements(userId);
  if (store.dateEntriesDate === day) store.fetchDateSupplements(userId, day);
}

/** Saves an add from an earlier day to that day (today's go through the store, instantly). */
async function _addToDay(userId: string, tap: SupplementWidgetTap): Promise<void> {
  const { error } = await supabase.from('supplement_entries').insert({
    user_id: userId,
    type: tap.key,
    amount: tap.amount,
    date: tap.day,
  });
  if (!error) _refresh(userId, tap.day);
}

/**
 * Takes back the add an Undo refers to: the latest entry of that supplement, amount and day saved
 * since the tap. Nothing matching (its save failed, or it was already removed) = nothing to undo,
 * so an entry logged another way is never removed instead.
 */
async function _undo(userId: string, tap: SupplementWidgetTap): Promise<void> {
  const since = new Date((tap.addedAt ?? tap.at) - CLOCK_SLACK_MS).toISOString();
  const { data } = await supabase
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
  if (!data) return;
  const { error } = await supabase.from('supplement_entries').delete().eq('id', data.id);
  if (!error) _refresh(userId, tap.day);
}

/** Adds and undos in order, one at a time (an undo must see the add before it saved). */
async function _apply(taps: SupplementWidgetTap[], userId: string): Promise<void> {
  const today = toLocalDateString();
  const oldest = parseLocalDate(today);
  oldest.setDate(oldest.getDate() - MAX_DAYS_BACK);
  const earliest = toLocalDateString(oldest);
  const valid = taps.filter((t) =>
    t && t.userId === userId && typeof t.day === 'string' && t.day >= earliest && t.day <= today
    && typeof t.key === 'string' && Number.isFinite(t.amount) && t.amount > 0
    && (t.type === 'add' || t.type === 'undo'));
  // An undo whose add is in the same batch cancels it here, without saving either.
  const skip = new Set<number>();
  valid.forEach((tap, i) => {
    if (tap.type !== 'undo') return;
    for (let j = i - 1; j >= 0; j--) {
      const earlier = valid[j];
      if (!skip.has(j) && earlier.type === 'add' && earlier.key === tap.key && earlier.day === tap.day) {
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
      if (tap.type === 'undo') {
        await _undo(userId, tap);
      } else if (tap.day !== today) {
        await _addToDay(userId, tap);
      } else if (tap.key === 'water') {
        await store.addWater(userId, tap.amount);
      } else {
        await store.addSupplement(userId, tap.key, tap.amount);
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
