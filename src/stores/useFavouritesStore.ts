import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  addFavourite: (food: FoodCatalogItem) => void;
  removeFavourite: (food: { food_catalog_id?: string | null; name: string }) => void;
  isFavourite: (food: { food_catalog_id?: string | null; name: string }) => boolean;
}

export const useFavouritesStore = create<FavouritesState>((set, get) => ({
  favourites: [],
  loaded: false,

  loadFavourites: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ favourites: JSON.parse(raw), loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  addFavourite: (food: FoodCatalogItem) => {
    const { favourites } = get();
    const key = foodKey(food);
    if (favourites.some((f) => foodKey(f) === key)) return;
    const updated = [food, ...favourites];
    set({ favourites: updated });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  removeFavourite: (food) => {
    const { favourites } = get();
    const key = foodKey(food);
    const updated = favourites.filter((f) => foodKey(f) !== key);
    set({ favourites: updated });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
  },

  isFavourite: (food) => {
    const key = foodKey(food);
    return get().favourites.some((f) => foodKey(f) === key);
  },
}));
