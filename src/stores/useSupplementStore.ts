import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueue } from '../lib/syncQueue';

const CONFIGS_KEY = '@momentum_supplement_configs';
const TOTALS_CACHE_KEY = '@momentum_supplement_totals';

export interface SupplementEntry {
  id: string;
  type: string;
  amount: number;
  created_at: string;
}

export interface SupplementConfig {
  key: string;
  name: string;
  dailyGoal: number;
  unit: string;
  icon: string;
  color: string;
  increments: number[];
}

export interface SupplementPreset {
  key: string;
  name: string;
  defaultGoal: number;
  unit: string;
  icon: string;
  color: string;
  increments: number[];
}

export const SUPPLEMENT_PRESETS: SupplementPreset[] = [
  { key: 'creatine', name: 'Creatine', defaultGoal: 5, unit: 'g', icon: 'flash-outline', color: '#FBBF24', increments: [5, 1] },
  { key: 'vitamin_d', name: 'Vitamin D', defaultGoal: 2000, unit: 'IU', icon: 'sunny-outline', color: '#F97316', increments: [1000, 2000] },
  { key: 'fish_oil', name: 'Fish Oil', defaultGoal: 1000, unit: 'mg', icon: 'fish-outline', color: '#06B6D4', increments: [1000] },
  { key: 'magnesium', name: 'Magnesium', defaultGoal: 400, unit: 'mg', icon: 'sparkles-outline', color: '#8B5CF6', increments: [200, 400] },
  { key: 'zinc', name: 'Zinc', defaultGoal: 15, unit: 'mg', icon: 'shield-outline', color: '#64748B', increments: [15] },
  { key: 'caffeine', name: 'Caffeine', defaultGoal: 200, unit: 'mg', icon: 'cafe-outline', color: '#92400E', increments: [100, 200] },
  { key: 'protein_powder', name: 'Protein', defaultGoal: 30, unit: 'g', icon: 'nutrition-outline', color: '#86EFAC', increments: [25, 30] },
  { key: 'ashwagandha', name: 'Ashwagandha', defaultGoal: 600, unit: 'mg', icon: 'leaf-outline', color: '#22C55E', increments: [300, 600] },
];

export const CUSTOM_COLORS = ['#F472B6', '#A78BFA', '#38BDF8', '#FB923C', '#4ADE80', '#F87171', '#FACC15', '#2DD4BF'];

const DEFAULT_CONFIGS: SupplementConfig[] = [
  { key: 'creatine', name: 'Creatine', dailyGoal: 5, unit: 'g', icon: 'flash-outline', color: '#FBBF24', increments: [5, 1] },
];

/* ─── Helpers ─────────────────────────────────────────── */

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function mapRowToConfig(row: any): SupplementConfig {
  return {
    key: row.key,
    name: row.name,
    dailyGoal: Number(row.daily_goal),
    unit: row.unit,
    icon: row.icon,
    color: row.color,
    increments: Array.isArray(row.increments) ? row.increments : JSON.parse(row.increments),
  };
}

function configToRow(userId: string, config: SupplementConfig, sortOrder: number) {
  return {
    user_id: userId,
    key: config.key,
    name: config.name,
    daily_goal: config.dailyGoal,
    unit: config.unit,
    icon: config.icon,
    color: config.color,
    increments: config.increments,
    sort_order: sortOrder,
  };
}

async function cacheConfigs(configs: SupplementConfig[]) {
  try { await AsyncStorage.setItem(CONFIGS_KEY, JSON.stringify(configs)); } catch {}
}

function cacheTotals(water: number, waterGoal: number, totals: Record<string, number>) {
  AsyncStorage.setItem(TOTALS_CACHE_KEY, JSON.stringify({ water, waterGoal, totals, date: todayDate() })).catch(() => {});
}

