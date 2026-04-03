import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'theme_settings_v5';

export type ThemeMode = 'light' | 'dark';

/** null = monochrome (brand white/charcoal per mode) */
export type AccentColor = string | null;

export const ACCENT_PRESETS: { hex: AccentColor; label: string }[] = [
  { hex: null,      label: 'Mono' },
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#8B5CF6', label: 'Purple' },
  { hex: '#D946EF', label: 'Fuchsia' },
  { hex: '#F43F5E', label: 'Rose' },
  { hex: '#EF4444', label: 'Red' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#34D399', label: 'Emerald' },
  { hex: '#14B8A6', label: 'Teal' },
  { hex: '#22D3EE', label: 'Cyan' },
  { hex: '#60A5FA', label: 'Sky' },
];

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  initialized: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  loadTheme: () => Promise<void>;
}

let _themeWriteTimer: ReturnType<typeof setTimeout> | null = null;

function persist(mode: ThemeMode, accent: AccentColor) {
  if (_themeWriteTimer) clearTimeout(_themeWriteTimer);
  _themeWriteTimer = setTimeout(
    () => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent })),
    100,
  );
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  accent: '#8B5CF6',
  initialized: false,

  setMode: (mode: ThemeMode) => {
    set({ mode });
    persist(mode, get().accent);
  },

  setAccent: (accent: AccentColor) => {
    set({ accent });
    persist(get().mode, accent);
  },

  loadTheme: async () => {
    // Try new key first, fall back to older keys for migration
    let raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) raw = await AsyncStorage.getItem('theme_settings_v4');
    if (!raw) raw = await AsyncStorage.getItem('theme_settings_v3');

    if (raw) {
      const data = JSON.parse(raw);
      const savedMode = data.mode || 'dark';
      const mode: ThemeMode = (savedMode === 'light' || savedMode === 'dark') ? savedMode : 'dark';
      const accent: AccentColor = typeof data.accent === 'string' ? data.accent : null;
      set({ mode, accent, initialized: true });
      // Persist under new key
      persist(mode, accent);
    } else {
      set({ initialized: true });
    }
  },
}));
