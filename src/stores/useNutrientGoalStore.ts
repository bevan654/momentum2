import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MACRO_ENABLED_KEY = '@momentum_enabled_macros';
const MICRO_GOALS_KEY = '@momentum_micro_goals';

/* ─── Types ────────────────────────────────────────────── */

export interface MicroGoalConfig {
  key: string;
  name: string;
  dailyGoal: number;
  unit: string;
  color: string;
}

export interface MacroPreset {
  key: string;
  label: string;
  goalField: 'protein_goal' | 'carbs_goal' | 'fat_goal';
  unit: string;
  icon: string;
  color: string;
  defaultGoal: number;
}

export interface MicroPreset {
  key: string;
  name: string;
  defaultMale: number;
  defaultFemale: number;
  unit: string;
  color: string;
}

/* ─── Presets ──────────────────────────────────────────── */

export const MACRO_PRESETS: MacroPreset[] = [
  { key: 'protein', label: 'Protein', goalField: 'protein_goal', unit: 'g', icon: 'barbell-outline', color: '#EF4444', defaultGoal: 150 },
  { key: 'carbs', label: 'Carbs', goalField: 'carbs_goal', unit: 'g', icon: 'flame-outline', color: '#F59E0B', defaultGoal: 250 },
  { key: 'fat', label: 'Fat', goalField: 'fat_goal', unit: 'g', icon: 'water-outline', color: '#3B82F6', defaultGoal: 65 },
];

export const MICRO_PRESETS: MicroPreset[] = [
  // General
  { key: 'caffeine', name: 'Caffeine', defaultMale: 400, defaultFemale: 400, unit: 'mg', color: '#92400E' },
  { key: 'fiber', name: 'Fiber', defaultMale: 38, defaultFemale: 25, unit: 'g', color: '#22C55E' },
  { key: 'sugar', name: 'Sugar', defaultMale: 50, defaultFemale: 50, unit: 'g', color: '#F472B6' },
  // Minerals
  { key: 'sodium', name: 'Sodium', defaultMale: 2300, defaultFemale: 2300, unit: 'mg', color: '#64748B' },
  { key: 'calcium', name: 'Calcium', defaultMale: 1000, defaultFemale: 1000, unit: 'mg', color: '#94A3B8' },
  { key: 'iron', name: 'Iron', defaultMale: 8, defaultFemale: 18, unit: 'mg', color: '#A1887F' },
  { key: 'potassium', name: 'Potassium', defaultMale: 3400, defaultFemale: 2600, unit: 'mg', color: '#FBBF24' },
  { key: 'magnesium', name: 'Magnesium', defaultMale: 420, defaultFemale: 320, unit: 'mg', color: '#8B5CF6' },
  { key: 'zinc', name: 'Zinc', defaultMale: 11, defaultFemale: 8, unit: 'mg', color: '#78716C' },
  // Vitamins
  { key: 'vitamin_a', name: 'Vitamin A', defaultMale: 900, defaultFemale: 700, unit: 'mcg', color: '#FB923C' },
  { key: 'vitamin_b6', name: 'Vitamin B6', defaultMale: 1.3, defaultFemale: 1.3, unit: 'mg', color: '#A78BFA' },
  { key: 'vitamin_b12', name: 'Vitamin B12', defaultMale: 2.4, defaultFemale: 2.4, unit: 'mcg', color: '#F87171' },
  { key: 'vitamin_c', name: 'Vitamin C', defaultMale: 90, defaultFemale: 75, unit: 'mg', color: '#FACC15' },
  { key: 'vitamin_d', name: 'Vitamin D', defaultMale: 15, defaultFemale: 15, unit: 'mcg', color: '#F97316' },
  { key: 'vitamin_e', name: 'Vitamin E', defaultMale: 15, defaultFemale: 15, unit: 'mg', color: '#22D3EE' },
  { key: 'vitamin_k', name: 'Vitamin K', defaultMale: 120, defaultFemale: 90, unit: 'mcg', color: '#4ADE80' },
  { key: 'folate', name: 'Folate', defaultMale: 400, defaultFemale: 400, unit: 'mcg', color: '#2DD4BF' },
];

/* ─── Helpers ─────────────────────────────────────────── */

export function getMicroDefault(key: string, gender?: string | null): number {
  const preset = MICRO_PRESETS.find((p) => p.key === key);
  if (!preset) return 0;
  return gender === 'female' ? preset.defaultFemale : preset.defaultMale;
}

export function getMacroDefault(key: string): number {
  return MACRO_PRESETS.find((p) => p.key === key)?.defaultGoal ?? 0;
}

/* ─── Store ───────────────────────────────────────────── */

interface NutrientGoalState {
  enabledMacros: string[];
  microGoals: MicroGoalConfig[];
  loaded: boolean;

  loadConfigs: () => Promise<void>;
  setEnabledMacros: (macros: string[]) => Promise<void>;
  addMicroGoal: (config: MicroGoalConfig) => Promise<void>;
  removeMicroGoal: (key: string) => Promise<void>;
  updateMicroGoal: (key: string, dailyGoal: number) => Promise<void>;
}

export const useNutrientGoalStore = create<NutrientGoalState>((set, get) => ({
  enabledMacros: ['protein', 'carbs', 'fat'],
  microGoals: [],
  loaded: false,

  loadConfigs: async () => {
    try {
      const [macroJson, microJson] = await Promise.all([
        AsyncStorage.getItem(MACRO_ENABLED_KEY),
        AsyncStorage.getItem(MICRO_GOALS_KEY),
      ]);
      set({
        enabledMacros: macroJson ? JSON.parse(macroJson) : ['protein', 'carbs', 'fat'],
        microGoals: microJson ? JSON.parse(microJson) : [],
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  setEnabledMacros: async (macros: string[]) => {
    set({ enabledMacros: macros });
    try {
      await AsyncStorage.setItem(MACRO_ENABLED_KEY, JSON.stringify(macros));
    } catch {}
  },

  addMicroGoal: async (config: MicroGoalConfig) => {
    const goals = [...get().microGoals, config];
    set({ microGoals: goals });
    try {
      await AsyncStorage.setItem(MICRO_GOALS_KEY, JSON.stringify(goals));
    } catch {}
  },

  removeMicroGoal: async (key: string) => {
    const goals = get().microGoals.filter((g) => g.key !== key);
    set({ microGoals: goals });
    try {
      await AsyncStorage.setItem(MICRO_GOALS_KEY, JSON.stringify(goals));
    } catch {}
  },

  updateMicroGoal: async (key: string, dailyGoal: number) => {
    const goals = get().microGoals.map((g) => (g.key === key ? { ...g, dailyGoal } : g));
    set({ microGoals: goals });
    try {
      await AsyncStorage.setItem(MICRO_GOALS_KEY, JSON.stringify(goals));
    } catch {}
  },
}));
