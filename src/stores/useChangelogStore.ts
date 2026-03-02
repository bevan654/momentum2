import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import changelog from '../constants/changelog';

const STORAGE_KEY = 'changelog_last_seen_version';

interface ChangelogState {
  /** true when there's an unseen changelog to show */
  hasUnseen: boolean;
  /** Initialise — compare stored version against latest changelog entry */
  check: () => Promise<void>;
  /** Mark the current version as seen */
  dismiss: () => void;
}

export const useChangelogStore = create<ChangelogState>((set) => ({
  hasUnseen: false,

  check: async () => {
    const latest = changelog[0]?.version;
    if (!latest) return;
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY);
      if (seen !== latest) {
        set({ hasUnseen: true });
      }
    } catch {
      // storage read failed — don't block the user
    }
  },

  dismiss: () => {
    const latest = changelog[0]?.version;
    if (latest) {
      AsyncStorage.setItem(STORAGE_KEY, latest).catch(() => {});
    }
    set({ hasUnseen: false });
  },
}));
