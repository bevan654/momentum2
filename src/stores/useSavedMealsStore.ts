import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'momentum_saved_meals';

/* ─── Types ────────────────────────────────────────────── */

export interface MealItem {
  id: string;
  name: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  /** Macros are per base_serving_size (the original catalog serving) */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  /** User-editable serving size */
  serving_size: number;
  /** Original catalog serving size (defaults to serving_size for backward compat) */
  base_serving_size?: number;
  serving_unit: string;
  quantity: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: MealItem[];
  created_at: string;
  updated_at: string;
}

/* ─── Store ────────────────────────────────────────────── */

interface SavedMealsState {
  meals: SavedMeal[];
  loaded: boolean;
  loadMeals: () => Promise<void>;
  saveMeal: (name: string, items: MealItem[]) => Promise<string>;
  updateMeal: (id: string, name: string, items: MealItem[]) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
}

async function persist(meals: SavedMeal[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  } catch { /* silent */ }
}

export const useSavedMealsStore = create<SavedMealsState>((set, get) => ({
  meals: [],
  loaded: false,

  loadMeals: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ meals: JSON.parse(raw), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  saveMeal: async (name: string, items: MealItem[]) => {
    const id = `meal-${Date.now()}`;
    const now = new Date().toISOString();
    const meal: SavedMeal = { id, name, items, created_at: now, updated_at: now };
    const updated = [...get().meals, meal];
    set({ meals: updated });
    persist(updated);
    return id;
  },

  updateMeal: async (id: string, name: string, items: MealItem[]) => {
    const updated = get().meals.map((m) =>
      m.id === id ? { ...m, name, items, updated_at: new Date().toISOString() } : m,
    );
    set({ meals: updated });
    persist(updated);
  },

  deleteMeal: async (id: string) => {
    const updated = get().meals.filter((m) => m.id !== id);
    set({ meals: updated });
    persist(updated);
  },
}));
