import { create } from 'zustand';
import { readUserScoped, writeUserScoped } from '../lib/userScopedStorage';
import { getCurrentUserId } from '../lib/currentUser';
import type { FoodCatalogItem } from './useFoodLogStore';

const STORAGE_KEY = '@momentum_favourites';

/** Stable key for deduplication — prefers catalog ID, falls back to lowercase name */
function foodKey(food: { food_catalog_id?: string | null; name: string }): string {
  return food.food_catalog_id || food.name.toLowerCase().trim();
}

interface FavouritesState {
  favourites: FoodCatalogItem[];
  loaded: boolean;
  loadFavourites: () => Promise<void>;
  addFavourite: (food: FoodCatalogItem) => Promise<void>;
  removeFavourite: (food: { food_catalog_id?: string | null; name: string }) => Promise<void>;
  isFavourite: (food: { food_catalog_id?: string | null; name: string }) => boolean;
  /** Clears this account's favourites from memory (they stay saved on the phone for when it signs in again). */
  resetForSignOut: () => void;
}

/** Bumped on sign-out, so a load still running for the previous account is ignored. */
let _gen = 0;
let _loading: Promise<void> | null = null;

function persist(favourites: FoodCatalogItem[]) {
  const userId = getCurrentUserId();
  if (!userId) return;
  writeUserScoped(STORAGE_KEY, userId, JSON.stringify(favourites)).catch(() => {});
}

export const useFavouritesStore = create<FavouritesState>((set, get) => ({
  favourites: [],
  loaded: false,

  loadFavourites: () => {
    if (get().loaded) return Promise.resolve();
    if (_loading) return _loading;
    const userId = getCurrentUserId();
    if (!userId) return Promise.resolve();
    const gen = _gen;
    const run = (async () => {
      let favourites: FoodCatalogItem[] = [];
      try {
        const raw = await readUserScoped(STORAGE_KEY, userId);
        if (raw) favourites = JSON.parse(raw);
      } catch { /* silent */ }
      if (gen === _gen) set({ favourites, loaded: true });
    })().finally(() => {
      if (_loading === run) _loading = null;
    });
    _loading = run;
    return run;
  },

  addFavourite: async (food: FoodCatalogItem) => {
    // Load first: writing a list that hasn't loaded yet would overwrite the stored favourites.
    const gen = _gen;
    await get().loadFavourites();
    // Signed out (or the list couldn't load) meanwhile: writing now would replace another list.
    if (gen !== _gen || !get().loaded) return;
    const { favourites } = get();
    const key = foodKey(food);
    if (favourites.some((f) => foodKey(f) === key)) return;
    const updated = [food, ...favourites];
    set({ favourites: updated });
    persist(updated);
  },

  removeFavourite: async (food) => {
    const gen = _gen;
    await get().loadFavourites();
    if (gen !== _gen || !get().loaded) return;
    const key = foodKey(food);
    const updated = get().favourites.filter((f) => foodKey(f) !== key);
    set({ favourites: updated });
    persist(updated);
  },

  isFavourite: (food) => {
    const key = foodKey(food);
    return get().favourites.some((f) => foodKey(f) === key);
  },

  resetForSignOut: () => {
    _gen++;
    _loading = null;
    set({ favourites: [], loaded: false });
  },
}));
