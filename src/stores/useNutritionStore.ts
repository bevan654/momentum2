import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/** Today's eaten totals for Home. The goals are loaded (and saved) by useFoodLogStore, which writes them here. */
interface NutritionState {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  fetchTodayNutrition: (userId: string) => Promise<void>;
  /** Clears the previous account's totals and goals. */
  resetForSignOut: () => void;
}

const INITIAL = {
  calories: 0,
  calorieGoal: 2000,
  protein: 0,
  proteinGoal: 150,
  carbs: 0,
  carbsGoal: 250,
  fat: 0,
  fatGoal: 65,
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

/** Increments per totals request, so an older response can't overwrite newer totals. */
let _requestId = 0;
/** The user and day (`userId:start`) whose totals are on screen. */
let _loadedKey: string | null = null;

export const useNutritionStore = create<NutritionState>((set) => ({
  ...INITIAL,

  fetchTodayNutrition: async (userId: string) => {
    const requestId = ++_requestId;
    const { start, end } = todayRange();
    const { data, error } = await supabase
      .from('food_entries')
      .select('calories, protein, carbs, fat, is_planned')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end);

    // A newer request started (e.g. two foods added quickly): its totals are the current ones.
    if (requestId !== _requestId) return;
    // Offline or failed: keep what's on screen instead of showing 0 eaten, unless it's another
    // day's (or account's) totals.
    const key = `${userId}:${start}`;
    if (error || !data) {
      if (_loadedKey !== key) {
        _loadedKey = key;
        set({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
      return;
    }
    _loadedKey = key;

    // Same as the Nutrition tab: planned food doesn't count until it's eaten, whole numbers.
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    for (const entry of data) {
      if (entry.is_planned) continue;
      calories += Number(entry.calories || 0);
      protein += Number(entry.protein || 0);
      carbs += Number(entry.carbs || 0);
      fat += Number(entry.fat || 0);
    }
    set({
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    });
  },

  resetForSignOut: () => {
    _requestId++;
    _loadedKey = null;
    set(INITIAL);
  },
}));
