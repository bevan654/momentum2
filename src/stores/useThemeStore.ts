import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'theme_settings_v3';

export interface AccentPreset {
  name: string;
  color: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Peach', color: '#FFB37B' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Cyan', color: '#38BDF8' },
  { name: 'Green', color: '#34D399' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Rose', color: '#F43F5E' },
  { name: 'Orange', color: '#F59E0B' },
  { name: 'Red', color: '#EF4444' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Black', color: '#1A1A1A' },
];

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  accentColor: string;
  accentName: string;
  mode: ThemeMode;
  initialized: boolean;
  setAccentColor: (color: string) => void;
  setMode: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

let _themeWriteTimer: ReturnType<typeof setTimeout> | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  accentColor: '#FFB37B',
  accentName: 'Peach',
  mode: 'light',
  initialized: false,

  setAccentColor: (color: string) => {
    const preset = ACCENT_PRESETS.find((p) => p.color === color);
    const name = preset?.name || 'Custom';
    set({ accentColor: color, accentName: name });
    const { mode } = get();
    if (_themeWriteTimer) clearTimeout(_themeWriteTimer);
    _themeWriteTimer = setTimeout(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accentColor: color, accentName: name, mode })), 100);
  },

  setMode: (mode: ThemeMode) => {
    set({ mode });
    const { accentColor, accentName } = get();
    if (_themeWriteTimer) clearTimeout(_themeWriteTimer);
    _themeWriteTimer = setTimeout(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accentColor, accentName, mode })), 100);
  },

  loadTheme: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const savedMode = data.mode || 'dark';
      const mode: ThemeMode = (savedMode === 'light' || savedMode === 'dark') ? savedMode : 'dark';
      // Migrate old blue default to new peach default
      const needsMigration = data.accentColor === '#3B82F6' || !data.accentColor;
      const accent = needsMigration ? '#FFB37B' : data.accentColor;
      const name = needsMigration ? 'Peach' : (data.accentName || 'Peach');
      set({
        accentColor: accent,
        accentName: name,
        mode,
        initialized: true,
      });
      if (needsMigration) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ accentColor: accent, accentName: name, mode }));
      }
    } else {
      set({ initialized: true });
    }
  },
}));
