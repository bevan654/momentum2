import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toLocalDateString } from '../utils/localDate';

/** One of today's food rows as fetchTodayNutrition selects it (enough for groupEntriesByMeal's totals). */
export interface TodayFoodRow {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  is_planned: boolean;
  meal_group_id: string | null;
  created_at: string;
  /** Micronutrient columns (MICRO_COLUMNS), for components/food/dayTotals.ts sumMicros. */
  [micro: string]: number | string | boolean | null;
}

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
  /** Today's eaten micronutrients (and fiber, sugar), by food_entries column. */
  micros: Record<string, number>;
  /** Whose totals these are and the local day they were fetched for; null until a fetch succeeds. */
  totalsFor: { userId: string; day: string } | null;
  /** Today's food rows behind the totals (macros, meal, planned flag), set with totalsFor; for per-meal sums (home widgets). */
  todayEntries: TodayFoodRow[];
  /** Whose goals these are (set by useFoodLogStore once they loaded or saved); null while they're the defaults. */
  goalsFor: string | null;
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
  micros: {} as Record<string, number>,
  totalsFor: null as { userId: string; day: string } | null,
  todayEntries: [] as TodayFoodRow[],
  goalsFor: null as string | null,
};

/** food_entries columns summed into `micros` (the nutrients a user can track on Home). */
const MICRO_COLUMNS = [
  'fiber', 'sugar', 'caffeine', 'sodium', 'calcium', 'iron', 'potassium', 'magnesium', 'zinc',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k', 'vitamin_b6', 'vitamin_b12', 'folate',
] as const;

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

/** Eaten totals and micros of today's rows (planned food doesn't count until it's eaten). */
function totalsFrom(rows: Record<string, unknown>[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  const micros: Record<string, number> = {};
  for (const entry of rows) {
    if (entry.is_planned) continue;
    calories += Number(entry.calories || 0);
    protein += Number(entry.protein || 0);
    carbs += Number(entry.carbs || 0);
    fat += Number(entry.fat || 0);
    for (const key of MICRO_COLUMNS) {
      const v = entry[key];
      if (v != null) micros[key] = (micros[key] || 0) + Number(v);
    }
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    micros,
  };
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
    const day = toLocalDateString();
    const { data, error } = await supabase
      .from('food_entries')
      // meal_type, meal_group_id and created_at: the home widgets' protein per meal.
      .select(`calories, protein, carbs, fat, is_planned, meal_type, meal_group_id, created_at, ${MICRO_COLUMNS.join(', ')}`)
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
        set({ calories: 0, protein: 0, carbs: 0, fat: 0, micros: {} });
      }
      return;
    }
    _loadedKey = key;
    // Same as the Nutrition tab: planned food doesn't count until it's eaten, whole numbers.
    set({
      ...totalsFrom(data as unknown as Record<string, unknown>[]),
      totalsFor: { userId, day },
      todayEntries: data as unknown as TodayFoodRow[],
    });
  },

  resetForSignOut: () => {
    _requestId++;
    _loadedKey = null;
    set(INITIAL);
  },
}));
