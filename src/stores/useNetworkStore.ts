import { create } from 'zustand';

interface NetworkState {
  isOffline: boolean;
  setOffline: (v: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOffline: false,
  setOffline: (v) => set({ isOffline: v }),
}));
