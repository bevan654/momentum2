import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useNutritionStore } from './useNutritionStore';

/* ─── Types ────────────────────────────────────────────── */

export interface FoodEntry {
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  created_at: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  quantity: number;
  fiber?: number | null;
  sugar?: number | null;
  is_planned: boolean;
  // Micronutrients
  vitamin_a?: number | null;
  vitamin_c?: number | null;
  vitamin_d?: number | null;
  vitamin_e?: number | null;
  vitamin_k?: number | null;
  vitamin_b6?: number | null;
  vitamin_b12?: number | null;
  folate?: number | null;
  calcium?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  potassium?: number | null;
  zinc?: number | null;
  sodium?: number | null;
  // Meal group (null = standalone entry)
  meal_group_id?: string | null;
  meal_group_name?: string | null;
}

export interface FoodCatalogItem {
  id: string;
  name: string;
  brand?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  serving_size: number;
  serving_unit: string;
  confidence: string;
  category?: string | null;
  food_catalog_id?: string | null;
  // Micronutrients
  vitamin_a?: number | null;
  vitamin_c?: number | null;
  vitamin_d?: number | null;
  vitamin_e?: number | null;
  vitamin_k?: number | null;
  vitamin_b6?: number | null;
  vitamin_b12?: number | null;
  folate?: number | null;
  calcium?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  potassium?: number | null;
  zinc?: number | null;
  sodium?: number | null;
}

export interface MealConfig {
  id: string;
  slot: string;
  label: string;
  icon: string;
  time_start: string;
  enabled: boolean;
  sort_order: number;
}

export interface NutritionGoals {
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
}

/* ─── Default meal configs ─────────────────────────────── */

const DEFAULT_MEALS: MealConfig[] = [
  { id: 'default-breakfast', slot: 'breakfast', label: 'Breakfast', icon: 'sunny-outline', time_start: '08:00', enabled: true, sort_order: 0 },
  { id: 'default-lunch', slot: 'lunch', label: 'Lunch', icon: 'restaurant-outline', time_start: '12:00', enabled: true, sort_order: 1 },
  { id: 'default-dinner', slot: 'dinner', label: 'Dinner', icon: 'moon-outline', time_start: '18:00', enabled: true, sort_order: 2 },
  { id: 'default-snack', slot: 'snack', label: 'Snacks', icon: 'cafe-outline', time_start: '15:00', enabled: true, sort_order: 3 },
];

/* ─── Helpers ──────────────────────────────────────────── */

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateRange(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
  return { start, end };
}

/**
 * Save a user-created food to the shared user_created_foods table.
 * Fire-and-forget — errors are silently ignored.
 */
async function saveUserCreatedFood(
  userId: string,
  entry: { name?: string; brand?: string | null; calories: number; protein: number; carbs: number; fat: number; fiber?: number | null; sugar?: number | null; serving_size?: number | null; serving_unit?: string | null },
) {
  try {
    await supabase.from('user_created_foods').insert({
      name: entry.name,
      brand: entry.brand ?? null,
      calories: Number(entry.calories) || 0,
      protein: Number(entry.protein) || 0,
      carbs: Number(entry.carbs) || 0,
      fat: Number(entry.fat) || 0,
      fiber: entry.fiber != null ? Number(entry.fiber) : null,
      sugar: entry.sugar != null ? Number(entry.sugar) : null,
      serving_size: Number(entry.serving_size) || 1,
      serving_unit: entry.serving_unit || 'serving',
      created_by: userId,
    });
  } catch {
    // Best-effort — don't block the main flow
  }
}

/** Fire-and-forget: re-fetch today's nutrition so HomeScreen updates instantly */
function syncNutrition(userId: string) {
  useNutritionStore.getState().fetchTodayNutrition(userId);
}

/* ─── Store ────────────────────────────────────────────── */

interface FoodLogState {
  // Date
  selectedDate: string;
  // Data
  entries: FoodEntry[];
  mealConfigs: MealConfig[];
  goals: NutritionGoals;
  // UI state
  collapsedMeals: Record<string, boolean>;
  loading: boolean;
  // Search
  catalogResults: FoodCatalogItem[];
  catalogLoading: boolean;
  // Default foods
  recentFoods: FoodCatalogItem[];
  popularFoods: FoodCatalogItem[];

