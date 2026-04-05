import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@momentum_sync_queue';
const MAX_RETRIES = 5;

export interface SyncOp {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'delete';
  data?: Record<string, any>;
  match?: Record<string, any>;
  createdAt: number;
  retryCount?: number;
}

let _flushing = false;

async function loadQueue(): Promise<SyncOp[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(ops: SyncOp[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {}
}

/** Add an operation to the offline sync queue */
export async function enqueue(op: Omit<SyncOp, 'id' | 'createdAt'>) {
  const full: SyncOp = {
    ...op,
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    retryCount: 0,
  };
  const queue = await loadQueue();
  queue.push(full);
  await saveQueue(queue);
}

/** Process all queued operations. Call when back online. */
export async function flushQueue(): Promise<void> {
  if (_flushing) return;
  // Lazy import to avoid circular dependency
  const { useNetworkStore } = require('../stores/useNetworkStore');
  if (useNetworkStore.getState().isOffline) return;

  _flushing = true;
  try {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    // Lazy import to avoid circular dependency
    const { supabase } = require('./supabase');

    const remaining: SyncOp[] = [];

    for (const op of queue) {
      try {
        let result: { error: any };
        switch (op.type) {
          case 'insert':
            result = await supabase.from(op.table).insert(op.data!);
            break;
          case 'update': {
            let q = supabase.from(op.table).update(op.data!);
            for (const [key, value] of Object.entries(op.match || {})) {
              q = q.eq(key, value);
            }
            result = await q;
            break;
          }
          case 'delete': {
            let q = supabase.from(op.table).delete();
            for (const [key, value] of Object.entries(op.match || {})) {
              q = q.eq(key, value);
            }
            result = await q;
            break;
          }
        }
        if (result.error) {
          const retries = (op.retryCount || 0) + 1;
          if (retries < MAX_RETRIES) {
            remaining.push({ ...op, retryCount: retries });
          }
          // else: discard — exceeded max retries
        }
      } catch {
        // Network still down — keep in queue unchanged, stop processing
        remaining.push(op);
        break;
      }
    }

    await saveQueue(remaining);
  } finally {
    _flushing = false;
  }
}

/** Check if there are pending operations */
export async function hasPendingOps(): Promise<boolean> {
  const queue = await loadQueue();
  return queue.length > 0;
}
