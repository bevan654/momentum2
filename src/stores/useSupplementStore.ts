import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { readUserScoped, writeUserScoped } from '../lib/userScopedStorage';
import { toLocalDateString } from '../utils/localDate';
import { PROTEIN_POWDER_KEY } from './useProteinPowderStore';

const CONFIGS_KEY = '@momentum_supplement_configs';
/** Water's quick amounts (ml). Stored on the phone per account until the database has a column for them. */
const WATER_AMOUNTS_KEY = '@momentum_water_amounts';
const DEFAULT_WATER_AMOUNTS = [250, 500];

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

interface SupplementPreset {
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
  // Counted in servings of the user's own powders; each add also logs a snack (useProteinPowderStore).
  { key: PROTEIN_POWDER_KEY, name: 'Protein powder', defaultGoal: 1, unit: 'servings', icon: 'nutrition-outline', color: '#86EFAC', increments: [1] },
  { key: 'ashwagandha', name: 'Ashwagandha', defaultGoal: 600, unit: 'mg', icon: 'leaf-outline', color: '#22C55E', increments: [300, 600] },
];

export const CUSTOM_COLORS = ['#F472B6', '#A78BFA', '#38BDF8', '#FB923C', '#4ADE80', '#F87171', '#FACC15', '#2DD4BF'];

const INITIAL_STATE = () => ({
  water: 0,
  waterGoal: 2500,
  waterIncrements: DEFAULT_WATER_AMOUNTS,
  supplementConfigs: DEFAULT_CONFIGS,
  supplementTotals: {} as Record<string, number>,
  loading: false,
  dateEntries: [] as SupplementEntry[],
  dateEntriesDate: null as string | null,
});

const DEFAULT_CONFIGS: SupplementConfig[] = [
  { key: 'creatine', name: 'Creatine', dailyGoal: 5, unit: 'g', icon: 'flash-outline', color: '#FBBF24', increments: [5, 1] },
];

/* ─── Helpers ─────────────────────────────────────────── */

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

/** Per-account copy of the configs, used when the database can't be reached. */
async function cacheConfigs(userId: string, configs: SupplementConfig[]) {
  try { await writeUserScoped(CONFIGS_KEY, userId, JSON.stringify(configs)); } catch {}
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
  /** Water's quick amounts in ml; the first is what one tap adds. */
  waterIncrements: number[];
  supplementConfigs: SupplementConfig[];
  supplementTotals: Record<string, number>;
  loading: boolean;
  dateEntries: SupplementEntry[];
  /** The date `dateEntries` belongs to (the day the Nutrition tab is showing). */
  dateEntriesDate: string | null;

  loadSupplementConfigs: (userId: string) => Promise<void>;
  addSupplementConfig: (userId: string, config: SupplementConfig) => Promise<void>;
  removeSupplementConfig: (userId: string, key: string) => Promise<void>;
  updateSupplementConfig: (userId: string, key: string, updates: Partial<SupplementConfig>) => Promise<void>;
  fetchTodaySupplements: (userId: string) => Promise<void>;
  fetchSupplementGoals: (userId: string) => Promise<void>;
  setWaterIncrements: (userId: string, amounts: number[]) => Promise<void>;
  fetchDateSupplements: (userId: string, date: string) => Promise<void>;
  addWater: (userId: string, ml: number) => Promise<void>;
  addSupplement: (userId: string, key: string, amount: number) => Promise<void>;
  /** Removes today's most recent entry of this supplement (not the whole day). */
  undoLastSupplement: (userId: string, key: string) => Promise<void>;
  deleteSupplementEntry: (userId: string, entry: SupplementEntry) => Promise<void>;
  undoLastWater: (userId: string) => Promise<void>;
  /** Optimistic; rolls back and returns the error message if the save fails. */
  updateSupplementGoals: (userId: string, goals: { water_goal?: number; creatine_goal?: number }) => Promise<{ error: string | null }>;
  /** Clears the previous account's supplements and totals from memory. */
  resetForSignOut: () => void;
}