  // Actions
  setDate: (date: string) => void;
  goNextDay: () => void;
  goPrevDay: () => void;
  goToday: () => void;
  fetchDayEntries: (userId: string, date?: string) => Promise<void>;
  fetchMealConfigs: (userId: string) => Promise<void>;
  fetchGoals: (userId: string) => Promise<void>;
  addEntry: (userId: string, entry: Omit<FoodEntry, 'id' | 'user_id' | 'created_at'>, targetDate?: string, targetHour?: number) => Promise<void>;
  updateEntry: (entryId: string, updates: Partial<Omit<FoodEntry, 'id' | 'user_id' | 'created_at'>>) => Promise<void>;
  moveEntryToHour: (entryId: string, hour: number) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  togglePlanned: (entryId: string) => Promise<void>;
  toggleMealCollapse: (mealSlot: string) => void;
  updateGoals: (userId: string, goals: Partial<NutritionGoals>) => Promise<void>;
  addMealConfig: (userId: string, meal: Omit<MealConfig, 'id'>) => Promise<void>;
  updateMealConfig: (mealId: string, updates: Partial<Omit<MealConfig, 'id'>>) => Promise<void>;
  deleteMealConfig: (mealId: string) => Promise<void>;
  deleteMealGroup: (mealGroupId: string) => Promise<void>;
  searchCatalog: (query: string) => Promise<void>;
  clearSearch: () => void;
  fetchDefaultFoods: (userId: string) => Promise<void>;
}

