import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'profile_settings';

interface ProfileSettingsState {
  showStreakOnProfile: boolean;
  showStreakOnLeaderboard: boolean;
  showRecoveryPercent: boolean;
  showRankLabels: boolean;
  initialized: boolean;
  setShowStreakOnProfile: (value: boolean) => void;
  setShowStreakOnLeaderboard: (value: boolean) => void;
  setShowRecoveryPercent: (value: boolean) => void;
  setShowRankLabels: (value: boolean) => void;
  loadSettings: () => Promise<void>;
}

function persist(state: ProfileSettingsState) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    showStreakOnProfile: state.showStreakOnProfile,
    showStreakOnLeaderboard: state.showStreakOnLeaderboard,
    showRecoveryPercent: state.showRecoveryPercent,
    showRankLabels: state.showRankLabels,
  }));
}

export const useProfileSettingsStore = create<ProfileSettingsState>((set, get) => ({
  showStreakOnProfile: true,
  showStreakOnLeaderboard: true,
  showRecoveryPercent: false,
  showRankLabels: true,
  initialized: false,

  setShowStreakOnProfile: (value: boolean) => {
    set({ showStreakOnProfile: value });
    persist(get());
  },

  setShowStreakOnLeaderboard: (value: boolean) => {
    set({ showStreakOnLeaderboard: value });
    persist(get());
  },

  setShowRecoveryPercent: (value: boolean) => {
    set({ showRecoveryPercent: value });
    persist(get());
  },

  setShowRankLabels: (value: boolean) => {
    set({ showRankLabels: value });
    persist(get());
  },

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      set({
        showStreakOnProfile: data.showStreakOnProfile ?? true,
        showStreakOnLeaderboard: data.showStreakOnLeaderboard ?? true,
        showRecoveryPercent: data.showRecoveryPercent ?? true,
        showRankLabels: data.showRankLabels ?? true,
        initialized: true,
      });
    } else {
      set({ initialized: true });
    }
  },
}));