/** After a today-only write, reload the day list only if the Nutrition tab is showing today. */
function refreshDateEntriesIfToday(get: () => SupplementState, userId: string) {
  const today = toLocalDateString();
  if (latestDateRequest === today) get().fetchDateSupplements(userId, today);
}

/** Bumped on sign-out, so a config load still running for the previous account is ignored. */
let _gen = 0;

/** Latest date asked for by fetchDateSupplements, and a counter so older responses are ignored. */
let latestDateRequest: string | null = null;
let dateRequestId = 0;
/** The user and day (`userId:date`) whose entries are in `dateEntries`. */
let loadedDateKey: string | null = null;
/** The user and day (`userId:date`) whose totals are in `water` / `supplementTotals`. */
let loadedTodayKey: string | null = null;

/** Increments per today-totals load, so an older load can't overwrite a newer one. */
let _todayRequestId = 0;
/** Water/supplement taps still saving. A totals load that lands meanwhile may not include them. */
let _todayPending = 0;
/** Bumped when a tap starts, so a load that began before it knows its totals may be missing it. */
let _todayWriteSeq = 0;
/** A totals load that landed during a save; it runs again once the saves finish. */
let _reloadTodayFor: string | null = null;

function beginTodayWrite() {
  _todayPending++;
  _todayWriteSeq++;
}

function endTodayWrite(get: () => SupplementState) {
  _todayPending = Math.max(0, _todayPending - 1);
  if (_todayPending > 0 || !_reloadTodayFor) return;
  const userId = _reloadTodayFor;
  _reloadTodayFor = null;
  get().fetchTodaySupplements(userId);
}

