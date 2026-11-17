import { create } from 'zustand';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNutritionStore } from './useNutritionStore';
import { toLocalDateString } from '../utils/localDate';
import { getCurrentUserId } from '../lib/currentUser';

/** Increments per search (and clear), so a slow earlier search can't overwrite newer results. */
let _searchSeq = 0;

/** Micronutrient columns (vitamins, minerals, sodium, caffeine). Fiber and sugar travel with the macros. */
export const MICRO_KEYS = [
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k', 'vitamin_b6', 'vitamin_b12',
  'folate', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'sodium', 'caffeine',
] as const;
type MicroKey = (typeof MICRO_KEYS)[number];

/** Each micronutrient of `src` as a number (divided by `per`), or null when it's missing. */
function microsFrom(src: Record<string, any>, per = 1): Record<MicroKey, number | null> {
  const out = {} as Record<MicroKey, number | null>;
  for (const k of MICRO_KEYS) out[k] = src[k] != null ? Number(src[k]) / per : null;
  return out;
}

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
  caffeine?: number | null;
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
  caffeine?: number | null;
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

function dateRange(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
  return { start, end };
}

/** Quick Add's name when the user didn't type one: not a food anyone could search for. */
const UNNAMED_QUICK_ADD = 'quick add';

/**
 * Save a user-created food to the shared user_created_foods table (readable by every user).
 * Stored per single serving, once per user and name. Fire-and-forget — errors are ignored.
 */