export const useFoodLogStore = create<FoodLogState>((set, get) => ({
  selectedDate: toDateString(new Date()),
  entries: [],
  mealConfigs: DEFAULT_MEALS,
  goals: { calorie_goal: 2000, protein_goal: 150, carbs_goal: 250, fat_goal: 65 },
  collapsedMeals: {},
  loading: false,
  catalogResults: [],
  catalogLoading: false,
  recentFoods: [],
  popularFoods: [],

  setDate: (date: string) => {
    set({ selectedDate: date });
  },

  goNextDay: () => {
    const { selectedDate } = get();
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    set({ selectedDate: toDateString(d) });
  },

  goPrevDay: () => {
    const { selectedDate } = get();
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    set({ selectedDate: toDateString(d) });
  },

  goToday: () => {
    set({ selectedDate: toDateString(new Date()) });
  },

  fetchDayEntries: async (userId: string, date?: string) => {
    const dateStr = date || get().selectedDate;
    set({ loading: true });

    const { start, end } = dateRange(dateStr);
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true });

    if (!error && data) {
      set({
        entries: data.map((d) => ({
          ...d,
          calories: Number(d.calories || 0),
          protein: Number(d.protein || 0),
          carbs: Number(d.carbs || 0),
          fat: Number(d.fat || 0),
          quantity: Number(d.quantity || 1),
          is_planned: Boolean(d.is_planned),
        })),
        loading: false,
      });
    } else {
      set({ loading: false });
    }
  },

  fetchMealConfigs: async (userId: string) => {
    const { data } = await supabase
      .from('meal_config')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });

    if (data && data.length > 0) {
      set({
        mealConfigs: data.map((d) => ({
          id: d.id,
          slot: d.slot,
          label: d.label,
          icon: d.icon,
          time_start: d.time_start,
          enabled: d.enabled,
          sort_order: d.sort_order,
        })),
      });
    }
  },

  fetchGoals: async (userId: string) => {
    const { data } = await supabase
      .from('nutrition_goals')
      .select('calorie_goal, protein_goal, carbs_goal, fat_goal')
      .eq('user_id', userId)
      .single();

    if (data) {
      set({
        goals: {
          calorie_goal: Number(data.calorie_goal),
          protein_goal: Number(data.protein_goal),
          carbs_goal: Number(data.carbs_goal),
          fat_goal: Number(data.fat_goal),
        },
      });
    }
  },

  addEntry: async (userId: string, entry, targetDate?: string, targetHour?: number) => {
    const tempId = `temp-${Date.now()}`;
    const { selectedDate } = get();
    let createdAt: string;
    if (targetDate && targetHour != null) {
      createdAt = new Date(targetDate + `T${String(targetHour).padStart(2, '0')}:00:00`).toISOString();
    } else if (targetDate) {
      createdAt = new Date(targetDate + 'T12:00:00').toISOString();
    } else {
      createdAt = new Date().toISOString();
    }
    const optimistic: FoodEntry = {
      ...entry,
      id: tempId,
      user_id: userId,
      created_at: createdAt,
    };

    // Only show optimistic entry if target matches current view
    const showOptimistic = !targetDate || targetDate === selectedDate;
    if (showOptimistic) {
      set((s) => ({ entries: [...s.entries, optimistic] }));
    }

    const insertData: Record<string, any> = {
      user_id: userId,
      name: entry.name || 'Unknown Food',
      calories: Number(entry.calories) || 0,
      protein: Number(entry.protein) || 0,
      carbs: Number(entry.carbs) || 0,
      fat: Number(entry.fat) || 0,
      meal_type: entry.meal_type || 'snack',
      brand: entry.brand || null,
      food_catalog_id: entry.food_catalog_id || null,
      serving_size: Number(entry.serving_size) || 1,
      serving_unit: entry.serving_unit || 'serving',
      quantity: Number(entry.quantity) || 1,
      fiber: entry.fiber != null ? Number(entry.fiber) : null,
      sugar: entry.sugar != null ? Number(entry.sugar) : null,
      is_planned: Boolean(entry.is_planned),
    };
    if (targetDate) {
      insertData.created_at = createdAt;
    }

    // Save to user_created_foods if this is a custom food with a name
    const foodName = (entry.name || '').trim();
    if (foodName && !entry.food_catalog_id) {
      saveUserCreatedFood(userId, entry);
    }

    try {
      const { data, error } = await supabase
        .from('food_entries')
        .insert(insertData)
        .select()
        .single();

      if (showOptimistic) {
        if (error || !data) {
          set((s) => ({ entries: s.entries.filter((e) => e.id !== tempId) }));
        } else {
          set((s) => ({
            entries: s.entries.map((e) =>
              e.id === tempId
                ? {
                    ...data,
                    calories: Number(data.calories || 0),
                    protein: Number(data.protein || 0),
                    carbs: Number(data.carbs || 0),
                    fat: Number(data.fat || 0),
                    quantity: Number(data.quantity || 1),
                    is_planned: Boolean(data.is_planned),
                  }
                : e,
            ),
          }));
        }
      }
      if (!error) syncNutrition(userId);
    } catch {
      if (showOptimistic) {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== tempId) }));
      }
    }
  },

  updateEntry: async (entryId: string, updates) => {
    const prev = get().entries;
    // Optimistic update
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, ...updates } : e,
      ),
    }));

    const { error } = await supabase
      .from('food_entries')
      .update(updates)
      .eq('id', entryId);

    if (error) {
      set({ entries: prev });
    } else {
      const uid = prev.find((e) => e.id === entryId)?.user_id;
      if (uid) syncNutrition(uid);
    }
  },

  moveEntryToHour: async (entryId: string, hour: number) => {
    const prev = get().entries;
    const entry = prev.find((e) => e.id === entryId);
    if (!entry) return;

    const d = new Date(entry.created_at);
    d.setHours(hour, 0, 0, 0);
    const newCreatedAt = d.toISOString();

    // Optimistic update
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, created_at: newCreatedAt } : e,
      ),
    }));

    const { error } = await supabase
      .from('food_entries')
      .update({ created_at: newCreatedAt })
      .eq('id', entryId);

    if (error) {
      set({ entries: prev });
    }
  },

  deleteEntry: async (entryId: string) => {
    const prev = get().entries;
    // Optimistic delete
    set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }));

    const { error } = await supabase
      .from('food_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      // Rollback
      set({ entries: prev });
    } else {
      const uid = prev.find((e) => e.id === entryId)?.user_id;
      if (uid) syncNutrition(uid);
    }
  },

  togglePlanned: async (entryId: string) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;

    const newPlanned = !entry.is_planned;
    // Optimistic update
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, is_planned: newPlanned } : e,
      ),
    }));

    const { error } = await supabase
      .from('food_entries')
      .update({ is_planned: newPlanned })
      .eq('id', entryId);

    if (error) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, is_planned: !newPlanned } : e,
        ),
      }));
    }
  },

  toggleMealCollapse: (mealSlot: string) => {
    set((s) => ({
      collapsedMeals: {
        ...s.collapsedMeals,
        [mealSlot]: !s.collapsedMeals[mealSlot],
      },
    }));
  },

  updateGoals: async (userId: string, goals: Partial<NutritionGoals>) => {
    const prev = get().goals;
    const merged = { ...prev, ...goals };
    set({ goals: merged });

    // Sync to useNutritionStore so HomeScreen reflects changes instantly
    useNutritionStore.setState({
      ...(goals.calorie_goal != null && { calorieGoal: goals.calorie_goal }),
      ...(goals.protein_goal != null && { proteinGoal: goals.protein_goal }),
      ...(goals.carbs_goal != null && { carbsGoal: goals.carbs_goal }),
      ...(goals.fat_goal != null && { fatGoal: goals.fat_goal }),
    });

    const { error } = await supabase
      .from('nutrition_goals')
      .update(goals)
      .eq('user_id', userId);

    if (error) {
      set({ goals: prev });
      // Rollback nutrition store too
      useNutritionStore.setState({
        calorieGoal: prev.calorie_goal,
        proteinGoal: prev.protein_goal,
        carbsGoal: prev.carbs_goal,
        fatGoal: prev.fat_goal,
      });
    }
  },

  addMealConfig: async (userId: string, meal: Omit<MealConfig, 'id'>) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: MealConfig = { ...meal, id: tempId };
    set((s) => ({ mealConfigs: [...s.mealConfigs, optimistic] }));

    const { data, error } = await supabase
      .from('meal_config')
      .insert({ user_id: userId, ...meal })
      .select()
      .single();

    if (error || !data) {
      set((s) => ({ mealConfigs: s.mealConfigs.filter((m) => m.id !== tempId) }));
    } else {
      set((s) => ({
        mealConfigs: s.mealConfigs.map((m) => (m.id === tempId ? { ...m, id: data.id } : m)),
      }));
    }
  },

  updateMealConfig: async (mealId: string, updates: Partial<Omit<MealConfig, 'id'>>) => {
    const prev = get().mealConfigs;
    set((s) => ({
      mealConfigs: s.mealConfigs.map((m) => (m.id === mealId ? { ...m, ...updates } : m)),
    }));

    const { error } = await supabase
      .from('meal_config')
      .update(updates)
      .eq('id', mealId);

    if (error) {
      set({ mealConfigs: prev });
    }
  },

  deleteMealConfig: async (mealId: string) => {
    const prev = get().mealConfigs;
    set((s) => ({ mealConfigs: s.mealConfigs.filter((m) => m.id !== mealId) }));

    const { error } = await supabase
      .from('meal_config')
      .delete()
      .eq('id', mealId);

    if (error) {
      set({ mealConfigs: prev });
    }
  },

  deleteMealGroup: async (mealGroupId: string) => {
    const prev = get().entries;
    // Optimistic delete all entries in this meal group
    set((s) => ({ entries: s.entries.filter((e) => e.meal_group_id !== mealGroupId) }));

    const { error } = await supabase
      .from('food_entries')
      .delete()
      .eq('meal_group_id', mealGroupId);

    if (error) {
      set({ entries: prev });
    } else {
      const uid = prev[0]?.user_id;
      if (uid) syncNutrition(uid);
    }
  },

  searchCatalog: async (query: string) => {
    if (query.length < 2) {
      set({ catalogResults: [], catalogLoading: false });
      return;
    }

    set({ catalogLoading: true });

    const [catalogRes, userRes, entryRes] = await Promise.all([
      supabase
        .from('food_catalog')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('popularity', { ascending: false })
        .limit(25),
      supabase
        .from('user_created_foods')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('food_entries')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (catalogRes.error) console.warn('food_catalog search error:', catalogRes.error.message);
    if (userRes.error) console.warn('user_created_foods search error:', userRes.error.message);
    if (entryRes.error) console.warn('food_entries search error:', entryRes.error.message);

    const catalogItems: FoodCatalogItem[] = (catalogRes.data || []).map((d) => ({
      ...d,
      calories: Number(d.calories || 0),
      protein: Number(d.protein || 0),
      carbs: Number(d.carbs || 0),
      fat: Number(d.fat || 0),
      serving_size: Number(d.serving_size || 100),
    }));

    // Deduplicate user-created foods by name (case-insensitive)
    const allNames = new Set(catalogItems.map((c) => c.name.toLowerCase()));
    const seen = new Set<string>();
    const userItems: FoodCatalogItem[] = [];
    for (const d of userRes.data || []) {
      const key = d.name?.toLowerCase();
      if (!key || allNames.has(key) || seen.has(key)) continue;
      seen.add(key);
      allNames.add(key);
      userItems.push({
        id: d.id,
        name: d.name,
        brand: d.brand || null,
        calories: Number(d.calories || 0),
        protein: Number(d.protein || 0),
        carbs: Number(d.carbs || 0),
        fat: Number(d.fat || 0),
        fiber: d.fiber != null ? Number(d.fiber) : null,
        sugar: d.sugar != null ? Number(d.sugar) : null,
        serving_size: Number(d.serving_size) || 1,
        serving_unit: d.serving_unit || 'serving',
        confidence: 'user_submitted',
        category: null,
      });
    }

    // Also include user's own logged entries as searchable items
    const entryItems: FoodCatalogItem[] = [];
    for (const d of entryRes.data || []) {
      const key = d.name?.toLowerCase();
      if (!key || allNames.has(key) || seen.has(key)) continue;
      seen.add(key);
      const qty = Number(d.quantity) || 1;
      entryItems.push({
        id: d.id,
        food_catalog_id: d.food_catalog_id || null,
        name: d.name,
        brand: d.brand || null,
        calories: Number(d.calories || 0) / qty,
        protein: Number(d.protein || 0) / qty,
        carbs: Number(d.carbs || 0) / qty,
        fat: Number(d.fat || 0) / qty,
        fiber: d.fiber != null ? Number(d.fiber) / qty : null,
        sugar: d.sugar != null ? Number(d.sugar) / qty : null,
        serving_size: Number(d.serving_size) || 1,
        serving_unit: d.serving_unit || 'serving',
        confidence: 'user',
        category: null,
      });
    }

    set({ catalogResults: [...catalogItems, ...userItems, ...entryItems], catalogLoading: false });
  },

  clearSearch: () => {
    set({ catalogResults: [], catalogLoading: false });
  },

  fetchDefaultFoods: async (userId: string) => {
    const [recentRes, popularRes] = await Promise.all([
      supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('food_catalog')
        .select('*')
        .order('popularity', { ascending: false })
        .limit(10),
    ]);

    // Deduplicate recent entries by name → keep last 5 unique
    const seen = new Set<string>();
    const recentFoods: FoodCatalogItem[] = [];
    if (recentRes.data) {
      for (const d of recentRes.data) {
        const key = d.name?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const qty = Number(d.quantity) || 1;
        recentFoods.push({
          id: d.id,
          food_catalog_id: d.food_catalog_id || null,
          name: d.name,
          brand: d.brand || null,
          calories: Number(d.calories || 0) / qty,
          protein: Number(d.protein || 0) / qty,
          carbs: Number(d.carbs || 0) / qty,
          fat: Number(d.fat || 0) / qty,
          fiber: d.fiber != null ? Number(d.fiber) / qty : null,
          sugar: d.sugar != null ? Number(d.sugar) / qty : null,
          serving_size: Number(d.serving_size) || 1,
          serving_unit: d.serving_unit || 'serving',
          confidence: 'user',
          category: null,
          vitamin_a: d.vitamin_a != null ? Number(d.vitamin_a) / qty : null,
          vitamin_c: d.vitamin_c != null ? Number(d.vitamin_c) / qty : null,
          vitamin_d: d.vitamin_d != null ? Number(d.vitamin_d) / qty : null,
          vitamin_e: d.vitamin_e != null ? Number(d.vitamin_e) / qty : null,
          vitamin_k: d.vitamin_k != null ? Number(d.vitamin_k) / qty : null,
          vitamin_b6: d.vitamin_b6 != null ? Number(d.vitamin_b6) / qty : null,
          vitamin_b12: d.vitamin_b12 != null ? Number(d.vitamin_b12) / qty : null,
          folate: d.folate != null ? Number(d.folate) / qty : null,
          calcium: d.calcium != null ? Number(d.calcium) / qty : null,
          iron: d.iron != null ? Number(d.iron) / qty : null,
          magnesium: d.magnesium != null ? Number(d.magnesium) / qty : null,
          potassium: d.potassium != null ? Number(d.potassium) / qty : null,
          zinc: d.zinc != null ? Number(d.zinc) / qty : null,
          sodium: d.sodium != null ? Number(d.sodium) / qty : null,
        });
        if (recentFoods.length >= 5) break;
      }
    }

    const popularFoods: FoodCatalogItem[] = (popularRes.data || []).map((d) => ({
      ...d,
      calories: Number(d.calories || 0),
      protein: Number(d.protein || 0),
      carbs: Number(d.carbs || 0),
      fat: Number(d.fat || 0),
      serving_size: Number(d.serving_size || 100),
    }));

    set({ recentFoods, popularFoods });
  },
}));