export const useSupplementStore = create<SupplementState>((set, get) => ({
  ...INITIAL_STATE(),

  /* ─── Config management (Supabase-synced) ───────────── */

  loadSupplementConfigs: async (userId: string) => {
    const gen = _gen;
    try {
      // 1. Try Supabase user_supplements table
      const { data: supaData, error: supaError } = await supabase
        .from('user_supplements')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order');

      if (gen !== _gen) return; // signed out meanwhile
      if (!supaError && supaData) {
        if (supaData.length > 0) {
          const configs = supaData.map(mapRowToConfig);
          set({ supplementConfigs: configs });
          await cacheConfigs(userId, configs);
          return;
        }
        // Table exists but empty — seed from AsyncStorage or legacy
        const json = await readUserScoped(CONFIGS_KEY, userId);
        if (json) {
          const cached = JSON.parse(json) as SupplementConfig[];
          if (gen !== _gen) return;
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
        if (gen !== _gen) return;
        const goal = legacy ? Number(legacy.creatine_goal) : 5;
        const defaults = [{ ...DEFAULT_CONFIGS[0], dailyGoal: goal }];
        set({ supplementConfigs: defaults });
        await supabase.from('user_supplements').insert(defaults.map((c, i) => configToRow(userId, c, i)));
        await cacheConfigs(userId, defaults);
        return;
      }

      // 2. Supabase table doesn't exist or errored — fall back to this account's cached copy
      const json = await readUserScoped(CONFIGS_KEY, userId);
      if (gen !== _gen) return;
      if (json) {
        set({ supplementConfigs: JSON.parse(json) });
        return;
      }
    } catch {}

    // 3. Nothing found — use defaults
    if (gen !== _gen) return;
    set({ supplementConfigs: DEFAULT_CONFIGS });
    await cacheConfigs(userId, DEFAULT_CONFIGS);
  },

  addSupplementConfig: async (userId: string, config: SupplementConfig) => {
    const configs = [...get().supplementConfigs, config];
    set({ supplementConfigs: configs });
    await cacheConfigs(userId, configs);
    let failed = false;
    try {
      const { error } = await supabase.from('user_supplements').insert(configToRow(userId, config, configs.length - 1));
      failed = !!error;
    } catch { failed = true; }
    if (failed) {
      // Roll back only this config, keeping any other change made meanwhile
      const rolledBack = get().supplementConfigs.filter((c) => c.key !== config.key);
      set({ supplementConfigs: rolledBack });
      await cacheConfigs(userId, rolledBack);
    }
  },

  removeSupplementConfig: async (userId: string, key: string) => {
    const prevConfigs = get().supplementConfigs;
    const index = prevConfigs.findIndex((c) => c.key === key);
    const removed = index >= 0 ? prevConfigs[index] : null;
    const configs = prevConfigs.filter((c) => c.key !== key);
    set({ supplementConfigs: configs });
    await cacheConfigs(userId, configs);
    let failed = false;
    try {
      const { error } = await supabase
        .from('user_supplements')
        .delete()
        .eq('user_id', userId)
        .eq('key', key);
      failed = !!error;
    } catch { failed = true; }
    if (failed && removed) {
      // Put it back where it was (unless it has been re-added meanwhile)
      const current = get().supplementConfigs;
      if (current.some((c) => c.key === key)) return;
      const rolledBack = [...current];
      rolledBack.splice(Math.min(index, rolledBack.length), 0, removed);
      set({ supplementConfigs: rolledBack });
      await cacheConfigs(userId, rolledBack);
    }
  },

  updateSupplementConfig: async (userId: string, key: string, updates: Partial<SupplementConfig>) => {
    const previous = get().supplementConfigs.find((c) => c.key === key);
    const configs = get().supplementConfigs.map((c) => (c.key === key ? { ...c, ...updates } : c));
    set({ supplementConfigs: configs });
    await cacheConfigs(userId, configs);

    const dbUpdates: Record<string, any> = {};
    if (updates.dailyGoal != null) dbUpdates.daily_goal = updates.dailyGoal;
    if (updates.name != null) dbUpdates.name = updates.name;
    if (updates.unit != null) dbUpdates.unit = updates.unit;
    if (updates.icon != null) dbUpdates.icon = updates.icon;
    if (updates.color != null) dbUpdates.color = updates.color;
    if (updates.increments != null) dbUpdates.increments = updates.increments;

    let failed = false;
    try {
      const { data, error } = await supabase
        .from('user_supplements')
        .update(dbUpdates)
        .eq('user_id', userId)
        .eq('key', key)
        .select('key');
      failed = !!error;
      // No row to update (its first upload never reached the server): an update "succeeds" while
      // saving nothing, and the change is gone after a reinstall. Insert the whole config instead.
      if (!error && (!data || data.length === 0)) {
        const current = get().supplementConfigs;
        const config = current.find((c) => c.key === key);
        if (config) {
          const { error: insertError } = await supabase
            .from('user_supplements')
            .insert(configToRow(userId, config, current.indexOf(config)));
          failed = !!insertError;
        }
      }
    } catch { failed = true; }
    if (failed && previous) {
      // Restore the fields this call changed
      const restore: Partial<SupplementConfig> = {};
      for (const field of Object.keys(updates) as (keyof SupplementConfig)[]) {
        (restore as any)[field] = previous[field];
      }
      const rolledBack = get().supplementConfigs.map((c) => (c.key === key ? { ...c, ...restore } : c));
      set({ supplementConfigs: rolledBack });
      await cacheConfigs(userId, rolledBack);
    }
  },

  setWaterIncrements: async (userId: string, amounts: number[]) => {
    if (amounts.length === 0) return;
    set({ waterIncrements: amounts });
    try { await writeUserScoped(WATER_AMOUNTS_KEY, userId, JSON.stringify(amounts)); } catch {}
  },

  /* ─── Data fetching ─────────────────────────────────── */

  fetchTodaySupplements: async (userId: string) => {
    const date = toLocalDateString();
    const key = `${userId}:${date}`;
    const gen = _gen;
    const requestId = ++_todayRequestId;
    const writeSeq = _todayWriteSeq;
    const { data, error } = await supabase
      .from('supplement_entries')
      .select('type, amount')
      .eq('user_id', userId)
      .eq('date', date);
    if (gen !== _gen) return; // signed out meanwhile
    if (requestId !== _todayRequestId) return; // a newer load has started

    // A tap (e.g. +250 ml) started while this loaded: these totals may not include it and would
    // briefly undo it on screen. Keep the tapped totals and load again once the saves finish.
    if (!error && data) {
      if (_todayPending > 0) {
        _reloadTodayFor = userId;
        return;
      }
      if (writeSeq !== _todayWriteSeq) {
        get().fetchTodaySupplements(userId);
        return;
      }
    }

    if (error || !data) {
      // Offline or failed: keep today's progress on screen. Only clear it when what is shown
      // belongs to another day or account.
      if (loadedTodayKey !== key) {
        loadedTodayKey = key;
        set({ water: 0, supplementTotals: {} });
      }
      return;
    }

    const water = data
      .filter((e) => e.type === 'water')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totals: Record<string, number> = {};
    for (const entry of data) {
      if (entry.type !== 'water') {
        totals[entry.type] = (totals[entry.type] || 0) + Number(entry.amount);
      }
    }

    loadedTodayKey = key;
    set({ water, supplementTotals: totals });
  },

  fetchSupplementGoals: async (userId: string) => {
    await get().loadSupplementConfigs(userId);

    const gen = _gen;
    try {
      const raw = await readUserScoped(WATER_AMOUNTS_KEY, userId);
      const parsed = raw ? JSON.parse(raw) : null;
      if (gen === _gen && Array.isArray(parsed) && parsed.length > 0) set({ waterIncrements: parsed });
    } catch {}

    const { data } = await supabase
      .from('supplement_goals')
      .select('water_goal')
      .eq('user_id', userId)
      .single();

    if (data) {
      set({ waterGoal: Number(data.water_goal) });
    }
  },

  fetchDateSupplements: async (userId: string, date: string) => {
    latestDateRequest = date;
    const requestId = ++dateRequestId;
    // Switching day (or account): drop the old list so it never shows under the new date.
    const key = `${userId}:${date}`;
    if (key !== loadedDateKey) {
      loadedDateKey = key;
      set({ dateEntries: [], dateEntriesDate: null });
    }
    const { data } = await supabase
      .from('supplement_entries')
      .select('id, type, amount, created_at')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (requestId !== dateRequestId) return;
    set({ dateEntries: (data as SupplementEntry[]) || [], dateEntriesDate: date });
  },

  /* ─── Water actions ─────────────────────────────────── */

  addWater: async (userId: string, ml: number) => {
    set((s) => ({ water: s.water + ml }));

    beginTodayWrite();
    const { error } = await supabase.from('supplement_entries').insert({
      user_id: userId,
      type: 'water',
      amount: ml,
      date: toLocalDateString(),
    });

    if (error) {
      set((s) => ({ water: s.water - ml }));
    } else {
      refreshDateEntriesIfToday(get, userId);
    }
    endTodayWrite(get);
  },

  undoLastWater: async (userId: string) => {
    const date = toLocalDateString();
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

    beginTodayWrite();
    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', data.id);

    if (error) {
      set((s) => ({ water: s.water + amount }));
    } else {
      refreshDateEntriesIfToday(get, userId);
    }
    endTodayWrite(get);
  },

  /* ─── Supplement entry actions ──────────────────────── */

  addSupplement: async (userId: string, key: string, amount: number) => {
    set((s) => ({
      supplementTotals: {
        ...s.supplementTotals,
        [key]: (s.supplementTotals[key] || 0) + amount,
      },
    }));

    beginTodayWrite();
    const { error } = await supabase.from('supplement_entries').insert({
      user_id: userId,
      type: key,
      amount,
      date: toLocalDateString(),
    });

    if (error) {
      set((s) => ({
        supplementTotals: {
          ...s.supplementTotals,
          [key]: Math.max(0, (s.supplementTotals[key] || 0) - amount),
        },
      }));
    } else {
      refreshDateEntriesIfToday(get, userId);
    }
    endTodayWrite(get);
  },

  undoLastSupplement: async (userId: string, key: string) => {
    beginTodayWrite();
    const { data: last } = await supabase
      .from('supplement_entries')
      .select('id, amount')
      .eq('user_id', userId)
      .eq('date', toLocalDateString())
      .eq('type', key)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) {
      endTodayWrite(get);
      return;
    }
    const amount = Number(last.amount) || 0;
    const sub = (v: number) => Math.max(0, Math.round((v - amount) * 100) / 100);
    set((s) => ({ supplementTotals: { ...s.supplementTotals, [key]: sub(s.supplementTotals[key] || 0) } }));

    const { error } = await supabase.from('supplement_entries').delete().eq('id', last.id);
    if (error) {
      set((s) => ({
        supplementTotals: { ...s.supplementTotals, [key]: Math.round(((s.supplementTotals[key] || 0) + amount) * 100) / 100 },
      }));
    } else {
      refreshDateEntriesIfToday(get, userId);
    }
    endTodayWrite(get);
  },

  deleteSupplementEntry: async (_userId: string, entry: SupplementEntry) => {
    const shownDate = get().dateEntriesDate;
    // `water` / `supplementTotals` are today's totals: only touch them for today's entries.
    const isToday = get().dateEntriesDate === toLocalDateString();
    set((s) => ({
      dateEntries: s.dateEntries.filter((e) => e.id !== entry.id),
      ...(!isToday ? {} : entry.type === 'water'
        ? { water: Math.max(0, s.water - entry.amount) }
        : {
            supplementTotals: {
              ...s.supplementTotals,
              [entry.type]: Math.max(0, (s.supplementTotals[entry.type] || 0) - entry.amount),
            },
          }),
    }));

    if (isToday) beginTodayWrite();
    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', entry.id);

    if (error) {
      // Put back only this entry, and only while the same day is showing.
      set((s) => ({
        ...(s.dateEntriesDate === shownDate && !s.dateEntries.some((e) => e.id === entry.id)
          ? { dateEntries: [...s.dateEntries, entry].sort((a, b) => a.created_at.localeCompare(b.created_at)) }
          : {}),
        ...(!isToday ? {} : entry.type === 'water'
          ? { water: s.water + entry.amount }
          : {
              supplementTotals: {
                ...s.supplementTotals,
                [entry.type]: (s.supplementTotals[entry.type] || 0) + entry.amount,
              },
            }),
      }));
    }
    if (isToday) endTodayWrite(get);
  },

  /* ─── Legacy goals (water) ──────────────────────────── */

  updateSupplementGoals: async (userId: string, goals: { water_goal?: number; creatine_goal?: number }) => {
    const prevWater = get().waterGoal;

    if (goals.water_goal != null) set({ waterGoal: goals.water_goal });

    // Update the account's row, or create it if there isn't one: an update alone "succeeds"
    // while saving nothing for accounts without a row, so the goal was lost after a reinstall.
    const res = await supabase
      .from('supplement_goals')
      .update(goals)
      .eq('user_id', userId)
      .select('user_id');
    let error = res.error;
    if (!error && (!res.data || res.data.length === 0)) {
      ({ error } = await supabase.from('supplement_goals').insert({ user_id: userId, ...goals }));
    }

    if (error) {
      if (goals.water_goal != null) set({ waterGoal: prevWater });
      return { error: error.message };
    }
    return { error: null };
  },

  resetForSignOut: () => {
    _gen++;
    dateRequestId++;
    _todayRequestId++;
    _reloadTodayFor = null;
    latestDateRequest = null;
    loadedDateKey = null;
    loadedTodayKey = null;
    set(INITIAL_STATE());
  },
}));