async function saveUserCreatedFood(
  userId: string,
  entry: Record<string, any>,
) {
  const name = String(entry.name || '').trim();
  if (!name || name.toLowerCase() === UNNAMED_QUICK_ADD) return;
  // The entry holds totals for the amount logged; the shared row is one serving.
  const qty = Number(entry.quantity) > 0 ? Number(entry.quantity) : 1;
  try {
    // Already shared by this user: don't add a copy on every log.
    const { data: existing, error: lookupError } = await supabase
      .from('user_created_foods')
      .select('id')
      .eq('created_by', userId)
      // Case-insensitive exact match: escape ilike's wildcards.
      .ilike('name', name.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1);
    if (lookupError || (existing && existing.length > 0)) return;

    await supabase.from('user_created_foods').insert({
      name,
      brand: entry.brand ?? null,
      calories: (Number(entry.calories) || 0) / qty,
      protein: (Number(entry.protein) || 0) / qty,
      carbs: (Number(entry.carbs) || 0) / qty,
      fat: (Number(entry.fat) || 0) / qty,
      fiber: entry.fiber != null ? Number(entry.fiber) / qty : null,
      sugar: entry.sugar != null ? Number(entry.sugar) / qty : null,
      ...microsFrom(entry, qty),
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
  /** False until the account's goals have loaded: `goals` holds defaults, not the user's values. */
  goalsLoaded: boolean;
  loading: boolean;
  /** The selected day's entries failed to load (offline): the diary shouldn't look like an empty day. */
  loadError: boolean;
  // Search
  catalogResults: FoodCatalogItem[];
  catalogLoading: boolean;
  // Default foods
  recentFoods: FoodCatalogItem[];
  popularFoods: FoodCatalogItem[];

  // Actions
  setDate: (date: string) => void;
  goToday: () => void;
  fetchDayEntries: (userId: string, date?: string) => Promise<void>;
  fetchMealConfigs: (userId: string) => Promise<void>;
  fetchGoals: (userId: string) => Promise<void>;
  addEntry: (userId: string, entry: Omit<FoodEntry, 'id' | 'user_id' | 'created_at'>, targetDate?: string, targetHour?: number) => Promise<void>;
  updateEntry: (entryId: string, updates: Partial<Omit<FoodEntry, 'id' | 'user_id' | 'created_at'>>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  togglePlanned: (entryId: string) => Promise<void>;
  /** Optimistic; rolls back and returns the error message if the save fails. */
  updateGoals: (userId: string, goals: Partial<NutritionGoals>) => Promise<{ error: string | null }>;
  deleteMealGroup: (mealGroupId: string) => Promise<void>;
  searchCatalog: (query: string) => Promise<void>;
  clearSearch: () => void;
  fetchDefaultFoods: (userId: string) => Promise<void>;
  /** Clears the previous account's diary, goals, meals and recent foods from memory. */
  resetForSignOut: () => void;
}

const DEFAULT_GOALS: NutritionGoals = { calorie_goal: 2000, protein_goal: 150, carbs_goal: 250, fat_goal: 65 };

/** Guards fetchDayEntries against out-of-order responses when days are switched quickly. */
let dayRequestId = 0;
/** The user and day (`userId:date`) whose entries are currently in the store. */
let loadedEntriesKey: string | null = null;

/** Increments per goals load and save, so an older load can't overwrite newer goals. */
let _goalsRequestId = 0;

/** Makes optimistic ids unique even for two adds in the same millisecond. */
let _tempSeq = 0;
/** Adds, edits and deletes still waiting for the server. */
let _pendingWrites = 0;
/** Bumped when a write starts, so a day load that began earlier knows it may be missing it. */
let _writeSeq = 0;
/** A day load that landed while writes were pending; it runs again once they finish. */
let _reloadAfterWrites: { userId: string; date: string } | null = null;

function isTempId(id: string) {
  return id.startsWith('temp-');
}

function beginWrite() {
  _pendingWrites++;
  _writeSeq++;
}

function endWrite(get: () => FoodLogState) {
  _pendingWrites = Math.max(0, _pendingWrites - 1);
  if (_pendingWrites > 0 || !_reloadAfterWrites) return;
  const { userId, date } = _reloadAfterWrites;
  _reloadAfterWrites = null;
  if (loadedEntriesKey === `${userId}:${date}`) get().fetchDayEntries(userId, date);
}

/** A failed save is shown, not swallowed: otherwise the food just disappears from the diary. */
function alertWriteFailed(action: string) {
  Alert.alert(`Couldn't ${action}`, 'Check your connection and try again.');
}

/** Numeric columns as numbers (Postgres numeric arrives as strings). */
function normalizeEntry(d: any): FoodEntry {
  return {
    ...d,
    calories: Number(d.calories || 0),
    protein: Number(d.protein || 0),
    carbs: Number(d.carbs || 0),
    fat: Number(d.fat || 0),
    quantity: Number(d.quantity || 1),
    is_planned: Boolean(d.is_planned),
  };
}

/** Puts entries back after a failed delete, in time order, unless they're already there. */
function restoreEntries(current: FoodEntry[], removed: FoodEntry[]): FoodEntry[] {
  const ids = new Set(current.map((e) => e.id));
  const back = removed.filter((e) => !ids.has(e.id));
  if (back.length === 0) return current;
  return [...current, ...back].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const useFoodLogStore = create<FoodLogState>((set, get) => ({
  selectedDate: toLocalDateString(),
  entries: [],
  mealConfigs: DEFAULT_MEALS,
  goals: DEFAULT_GOALS,
  goalsLoaded: false,
  loading: false,
  loadError: false,
  catalogResults: [],
  catalogLoading: false,
  recentFoods: [],
  popularFoods: [],

  setDate: (date: string) => {
    set({ selectedDate: date });
  },

  goToday: () => {
    set({ selectedDate: toLocalDateString() });
  },

  fetchDayEntries: async (userId: string, date?: string) => {
    const dateStr = date || get().selectedDate;
    const requestId = ++dayRequestId;
    const writeSeq = _writeSeq;
    // Switching to another day (or account): drop the old entries so totals never show the wrong day.
    const key = `${userId}:${dateStr}`;
    if (key !== loadedEntriesKey) {
      loadedEntriesKey = key;
      set({ entries: [], loading: true, loadError: false });
    } else {
      set({ loading: true });
    }

    const { start, end } = dateRange(dateStr);
    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true });

    // A newer request (e.g. the user tapped another day) has started: ignore this response.
    if (requestId !== dayRequestId) return;

    if (error || !data) {
      set({ loading: false, loadError: true });
      return;
    }

    // An add, edit or delete started while this loaded, so the result may not include it, and
    // replacing the list would wipe it from the screen. Load again once the writes are done.
    if (_pendingWrites > 0) {
      _reloadAfterWrites = { userId, date: dateStr };
      return;
    }
    if (writeSeq !== _writeSeq) {
      get().fetchDayEntries(userId, dateStr);
      return;
    }

    set({ entries: data.map(normalizeEntry), loading: false, loadError: false });
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
    const requestId = ++_goalsRequestId;
    const { data } = await supabase
      .from('nutrition_goals')
      .select('calorie_goal, protein_goal, carbs_goal, fat_goal')
      .eq('user_id', userId)
      .maybeSingle();
    // A newer load, a save or a sign-out happened meanwhile: this answer may be out of date.
    if (requestId !== _goalsRequestId) return;
    if (!data) return;

    const goals: NutritionGoals = {
      calorie_goal: Number(data.calorie_goal),
      protein_goal: Number(data.protein_goal),
      carbs_goal: Number(data.carbs_goal),
      fat_goal: Number(data.fat_goal),
    };
    set({ goals, goalsLoaded: true });
    // Home reads its own copy of the goals: keep both the same.
    useNutritionStore.setState({
      calorieGoal: goals.calorie_goal,
      proteinGoal: goals.protein_goal,
      carbsGoal: goals.carbs_goal,
      fatGoal: goals.fat_goal,
    });
  },

  addEntry: async (userId: string, entry, targetDate?: string, targetHour?: number) => {
    const tempId = `temp-${Date.now()}-${++_tempSeq}`;
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
      ...microsFrom(entry),
    };
    if (targetDate) {
      insertData.created_at = createdAt;
    }

    // Save to user_created_foods if this is a custom food with a name
    const foodName = (entry.name || '').trim();
    if (foodName && !entry.food_catalog_id) {
      saveUserCreatedFood(userId, entry);
    }

    beginWrite();
    let saved: FoodEntry | null = null;
    try {
      const { data, error } = await supabase
        .from('food_entries')
        .insert(insertData)
        .select()
        .single();
      if (!error && data) saved = normalizeEntry(data);
    } catch {
      // handled below
    }
    if (saved) {
      const row = saved;
      set((s) => ({ entries: s.entries.map((e) => (e.id === tempId ? row : e)) }));
      syncNutrition(userId);
    } else {
      set((s) => ({ entries: s.entries.filter((e) => e.id !== tempId) }));
      alertWriteFailed('save that food');
    }
    endWrite(get);
  },

  updateEntry: async (entryId: string, updates) => {
    // Not saved yet (it still has its temporary id): there's no row to update.
    if (isTempId(entryId)) return;
    const before = get().entries.find((e) => e.id === entryId);
    // Optimistic update
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, ...updates } : e,
      ),
    }));

    beginWrite();
    const { error } = await supabase
      .from('food_entries')
      .update(updates)
      .eq('id', entryId);

    if (error) {
      // Undo only this entry's change, keeping anything else that happened meanwhile.
      if (before) {
        const restore: Partial<FoodEntry> = {};
        for (const k of Object.keys(updates) as (keyof FoodEntry)[]) (restore as any)[k] = before[k];
        set((s) => ({ entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...restore } : e)) }));
      }
      alertWriteFailed('update that food');
    } else if (before) {
      syncNutrition(before.user_id);
    }
    endWrite(get);
  },

  deleteEntry: async (entryId: string) => {
    if (isTempId(entryId)) return;
    const removed = get().entries.find((e) => e.id === entryId);
    const dayKey = loadedEntriesKey;
    // Optimistic delete
    set((s) => ({ entries: s.entries.filter((e) => e.id !== entryId) }));

    beginWrite();
    const { error } = await supabase
      .from('food_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      // Put it back only if the same day is still showing.
      if (removed && loadedEntriesKey === dayKey) {
        set((s) => ({ entries: restoreEntries(s.entries, [removed]) }));
      }
      alertWriteFailed('delete that food');
    } else if (removed) {
      syncNutrition(removed.user_id);
    }
    endWrite(get);
  },

  togglePlanned: async (entryId: string) => {
    if (isTempId(entryId)) return;
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;

    const newPlanned = !entry.is_planned;
    // Optimistic update
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, is_planned: newPlanned } : e,
      ),
    }));

    beginWrite();
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
      alertWriteFailed('update that food');
    } else {
      // Home counts only eaten food, so it changes when an entry is marked eaten or planned.
      syncNutrition(entry.user_id);
    }
    endWrite(get);
  },

  updateGoals: async (userId: string, goals: Partial<NutritionGoals>) => {
    // A load that started before this save would bring back the old value.
    _goalsRequestId++;
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

    // Upsert, not update: an account without a goals row (some older accounts) would
    // otherwise "save" nothing, with no error, and lose the change on the next load.
    // Only the changed columns are sent, so the other goals on the account are kept.
    const { error } = await supabase
      .from('nutrition_goals')
      .upsert({ user_id: userId, ...goals, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) {
      // Undo only the fields this call changed.
      const restore: Partial<NutritionGoals> = {};
      for (const k of Object.keys(goals) as (keyof NutritionGoals)[]) restore[k] = prev[k];
      set((s) => ({ goals: { ...s.goals, ...restore } }));
      useNutritionStore.setState({
        ...(restore.calorie_goal != null && { calorieGoal: restore.calorie_goal }),
        ...(restore.protein_goal != null && { proteinGoal: restore.protein_goal }),
        ...(restore.carbs_goal != null && { carbsGoal: restore.carbs_goal }),
        ...(restore.fat_goal != null && { fatGoal: restore.fat_goal }),
      });
      return { error: error.message };
    }
    set({ goalsLoaded: true });
    return { error: null };
  },

  deleteMealGroup: async (mealGroupId: string) => {
    const removed = get().entries.filter((e) => e.meal_group_id === mealGroupId);
    const dayKey = loadedEntriesKey;
    // Optimistic delete all entries in this meal group
    set((s) => ({ entries: s.entries.filter((e) => e.meal_group_id !== mealGroupId) }));

    beginWrite();
    const { error } = await supabase
      .from('food_entries')
      .delete()
      .eq('meal_group_id', mealGroupId);

    if (error) {
      if (loadedEntriesKey === dayKey) {
        set((s) => ({ entries: restoreEntries(s.entries, removed) }));
      }
      alertWriteFailed('delete that meal');
    } else if (removed[0]) {
      syncNutrition(removed[0].user_id);
    }
    endWrite(get);
  },

  searchCatalog: async (rawQuery: string) => {
    const req = ++_searchSeq;
    // iOS autocorrect often adds a trailing space, which would stop "oats " matching "oats".
    const query = rawQuery.trim();
    if (query.length < 2) {
      set({ catalogResults: [], catalogLoading: false });
      return;
    }

    set({ catalogLoading: true });

    // "Your foods" means this account's own entries: filter here rather than relying only on RLS.
    const userId = getCurrentUserId();
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
      userId
        ? supabase
          .from('food_entries')
          .select('*')
          .eq('user_id', userId)
          .ilike('name', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (req !== _searchSeq) return; // a newer search (or a clear) has started since

    if (__DEV__ && catalogRes.error) console.warn('food_catalog search error:', catalogRes.error.message);
    if (__DEV__ && userRes.error) console.warn('user_created_foods search error:', userRes.error.message);
    if (__DEV__ && entryRes.error) console.warn('food_entries search error:', entryRes.error.message);

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
        ...microsFrom(d),
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
        ...microsFrom(d, qty),
      });
    }

    set({ catalogResults: [...catalogItems, ...userItems, ...entryItems], catalogLoading: false });
  },

  clearSearch: () => {
    _searchSeq++;
    set({ catalogResults: [], catalogLoading: false });
  },

  fetchDefaultFoods: async (userId: string) => {
    const [recentRes, popularRes] = await Promise.all([
      supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
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
          ...microsFrom(d, qty),
        });
        if (recentFoods.length >= 25) break;
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

  resetForSignOut: () => {
    dayRequestId++;
    loadedEntriesKey = null;
    _reloadAfterWrites = null;
    _goalsRequestId++;
    _searchSeq++;
    set({
      selectedDate: toLocalDateString(),
      entries: [],
      mealConfigs: DEFAULT_MEALS,
      goals: DEFAULT_GOALS,
      goalsLoaded: false,
      loading: false,
      loadError: false,
      catalogResults: [],
      catalogLoading: false,
      recentFoods: [],
      popularFoods: [],
    });
  },
}));
