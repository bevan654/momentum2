import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const CACHE_KEY = '@momentum_nutrition_cache';

interface NutritionCache {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  date: string;
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
  steps: number;
  caloriesBurned: number;
  loading: boolean;
  fetchTodayNutrition: (userId: string) => Promise<void>;
  fetchNutritionGoals: (userId: string) => Promise<void>;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { start, end };
}

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function cacheState(state: NutritionState) {
  const data: NutritionCache = {
    calories: state.calories,
    calorieGoal: state.calorieGoal,
    protein: state.protein,
    proteinGoal: state.proteinGoal,
    carbs: state.carbs,
    carbsGoal: state.carbsGoal,
    fat: state.fat,
    fatGoal: state.fatGoal,
    date: todayDate(),
  };
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  calories: 0,
  calorieGoal: 2000,
  protein: 0,
  proteinGoal: 150,
  carbs: 0,
  carbsGoal: 250,
  fat: 0,
  fatGoal: 65,
  steps: 0,
  caloriesBurned: 0,
  loading: false,

  fetchTodayNutrition: async (userId: string) => {
    const { start, end } = todayRange();
    const { data } = await supabase
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
      });
      cacheState(get());
    } else if (data) {
      set({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      cacheState(get());
    } else {
      // Supabase returned null (network error) — load from cache
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: NutritionCache = JSON.parse(raw);
          if (cached.date === todayDate()) {
            set({
              calories: cached.calories,
              protein: cached.protein,
              carbs: cached.carbs,
              fat: cached.fat,
              calorieGoal: cached.calorieGoal,
              proteinGoal: cached.proteinGoal,
              carbsGoal: cached.carbsGoal,
              fatGoal: cached.fatGoal,
            });
          }
        }
      } catch {}
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
      });
      cacheState(get());
    } else {
      // Network error — goals may be in cache already (loaded via fetchTodayNutrition)
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: NutritionCache = JSON.parse(raw);
          set({
            calorieGoal: cached.calorieGoal,
            proteinGoal: cached.proteinGoal,
            carbsGoal: cached.carbsGoal,
            fatGoal: cached.fatGoal,
          });
        }
      } catch {}
    }
  },
}));
