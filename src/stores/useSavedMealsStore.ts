import { create } from 'zustand';
import { readUserScoped, writeUserScoped } from '../lib/userScopedStorage';
import { getCurrentUserId } from '../lib/currentUser';

const STORAGE_KEY = 'momentum_saved_meals';

/* ─── Types ────────────────────────────────────────────── */

export interface MealItem {
  id: string;
  name: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  /** Per one serving of serving_size + serving_unit; the meal multiplies them by quantity. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  /** Vitamins, minerals, sodium and caffeine per serving, like the macros (missing on meals saved before they were kept). */
  micros?: Record<string, number | null>;
  /** User-editable serving size */
  serving_size: number;
  /** Unused: only on meals saved by old builds. */
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
  /** Clears this account's meals from memory (they stay saved on the phone for when it signs in again). */
  resetForSignOut: () => void;
}

/** Bumped on sign-out, so a load still running for the previous account is ignored. */
let _gen = 0;
let _loading: Promise<void> | null = null;

function persist(meals: SavedMeal[]) {
  const userId = getCurrentUserId();
  if (!userId) return;
  writeUserScoped(STORAGE_KEY, userId, JSON.stringify(meals)).catch(() => {});
}

export const useSavedMealsStore = create<SavedMealsState>((set, get) => ({
  meals: [],
  loaded: false,

  loadMeals: () => {
    if (get().loaded) return Promise.resolve();
    if (_loading) return _loading;
    const userId = getCurrentUserId();
    if (!userId) return Promise.resolve();
    const gen = _gen;
    const run = (async () => {
      let meals: SavedMeal[] = [];
      try {
        const raw = await readUserScoped(STORAGE_KEY, userId);
        if (raw) meals = JSON.parse(raw);
      } catch { /* silent */ }
      if (gen === _gen) set({ meals, loaded: true });
    })().finally(() => {
      if (_loading === run) _loading = null;
    });
    _loading = run;
    return run;
  },

  saveMeal: async (name: string, items: MealItem[]) => {
    // Load first: saving into a list that hasn't loaded yet would overwrite the stored meals.
    await get().loadMeals();
    const id = `meal-${Date.now()}`;
    const now = new Date().toISOString();
    const meal: SavedMeal = { id, name, items, created_at: now, updated_at: now };
    const updated = [...get().meals, meal];
    set({ meals: updated });
    persist(updated);
    return id;
  },

  updateMeal: async (id: string, name: string, items: MealItem[]) => {
    await get().loadMeals();
    const updated = get().meals.map((m) =>
      m.id === id ? { ...m, name, items, updated_at: new Date().toISOString() } : m,
    );
    set({ meals: updated });
    persist(updated);
  },

  resetForSignOut: () => {
    _gen++;
    _loading = null;
    set({ meals: [], loaded: false });
  },
}));
