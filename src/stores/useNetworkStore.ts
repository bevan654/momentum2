import { create } from 'zustand';
import { flushQueue } from '../lib/syncQueue';

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let _checkTimer: ReturnType<typeof setInterval> | null = null;

interface NetworkState {
  isOffline: boolean;
  setOffline: (v: boolean) => void;
}

function startCheckTimer() {
  if (_checkTimer) return;
  _checkTimer = setInterval(async () => {
    // Lazy import to avoid circular dependency at module load
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
    if (wasOffline === v) return; // No-op if state unchanged
    set({ isOffline: v });

    if (v) {
      // Start checking every 2 minutes for connectivity
      startCheckTimer();
    } else {
      stopCheckTimer();
      // Flush pending sync operations when coming back online
      if (wasOffline) {
        const { flushPendingWorkouts } = require('../lib/pendingWorkouts');
        flushPendingWorkouts().then(() => flushQueue());
      }
    }
  },
}));
