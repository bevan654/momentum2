import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNutritionStore } from './useNutritionStore';
import { useFoodLogStore } from './useFoodLogStore';

/* ─── Types ────────────────────────────────────────────── */

export interface ProteinPowder {
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sort_order: number;
}

export interface ProteinPowderLogEntry {
  id: string;
  powder_id: string | null;
  food_entry_id: string | null;
  amount: number;
  date: string;
  created_at: string;
}

/* ─── Helpers ──────────────────────────────────────────── */

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function syncNutrition(userId: string) {
  useNutritionStore.getState().fetchTodayNutrition(userId);
}

function syncFoodLog(userId: string) {
  useFoodLogStore.getState().fetchDayEntries(userId);
}

/* ─── State ────────────────────────────────────────────── */

interface ProteinPowderState {
  powders: ProteinPowder[];
  scoopGoal: number;
  todayScoops: number;
  todayLogEntries: ProteinPowderLogEntry[];
  loading: boolean;

  fetchPowders: (userId: string) => Promise<void>;
  fetchScoopGoal: (userId: string) => Promise<void>;
  fetchTodayScoops: (userId: string) => Promise<void>;
  addPowder: (userId: string, powder: Omit<ProteinPowder, 'id' | 'user_id' | 'sort_order'>) => Promise<void>;
  updatePowder: (powderId: string, updates: Partial<Pick<ProteinPowder, 'name' | 'calories' | 'protein' | 'carbs' | 'fat'>>) => Promise<void>;
  deletePowder: (powderId: string) => Promise<void>;
  updateScoopGoal: (userId: string, goal: number) => Promise<void>;
  logScoop: (userId: string, powder: ProteinPowder, amount?: number) => Promise<void>;
  undoLastScoop: (userId: string) => Promise<void>;
}

