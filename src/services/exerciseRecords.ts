/**
 * Exercise records — every earlier completed working set of the exercises in the running
 * workout, for the Lock Screen's PR badge ("Heaviest ever", "Most reps at 80 kg").
 *
 * Read-through cache: `getExerciseHistorySets` returns what's loaded and, for exercises not
 * loaded yet, starts loading them: one small request per exercise, once per workout (the same
 * `exercises → sets` read the exercise history page makes). Everything is dropped when a different workout asks, so a workout finished
 * earlier today counts as history in the next one. Listeners hear when a batch lands, so the
 * Lock Screen can be refreshed. Plain module, no React state.
 */

import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/currentUser';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { isSupported as liveActivitiesSupported } from '../../modules/workout-live-activity';

export interface RecordSet {
  kg: number;
  reps: number;
}

/** Sessions read per exercise, newest first (about three years of weekly training). */
const SESSION_LIMIT = 150;
/** After a failed request (offline at the gym), wait this long before asking again. */
const RETRY_AFTER_MS = 60_000;

let _key = '';
/** Name → completed non-warm-up sets from earlier workouts ([] = no history). */
let _sets = new Map<string, RecordSet[]>();
const _loading = new Set<string>();
const _queued = new Set<string>();
let _failedAt = 0;
let _batchTimer: ReturnType<typeof setTimeout> | null = null;
const _listeners = new Set<() => void>();

/** Runs `listener` whenever new history arrives. Returns an unsubscribe function. */
export function onExerciseRecordsLoaded(listener: () => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

/**
 * Earlier sets of `name`, or undefined while they're loading (or couldn't be loaded).
 * `workoutId` is the running workout: its own rows (a workout reopened with Undo is already
 * saved) are left out, since the app counts its sets itself.
 */
export function getExerciseHistorySets(name: string, workoutId: string | null): RecordSet[] | undefined {
  // Only the iOS Lock Screen Live Activity shows PRs (not Android, nor the older notification on
  // iOS < 16.2 or with Live Activities off): no requests elsewhere.
  if (Platform.OS !== 'ios' || !liveActivitiesSupported()) return undefined;
  const userId = getCurrentUserId();
  if (!userId || !name) return undefined;
  const key = `${userId}|${workoutId ?? ''}`;
  if (key !== _key) {
    _key = key;
    _sets = new Map();
    _loading.clear();
    _queued.clear();
    _failedAt = 0;
    // The previous workout's batch would load this one's names under its own key and drop them.
    if (_batchTimer) { clearTimeout(_batchTimer); _batchTimer = null; }
  }
  const cached = _sets.get(name);
  if (cached) return cached;
  if (!_loading.has(name) && Date.now() - _failedAt > RETRY_AFTER_MS) {
    _queued.add(name);
    if (!_batchTimer) _batchTimer = setTimeout(() => _load(userId, workoutId, key), 250);
  }
  return undefined;
}

async function _load(userId: string, workoutId: string | null, key: string): Promise<void> {
  _batchTimer = null;
  const names = [..._queued];
  _queued.clear();
  if (names.length === 0) return;
  names.forEach((n) => _loading.add(n));
  // One request per exercise, so a long-trained exercise can't crowd the others out of the limit.
  const results = await Promise.all(names.map((name) => _loadOne(userId, workoutId, name)));
  if (key !== _key) return; // another workout started meanwhile (its own loads are tracked anew)
  names.forEach((n) => _loading.delete(n));
  let loaded = false;
  results.forEach((sets, i) => {
    if (sets) { _sets.set(names[i], sets); loaded = true; }
  });
  if (results.some((s) => s === null)) _failedAt = Date.now();
  if (loaded) _listeners.forEach((l) => l());
}

/**
 * Every name the exercise has been logged under: its own, its current catalog name, and the
 * catalog's older names for it (exercise_aliases), so a renamed exercise keeps its history.
 */
function _loggedNames(name: string): string[] {
  const { aliasMap } = useWorkoutStore.getState();
  const canonical = aliasMap[name] ?? name;
  const names = new Set([name, canonical]);
  for (const [alias, target] of Object.entries(aliasMap)) {
    if (target === canonical) names.add(alias);
  }
  return [...names];
}

/** The exercise's earlier working sets, newest sessions first; null if the request failed. */
async function _loadOne(userId: string, workoutId: string | null, name: string): Promise<RecordSet[] | null> {
  try {
    let query = supabase
      .from('exercises')
      .select('workout_id, sets(kg, reps, completed, set_type), workouts!inner(user_id, created_at)')
      .eq('workouts.user_id', userId)
      .in('name', _loggedNames(name));
    if (workoutId) query = query.neq('workout_id', workoutId);
    // exercises.created_at is when the workout was saved; ordering on the embedded workout
    // would only sort inside each row, so the limit wouldn't keep the newest sessions.
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(SESSION_LIMIT);
    if (error) throw error;
    const sets: RecordSet[] = [];
    for (const row of (data ?? []) as any[]) {
      for (const s of row.sets ?? []) {
        if (!s.completed || s.set_type === 'warmup') continue;
        const reps = Number(s.reps) || 0;
        if (reps <= 0) continue;
        sets.push({ kg: Number(s.kg) || 0, reps });
      }
    }
    return sets;
  } catch (e) {
    if (__DEV__) console.warn('[exerciseRecords] load failed:', e);
    return null;
  }
}
