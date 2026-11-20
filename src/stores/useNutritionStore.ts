import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toLocalDateString } from '../utils/localDate';

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

export const useNutritionStore = create<NutritionState>((set) => ({
  calories: 0,
  calorieGoal: 2000,
  protein: 0,
  proteinGoal: 150,
  carbs: 0,
  carbsGoal: 250,
  fat: 0,
  fatGoal: 65,
  totalsFor: null,
  goalsFor: null,

  fetchTodayNutrition: async (userId: string) => {
    const { start, end } = todayRange();
    const day = toLocalDateString();
    const { data, error } = await supabase
      .from('food_entries')
      .select('calories, protein, carbs, fat')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end);

    if (data && data.length > 0) {
      const totals = data.reduce(
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
      });
    } else {
      set({ calories: 0, protein: 0, carbs: 0, fat: 0, ...(error ? {} : { totalsFor: { userId, day } }) });
    }
  },

  fetchNutritionGoals: async (userId: string) => {
    const { data } = await supabase
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
    }
  },
}));