export const useProteinPowderStore = create<ProteinPowderState>((set, get) => ({
  powders: [],
  scoopGoal: 0,
  todayScoops: 0,
  todayLogEntries: [],
  loading: false,

  /* ─── Data fetching ─────────────────────────────────── */

  fetchPowders: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('protein_powders')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order');

      if (!error && data) {
        set({
          powders: data.map((d) => ({
            id: d.id,
            user_id: d.user_id,
            name: d.name,
            calories: Number(d.calories) || 0,
            protein: Number(d.protein) || 0,
            carbs: Number(d.carbs) || 0,
            fat: Number(d.fat) || 0,
            sort_order: d.sort_order,
          })),
        });
      }
    } catch {}
  },

  fetchScoopGoal: async (userId: string) => {
    try {
      const { data } = await supabase
        .from('supplement_goals')
        .select('protein_powder_scoop_goal')
        .eq('user_id', userId)
        .single();

      if (data) {
        set({ scoopGoal: Number(data.protein_powder_scoop_goal) || 0 });
      }
    } catch {}
  },

  fetchTodayScoops: async (userId: string) => {
    const date = todayDate();
    try {
      const { data, error } = await supabase
        .from('protein_powder_log')
        .select('id, powder_id, food_entry_id, amount, date, created_at')
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const entries = data.map((d) => ({ ...d, amount: Number(d.amount) || 1 })) as ProteinPowderLogEntry[];
        const total = entries.reduce((sum, e) => sum + e.amount, 0);
        set({
          todayScoops: total,
          todayLogEntries: entries,
        });
      }
    } catch {}
  },

  /* ─── Powder CRUD (settings) ────────────────────────── */

  addPowder: async (userId: string, powder) => {
    const sortOrder = get().powders.length;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ProteinPowder = {
      ...powder,
      id: tempId,
      user_id: userId,
      sort_order: sortOrder,
    };

    set((s) => ({ powders: [...s.powders, optimistic] }));

    try {
      const { data, error } = await supabase
        .from('protein_powders')
        .insert({
          user_id: userId,
          name: powder.name,
          calories: powder.calories,
          protein: powder.protein,
          carbs: powder.carbs,
          fat: powder.fat,
          sort_order: sortOrder,
        })
        .select()
        .single();

      if (error || !data) {
        set((s) => ({ powders: s.powders.filter((p) => p.id !== tempId) }));
      } else {
        set((s) => ({
          powders: s.powders.map((p) =>
            p.id === tempId ? { ...p, id: data.id } : p,
          ),
        }));
      }
    } catch {
      set((s) => ({ powders: s.powders.filter((p) => p.id !== tempId) }));
    }
  },

  updatePowder: async (powderId: string, updates) => {
    const prev = get().powders;
    set((s) => ({
      powders: s.powders.map((p) =>
        p.id === powderId ? { ...p, ...updates } : p,
      ),
    }));

    const { error } = await supabase
      .from('protein_powders')
      .update(updates)
      .eq('id', powderId);

    if (error) {
      set({ powders: prev });
    }
  },

  deletePowder: async (powderId: string) => {
    const prev = get().powders;
    set((s) => ({ powders: s.powders.filter((p) => p.id !== powderId) }));

    const { error } = await supabase
      .from('protein_powders')
      .delete()
      .eq('id', powderId);

    if (error) {
      set({ powders: prev });
    }
  },

  updateScoopGoal: async (userId: string, goal: number) => {
    const prev = get().scoopGoal;
    set({ scoopGoal: goal });

    const { error } = await supabase
      .from('supplement_goals')
      .update({ protein_powder_scoop_goal: goal })
      .eq('user_id', userId);

    if (error) {
      set({ scoopGoal: prev });
    }
  },

  /* ─── Scoop logging ─────────────────────────────────── */

  logScoop: async (userId: string, powder: ProteinPowder, amount: number = 1) => {
    // Optimistic
    set((s) => ({ todayScoops: s.todayScoops + amount }));

    try {
      // 1. Create food entry (scale macros by amount)
      const { data: foodEntry, error: foodError } = await supabase
        .from('food_entries')
        .insert({
          user_id: userId,
          name: amount === 1 ? powder.name : `${powder.name} (${amount} scoop)`,
          calories: Math.round((Number(powder.calories) || 0) * amount),
          protein: Math.round(((Number(powder.protein) || 0) * amount) * 10) / 10,
          carbs: Math.round(((Number(powder.carbs) || 0) * amount) * 10) / 10,
          fat: Math.round(((Number(powder.fat) || 0) * amount) * 10) / 10,
          meal_type: 'snack',
          quantity: 1,
          serving_size: amount,
          serving_unit: 'scoop',
          is_planned: false,
        })
        .select('id')
        .single();

      if (foodError || !foodEntry) throw foodError;

      // 2. Create powder log entry linked to food entry
      const { data: logEntry, error: logError } = await supabase
        .from('protein_powder_log')
        .insert({
          user_id: userId,
          powder_id: powder.id,
          food_entry_id: foodEntry.id,
          amount,
          date: todayDate(),
        })
        .select('id, powder_id, food_entry_id, amount, date, created_at')
        .single();

      if (logError) throw logError;

      // 3. Update local log entries
      if (logEntry) {
        set((s) => ({
          todayLogEntries: [...s.todayLogEntries, logEntry as ProteinPowderLogEntry],
        }));
      }

      // 4. Sync nutrition + food log
      syncNutrition(userId);
      syncFoodLog(userId);
    } catch {
      // Rollback
      set((s) => ({ todayScoops: Math.max(0, s.todayScoops - amount) }));
    }
  },

  undoLastScoop: async (userId: string) => {
    const entries = get().todayLogEntries;
    const last = entries[entries.length - 1];
    if (!last) return;

    const undoAmount = last.amount;

    // Optimistic
    set((s) => ({
      todayScoops: Math.max(0, s.todayScoops - undoAmount),
      todayLogEntries: s.todayLogEntries.filter((e) => e.id !== last.id),
    }));

    try {
      // Delete food entry first (if linked)
      if (last.food_entry_id) {
        await supabase.from('food_entries').delete().eq('id', last.food_entry_id);
      }
      // Delete powder log entry
      await supabase.from('protein_powder_log').delete().eq('id', last.id);

      syncNutrition(userId);
      syncFoodLog(userId);
    } catch {
      // Rollback
      set((s) => ({
        todayScoops: s.todayScoops + undoAmount,
        todayLogEntries: [...s.todayLogEntries, last],
      }));
    }
  },
}));
