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
  /** Micronutrient columns (fiber, sugar, MICRO_KEYS), for components/food/dayTotals.ts sumMicros. */
  [micro: string]: number | string | boolean | null;
}

interface NutritionState {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  /** Whose totals these are and the local day they were fetched for; null until a fetch succeeds. */
  totalsFor: { userId: string; day: string } | null;
  /** Today's food rows behind the totals (macros, meal, planned flag), set with totalsFor; for per-meal sums. */
  todayEntries: TodayFoodRow[];
  /** Whose goals these are; null while they're still the defaults. */
  goalsFor: string | null;
  fetchTodayNutrition: (userId: string) => Promise<void>;
  fetchNutritionGoals: (userId: string) => Promise<void>;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

/** The goals a user without a nutrition_goals row has. */
const DEFAULT_GOALS = { calorieGoal: 2000, proteinGoal: 150, carbsGoal: 250, fatGoal: 65 };

export const useNutritionStore = create<NutritionState>((set) => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  ...DEFAULT_GOALS,
  totalsFor: null,
  todayEntries: [],
  goalsFor: null,

  fetchTodayNutrition: async (userId: string) => {
    const { start, end } = todayRange();
    const day = toLocalDateString();
    const { data, error } = await supabase
      .from('food_entries')
      // The micronutrient columns are fiber, sugar and useFoodLogStore MICRO_KEYS (the widgets' micronutrients).
      .select('calories, protein, carbs, fat, meal_type, is_planned, meal_group_id, created_at, fiber, sugar, vitamin_a, vitamin_c, vitamin_d, vitamin_e, vitamin_k, vitamin_b6, vitamin_b12, folate, calcium, iron, magnesium, potassium, zinc, sodium, caffeine')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end);

    if (data && data.length > 0) {
      // Planned food isn't eaten yet: left out, as the food diary does (components/food/dayTotals.ts).
      const totals = data.filter((entry) => !entry.is_planned).reduce(
        (acc, entry) => ({
          calories: acc.calories + Number(entry.calories || 0),
          protein: acc.protein + Number(entry.protein || 0),
          carbs: acc.carbs + Number(entry.carbs || 0),
          fat: acc.fat + Number(entry.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      set({
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein * 10) / 10,
        carbs: Math.round(totals.carbs * 10) / 10,
        fat: Math.round(totals.fat * 10) / 10,
        totalsFor: { userId, day },
        todayEntries: data as TodayFoodRow[],
      });
    } else {
      set({ calories: 0, protein: 0, carbs: 0, fat: 0, ...(error ? {} : { totalsFor: { userId, day }, todayEntries: [] }) });
    }
  },

  fetchNutritionGoals: async (userId: string) => {
    const { data, error } = await supabase
      .from('nutrition_goals')
      .select('calorie_goal, protein_goal, carbs_goal, fat_goal')
      .eq('user_id', userId)
      .single();

    if (data) {
      set({
        calorieGoal: Number(data.calorie_goal),
        proteinGoal: Number(data.protein_goal),
        carbsGoal: Number(data.carbs_goal),
        fatGoal: Number(data.fat_goal),
        goalsFor: userId,
      });
    } else if (error?.code === 'PGRST116') {
      // No goals row: this user has the defaults (set them: the store may still hold the last account's).
      set({ ...DEFAULT_GOALS, goalsFor: userId });
    }
  },
}));
