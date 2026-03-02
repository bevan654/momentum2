import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'theme_settings_v4';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  initialized: boolean;
  setMode: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

let _themeWriteTimer: ReturnType<typeof setTimeout> | null = null;

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  initialized: false,

  setMode: (mode: ThemeMode) => {
    set({ mode });
    if (_themeWriteTimer) clearTimeout(_themeWriteTimer);
    _themeWriteTimer = setTimeout(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode })), 100);
  },

  loadTheme: async () => {
    // Try new key first, fall back to old key for migration
    let raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = await AsyncStorage.getItem('theme_settings_v3');
    }
    if (raw) {
      const data = JSON.parse(raw);
      const savedMode = data.mode || 'dark';
      const mode: ThemeMode = (savedMode === 'light' || savedMode === 'dark') ? savedMode : 'dark';
      set({ mode, initialized: true });
      // Persist under new key
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode }));
    } else {
      set({ initialized: true });
    }
  },
}));
