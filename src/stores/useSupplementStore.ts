import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface SupplementEntry {
  id: string;
  type: 'water' | 'creatine';
  amount: number;
  created_at: string;
}

interface SupplementState {
  water: number;
  waterGoal: number;
  creatine: number;
  creatineGoal: number;
  loading: boolean;
  /** Supplement entries for a specific date (used by food diary) */
  dateEntries: SupplementEntry[];
  fetchTodaySupplements: (userId: string) => Promise<void>;
  fetchSupplementGoals: (userId: string) => Promise<void>;
  fetchDateSupplements: (userId: string, date: string) => Promise<void>;
  addWater: (userId: string, ml: number) => Promise<void>;
  addCreatine: (userId: string, g: number) => Promise<void>;
  deleteSupplementEntry: (userId: string, entry: SupplementEntry) => Promise<void>;
  undoLastWater: (userId: string) => Promise<void>;
  resetCreatine: (userId: string) => Promise<void>;
  updateSupplementGoals: (userId: string, goals: { water_goal?: number; creatine_goal?: number }) => Promise<void>;
}

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const useSupplementStore = create<SupplementState>((set, get) => ({
  water: 0,
  waterGoal: 2500,
  creatine: 0,
  creatineGoal: 5,
  loading: false,
  dateEntries: [],

  fetchDateSupplements: async (userId: string, date: string) => {
    const { data } = await supabase
      .from('supplement_entries')
      .select('id, type, amount, created_at')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    set({ dateEntries: (data as SupplementEntry[]) || [] });
  },

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
      const creatine = data
        .filter((e) => e.type === 'creatine')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      set({ water, creatine });
    } else {
      set({ water: 0, creatine: 0 });
    }
  },

  fetchSupplementGoals: async (userId: string) => {
    const { data } = await supabase
      .from('supplement_goals')
      .select('water_goal, creatine_goal')
      .eq('user_id', userId)
      .single();

    if (data) {
      set({
        waterGoal: Number(data.water_goal),
        creatineGoal: Number(data.creatine_goal),
      });
    }
  },

  addWater: async (userId: string, ml: number) => {
    // Optimistic update
    set((s) => ({ water: s.water + ml }));

    const { error } = await supabase.from('supplement_entries').insert({
      user_id: userId,
      type: 'water',
      amount: ml,
      date: todayDate(),
    });

    if (error) {
      set((s) => ({ water: s.water - ml }));
    } else {
      // Refresh dateEntries so food diary updates
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  addCreatine: async (userId: string, g: number) => {
    set((s) => ({ creatine: s.creatine + g }));

    const { error } = await supabase.from('supplement_entries').insert({
      user_id: userId,
      type: 'creatine',
      amount: g,
      date: todayDate(),
    });

    if (error) {
      set((s) => ({ creatine: s.creatine - g }));
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  deleteSupplementEntry: async (userId: string, entry: SupplementEntry) => {
    // Optimistic: remove from dateEntries and adjust totals
    const prev = get().dateEntries;
    set((s) => ({
      dateEntries: s.dateEntries.filter((e) => e.id !== entry.id),
      ...(entry.type === 'water'
        ? { water: Math.max(0, s.water - entry.amount) }
        : { creatine: Math.max(0, s.creatine - entry.amount) }),
    }));

    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', entry.id);

    if (error) {
      // Rollback
      set((s) => ({
        dateEntries: prev,
        ...(entry.type === 'water'
          ? { water: s.water + entry.amount }
          : { creatine: s.creatine + entry.amount }),
      }));
    }
  },

  undoLastWater: async (userId: string) => {
    const date = todayDate();
    // Find the most recent water entry for today
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
    // Optimistic update
    set((s) => ({ water: Math.max(0, s.water - amount) }));

    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', data.id);

    if (error) {
      set((s) => ({ water: s.water + amount }));
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  resetCreatine: async (userId: string) => {
    const date = todayDate();
    const prevCreatine = get().creatine;
    // Optimistic update
    set({ creatine: 0 });

    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .eq('type', 'creatine');

    if (error) {
      set({ creatine: prevCreatine });
    } else {
      get().fetchDateSupplements(userId, todayDate());
    }
  },

  updateSupplementGoals: async (userId: string, goals: { water_goal?: number; creatine_goal?: number }) => {
    const prevWater = get().waterGoal;
    const prevCreatine = get().creatineGoal;

    if (goals.water_goal != null) set({ waterGoal: goals.water_goal });
    if (goals.creatine_goal != null) set({ creatineGoal: goals.creatine_goal });

    const { error } = await supabase
      .from('supplement_goals')
      .update(goals)
      .eq('user_id', userId);

    if (error) {
      set({ waterGoal: prevWater, creatineGoal: prevCreatine });
    }
  },
}));
