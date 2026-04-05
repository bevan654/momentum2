import { create } from 'zustand';
import { flushQueue } from '../lib/syncQueue';

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let _checkTimer: ReturnType<typeof setInterval> | null = null;
const _reconnectListeners: Set<() => void> = new Set();

interface NetworkState {
  isOffline: boolean;
  setOffline: (v: boolean) => void;
}

/** Register a callback to run when connectivity is restored. Returns unsubscribe fn. */
export function onReconnect(fn: () => void): () => void {
  _reconnectListeners.add(fn);
  return () => { _reconnectListeners.delete(fn); };
}

function startCheckTimer() {
  if (_checkTimer) return;
  _checkTimer = setInterval(async () => {
    const { checkConnection } = require('../lib/supabase');
    await checkConnection();
  }, CHECK_INTERVAL_MS);
}

function stopCheckTimer() {
  if (_checkTimer) {
    clearInterval(_checkTimer);
    _checkTimer = null;
  }
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOffline: false,
  setOffline: (v) => {
    const wasOffline = get().isOffline;
    if (wasOffline === v) return;
    set({ isOffline: v });

    if (v) {
      startCheckTimer();
    } else {
      stopCheckTimer();
      if (wasOffline) {
        // Flush both queues independently
        const { flushPendingWorkouts } = require('../lib/pendingWorkouts');
        Promise.all([flushPendingWorkouts(), flushQueue()]).then(() => {
          // Notify screens to refresh after sync completes
          for (const fn of _reconnectListeners) {
            try { fn(); } catch {}
          }
        });
      }
    }
  },
}));
