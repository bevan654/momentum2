import { create } from 'zustand';
import { readUserScoped, writeUserScoped } from '../lib/userScopedStorage';
import { useAuthStore } from './useAuthStore';

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

interface MicroPreset {
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
  /** Back to the defaults; this account's goals stay saved on the phone for when it signs in again. */
  resetForSignOut: () => void;
}

const DEFAULT_MACROS = ['protein', 'carbs', 'fat'];

/** Bumped on sign-out, so a load still running for the previous account is ignored. */
let _gen = 0;

async function save(key: string, value: unknown) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  try {
    await writeUserScoped(key, userId, JSON.stringify(value));
  } catch {}
}

export const useNutrientGoalStore = create<NutrientGoalState>((set, get) => ({
  enabledMacros: DEFAULT_MACROS,
  microGoals: [],
  loaded: false,

  loadConfigs: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const gen = _gen;
    let enabledMacros = DEFAULT_MACROS;
    let microGoals: MicroGoalConfig[] = [];
    try {
      const [macroJson, microJson] = await Promise.all([
        readUserScoped(MACRO_ENABLED_KEY, userId),
        readUserScoped(MICRO_GOALS_KEY, userId),
      ]);
      if (macroJson) enabledMacros = JSON.parse(macroJson);
      if (microJson) microGoals = JSON.parse(microJson);
    } catch {}
    if (gen === _gen) set({ enabledMacros, microGoals, loaded: true });
  },

  setEnabledMacros: async (macros: string[]) => {
    set({ enabledMacros: macros });
    await save(MACRO_ENABLED_KEY, macros);
  },

  addMicroGoal: async (config: MicroGoalConfig) => {
    const goals = [...get().microGoals, config];
    set({ microGoals: goals });
    await save(MICRO_GOALS_KEY, goals);
  },

  removeMicroGoal: async (key: string) => {
    const goals = get().microGoals.filter((g) => g.key !== key);
    set({ microGoals: goals });
    await save(MICRO_GOALS_KEY, goals);
  },

  updateMicroGoal: async (key: string, dailyGoal: number) => {
    const goals = get().microGoals.map((g) => (g.key === key ? { ...g, dailyGoal } : g));
    set({ microGoals: goals });
    await save(MICRO_GOALS_KEY, goals);
  },

  resetForSignOut: () => {
    _gen++;
    set({ enabledMacros: DEFAULT_MACROS, microGoals: [], loaded: false });
  },
}));
