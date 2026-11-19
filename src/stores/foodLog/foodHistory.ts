import { readUserScoped, writeUserScoped } from '../../lib/userScopedStorage';
import type { FoodCatalogItem } from '../useFoodLogStore';

/**
 * Every food this account has logged on this phone (newest first, one per name), kept even
 * after its diary entry is deleted. Recent and "Your foods" are otherwise built from the diary
 * itself, so deleting a logged meal used to take all its ingredients out of both lists.
 */
export interface HistoryFood extends FoodCatalogItem {
  /** When it was last logged (ISO), to order it among the diary's own entries. */
  used_at: string;
}

const STORAGE_KEY = 'momentum_food_history';
const MAX_FOODS = 150;

let _userId: string | null = null;
let _foods: HistoryFood[] = [];
let _loading: Promise<HistoryFood[]> | null = null;

const nameKey = (name: string) => name.trim().toLowerCase();

export function loadFoodHistory(userId: string): Promise<HistoryFood[]> {
  if (_userId === userId && !_loading) return Promise.resolve(_foods);
  if (_userId === userId && _loading) return _loading;
  _userId = userId;
  _foods = [];
  const run = (async () => {
    try {
      const raw = await readUserScoped(STORAGE_KEY, userId);
      const parsed = raw ? JSON.parse(raw) : [];
      if (_userId === userId && Array.isArray(parsed)) _foods = parsed;
    } catch {
      // Unreadable: start a new history.
    }
    return _userId === userId ? _foods : [];
  })().finally(() => {
    if (_loading === run) _loading = null;
  });
  _loading = run;
  return run;
}

/** Adds foods that were just logged (moved to the top if already there) and saves the list. */
export async function rememberFoods(userId: string, foods: FoodCatalogItem[]): Promise<void> {
  const named = foods.filter((f) => f.name?.trim());
  if (named.length === 0) return;
  await loadFoodHistory(userId);
  if (_userId !== userId) return; // signed out meanwhile
  const now = new Date().toISOString();
  // Rows from a meal log have no id yet: the name makes a stable one for list keys.
  const fresh: HistoryFood[] = named.map((f) => ({ ...f, id: f.id || `history-${nameKey(f.name)}`, used_at: now }));
  const keys = new Set(fresh.map((f) => nameKey(f.name)));
  _foods = [...fresh, ..._foods.filter((f) => !keys.has(nameKey(f.name)))].slice(0, MAX_FOODS);
  writeUserScoped(STORAGE_KEY, userId, JSON.stringify(_foods)).catch(() => {});
}

/** History foods whose name contains `query` (case-insensitive), newest first. */
export function matchFoodHistory(foods: HistoryFood[], query: string, limit: number): HistoryFood[] {
  const q = query.trim().toLowerCase();
  return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, limit);
}

/** Forgets the signed-out account's list from memory (it stays saved on the phone). */
export function resetFoodHistory() {
  _userId = null;
  _foods = [];
  _loading = null;
}
