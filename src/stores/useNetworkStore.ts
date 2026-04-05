import { create } from 'zustand';
import { flushQueue } from '../lib/syncQueue';

interface NetworkState {
  isOffline: boolean;
  setOffline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOffline: false,
  setOffline: (v) => {
    const wasOffline = get().isOffline;
    set({ isOffline: v });

    // Flush pending sync operations when coming back online
    if (wasOffline && !v) {
      flushQueue();
    }
  },
}));