export function nameToKey(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function generateIncrements(goal: number): number[] {
  if (goal <= 1) return [1];
  const half = Math.round(goal / 2);
  return half !== goal && half > 0 ? [goal, half] : [goal];
}

/* ─── State ───────────────────────────────────────────── */

interface SupplementState {
  water: number;
  waterGoal: number;
  supplementConfigs: SupplementConfig[];
  supplementTotals: Record<string, number>;
  loading: boolean;
  dateEntries: SupplementEntry[];

  loadSupplementConfigs: (userId: string) => Promise<void>;
  addSupplementConfig: (userId: string, config: SupplementConfig) => Promise<void>;
  removeSupplementConfig: (userId: string, key: string) => Promise<void>;
  updateSupplementConfig: (userId: string, key: string, updates: Partial<SupplementConfig>) => Promise<void>;
  fetchTodaySupplements: (userId: string) => Promise<void>;
  fetchSupplementGoals: (userId: string) => Promise<void>;
  fetchDateSupplements: (userId: string, date: string) => Promise<void>;
  addWater: (userId: string, ml: number) => Promise<void>;
  addSupplement: (userId: string, key: string, amount: number) => Promise<void>;
  resetSupplement: (userId: string, key: string) => Promise<void>;
  deleteSupplementEntry: (userId: string, entry: SupplementEntry) => Promise<void>;
  undoLastWater: (userId: string) => Promise<void>;
  updateSupplementGoals: (userId: string, goals: { water_goal?: number; creatine_goal?: number }) => Promise<void>;
}

export const useSupplementStore = create<SupplementState>((set, get) => ({
  water: 0,
  waterGoal: 2500,
  supplementConfigs: DEFAULT_CONFIGS,
  supplementTotals: {},
  loading: false,
  dateEntries: [],

  /* ─── Config management (Supabase-synced) ───────────── */

  loadSupplementConfigs: async (userId: string) => {
    try {
      // 1. Try Supabase user_supplements table
      const { data: supaData, error: supaError } = await supabase
        .from('user_supplements')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order');

      if (!supaError && supaData) {
        if (supaData.length > 0) {
          const configs = supaData.map(mapRowToConfig);
          set({ supplementConfigs: configs });
          await cacheConfigs(configs);
          return;
        }
        // Table exists but empty — seed from AsyncStorage or legacy
        const json = await AsyncStorage.getItem(CONFIGS_KEY);
        if (json) {
          const cached = JSON.parse(json) as SupplementConfig[];
          if (cached.length > 0) {
            set({ supplementConfigs: cached });
            const rows = cached.map((c, i) => configToRow(userId, c, i));
            await supabase.from('user_supplements').insert(rows);
            return;
          }
        }
        // Check legacy creatine_goal
        const { data: legacy } = await supabase
          .from('supplement_goals')
          .select('creatine_goal')
          .eq('user_id', userId)
          .single();
        const goal = legacy ? Number(legacy.creatine_goal) : 5;
        const defaults = [{ ...DEFAULT_CONFIGS[0], dailyGoal: goal }];
        set({ supplementConfigs: defaults });
        await supabase.from('user_supplements').insert(defaults.map((c, i) => configToRow(userId, c, i)));
        await cacheConfigs(defaults);
        return;
      }

      // 2. Supabase table doesn't exist or errored — fall back to AsyncStorage
      const json = await AsyncStorage.getItem(CONFIGS_KEY);
      if (json) {
        set({ supplementConfigs: JSON.parse(json) });
        return;
      }
    } catch {}

    // 3. Nothing found — use defaults
    set({ supplementConfigs: DEFAULT_CONFIGS });
    await cacheConfigs(DEFAULT_CONFIGS);
  },

  addSupplementConfig: async (userId: string, config: SupplementConfig) => {
    const configs = [...get().supplementConfigs, config];
    set({ supplementConfigs: configs });
    await cacheConfigs(configs);
    const row = configToRow(userId, config, configs.length - 1);
    const { error } = await supabase.from('user_supplements').insert(row);
    if (error) {
      enqueue({ table: 'user_supplements', type: 'insert', data: row });
    }
  },

  removeSupplementConfig: async (userId: string, key: string) => {
    const configs = get().supplementConfigs.filter((c) => c.key !== key);
    set({ supplementConfigs: configs });
    await cacheConfigs(configs);
    const { error } = await supabase
      .from('user_supplements')
      .delete()
      .eq('user_id', userId)
      .eq('key', key);
    if (error) {
      enqueue({ table: 'user_supplements', type: 'delete', match: { user_id: userId, key } });
    }
  },

  updateSupplementConfig: async (userId: string, key: string, updates: Partial<SupplementConfig>) => {
    const configs = get().supplementConfigs.map((c) => (c.key === key ? { ...c, ...updates } : c));
    set({ supplementConfigs: configs });
    await cacheConfigs(configs);

    const dbUpdates: Record<string, any> = {};
    if (updates.dailyGoal != null) dbUpdates.daily_goal = updates.dailyGoal;
    if (updates.name != null) dbUpdates.name = updates.name;
    if (updates.unit != null) dbUpdates.unit = updates.unit;
    if (updates.icon != null) dbUpdates.icon = updates.icon;
    if (updates.color != null) dbUpdates.color = updates.color;
    if (updates.increments != null) dbUpdates.increments = updates.increments;

    const { error } = await supabase
      .from('user_supplements')
      .update(dbUpdates)
      .eq('user_id', userId)
      .eq('key', key);
    if (error) {
      enqueue({ table: 'user_supplements', type: 'update', data: dbUpdates, match: { user_id: userId, key } });
    }
  },

  /* ─── Data fetching ─────────────────────────────────── */

  fetchTodaySupplements: async (userId: string) => {
    const date = todayDate();
    const { data } = await supabase
      .from('supplement_entries')
      .select('type, amount')
      .eq('user_id', userId)
      .eq('date', date);

    if (data) {
      const water = data
        .filter((e) => e.type === 'water')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const totals: Record<string, number> = {};
      for (const entry of data) {
        if (entry.type !== 'water') {
          totals[entry.type] = (totals[entry.type] || 0) + Number(entry.amount);
        }
      }

      set({ water, supplementTotals: totals });
      cacheTotals(water, get().waterGoal, totals);
    } else {
      // Network error — load from cache
      try {
        const raw = await AsyncStorage.getItem(TOTALS_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.date === todayDate()) {
            set({ water: cached.water, waterGoal: cached.waterGoal, supplementTotals: cached.totals });
          }
        }
      } catch {}
    }
  },

  fetchSupplementGoals: async (userId: string) => {
    await get().loadSupplementConfigs(userId);

    const { data } = await supabase
      .from('supplement_goals')
      .select('water_goal')
      .eq('user_id', userId)
      .single();

    if (data) {
      set({ waterGoal: Number(data.water_goal) });
      cacheTotals(get().water, Number(data.water_goal), get().supplementTotals);
    } else {
      // Network error — try cache for water goal
      try {
        const raw = await AsyncStorage.getItem(TOTALS_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.waterGoal) set({ waterGoal: cached.waterGoal });
        }
      } catch {}
    }
  },

  fetchDateSupplements: async (userId: string, date: string) => {
    const { data } = await supabase
      .from('supplement_entries')
      .select('id, type, amount, created_at')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    set({ dateEntries: (data as SupplementEntry[]) || [] });
  },

  /* ─── Water actions ─────────────────────────────────── */

  addWater: async (userId: string, ml: number) => {
    set((s) => ({ water: s.water + ml }));
    cacheTotals(get().water, get().waterGoal, get().supplementTotals);

    const row = { user_id: userId, type: 'water', amount: ml, date: todayDate() };
    const { error } = await supabase.from('supplement_entries').insert(row);

    if (error) {
      // Keep local state, queue for later
      enqueue({ table: 'supplement_entries', type: 'insert', data: row });
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  undoLastWater: async (userId: string) => {
    const date = todayDate();
    const { data } = await supabase
      .from('supplement_entries')
      .select('id, amount')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('type', 'water')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return;

    const amount = Number(data.amount);
    set((s) => ({ water: Math.max(0, s.water - amount) }));
    cacheTotals(get().water, get().waterGoal, get().supplementTotals);

    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', data.id);

    if (error) {
      set((s) => ({ water: s.water + amount }));
      cacheTotals(get().water, get().waterGoal, get().supplementTotals);
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  /* ─── Supplement entry actions ──────────────────────── */

  addSupplement: async (userId: string, key: string, amount: number) => {
    set((s) => ({
      supplementTotals: {
        ...s.supplementTotals,
        [key]: (s.supplementTotals[key] || 0) + amount,
      },
    }));
    cacheTotals(get().water, get().waterGoal, get().supplementTotals);

    const row = { user_id: userId, type: key, amount, date: todayDate() };
    const { error } = await supabase.from('supplement_entries').insert(row);

    if (error) {
      enqueue({ table: 'supplement_entries', type: 'insert', data: row });
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  resetSupplement: async (userId: string, key: string) => {
    const prev = get().supplementTotals[key] || 0;
    set((s) => ({
      supplementTotals: { ...s.supplementTotals, [key]: 0 },
    }));
    cacheTotals(get().water, get().waterGoal, get().supplementTotals);

    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('user_id', userId)
      .eq('date', todayDate())
      .eq('type', key);

    if (error) {
      enqueue({ table: 'supplement_entries', type: 'delete', match: { user_id: userId, date: todayDate(), type: key } });
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  deleteSupplementEntry: async (userId: string, entry: SupplementEntry) => {
    const prev = get().dateEntries;
    set((s) => ({
      dateEntries: s.dateEntries.filter((e) => e.id !== entry.id),
      ...(entry.type === 'water'
        ? { water: Math.max(0, s.water - entry.amount) }
        : {
            supplementTotals: {
              ...s.supplementTotals,
              [entry.type]: Math.max(0, (s.supplementTotals[entry.type] || 0) - entry.amount),
            },
          }),
    }));
    cacheTotals(get().water, get().waterGoal, get().supplementTotals);

    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', entry.id);

    if (error) {
      // Rollback — can't queue a delete for an entry that may not exist on server
      set((s) => ({
        dateEntries: prev,
        ...(entry.type === 'water'
          ? { water: s.water + entry.amount }
          : {
              supplementTotals: {
                ...s.supplementTotals,
                [entry.type]: (s.supplementTotals[entry.type] || 0) + entry.amount,
              },
            }),
      }));
      cacheTotals(get().water, get().waterGoal, get().supplementTotals);
    }
  },

  /* ─── Legacy goals (water) ──────────────────────────── */

  updateSupplementGoals: async (userId: string, goals: { water_goal?: number; creatine_goal?: number }) => {
    const prevWater = get().waterGoal;

    if (goals.water_goal != null) set({ waterGoal: goals.water_goal });
    cacheTotals(get().water, get().waterGoal, get().supplementTotals);

    const { error } = await supabase
      .from('supplement_goals')
      .update(goals)
      .eq('user_id', userId);

    if (error) {
      enqueue({ table: 'supplement_goals', type: 'update', data: goals, match: { user_id: userId } });
    }
  },
}));
