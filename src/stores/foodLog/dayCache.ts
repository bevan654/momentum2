import { toLocalDateString } from '../../utils/localDate';
import type { FoodEntry } from '../useFoodLogStore';

/**
 * Days already seen this session (`userId:date` → entries), so going back to one shows it at
 * once while it reloads, instead of an empty diary. Only the most recent few are kept.
 */
const cache = new Map<string, FoodEntry[]>();
const CACHE_SIZE = 14;

export function cachedDay(key: string): FoodEntry[] | undefined {
  return cache.get(key);
}

/**
 * Keeps a day's loaded entries for later. A day with an add, edit or delete still on its way
 * isn't kept: its result would land after the switch and never reach the copy (a failed add
 * would come back as a phantom row).
 */
export function rememberDay(key: string, entries: FoodEntry[], writesPending: boolean) {
  cache.delete(key);
  if (writesPending || entries.some((e) => e.id.startsWith('temp-'))) return;
  cache.set(key, entries);
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** A write to a day that isn't on screen: its kept copy is now out of date. */
export function forgetDay(userId: string, createdAt: string) {
  cache.delete(`${userId}:${toLocalDateString(new Date(createdAt))}`);
}

export function clearDayCache() {
  cache.clear();
}

/** Keeps the previous object for each row that didn't change, so unchanged rows don't re-render. */
export function reuseRows(prev: FoodEntry[], next: FoodEntry[]): FoodEntry[] {
  if (prev.length === 0) return next;
  const byId = new Map(prev.map((e) => [e.id, e]));
  return next.map((e) => {
    const old = byId.get(e.id);
    if (!old) return e;
    const keys = Object.keys(e) as (keyof FoodEntry)[];
    if (keys.length !== Object.keys(old).length) return e;
    return keys.every((k) => old[k] === e[k]) ? old : e;
  });
}
