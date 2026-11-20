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

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';

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
  const userId = useAuthStore.getState().user?.id;
  if (!userId || !name) return undefined;
  const key = `${userId}|${workoutId ?? ''}`;
  if (key !== _key) {
    _key = key;
    _sets = new Map();
    _loading.clear();
    _queued.clear();
    _failedAt = 0;
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
  names.forEach((n) => _loading.delete(n));
  if (key !== _key) return; // another workout started meanwhile
  let loaded = false;
  results.forEach((sets, i) => {
    if (sets) { _sets.set(names[i], sets); loaded = true; }
  });
  if (results.some((s) => s === null)) _failedAt = Date.now();
  if (loaded) _listeners.forEach((l) => l());
}

/** The exercise's earlier working sets, newest sessions first; null if the request failed. */
async function _loadOne(userId: string, workoutId: string | null, name: string): Promise<RecordSet[] | null> {
  try {
    let query = supabase
      .from('exercises')
      .select('workout_id, sets(kg, reps, completed, set_type), workouts!inner(user_id, created_at)')
      .eq('workouts.user_id', userId)
      .eq('name', name);
    if (workoutId) query = query.neq('workout_id', workoutId);
    const { data, error } = await query
      .order('created_at', { referencedTable: 'workouts', ascending: false })
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
