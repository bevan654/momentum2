import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore, type ThemeMode, type AccentColor } from '../stores/useThemeStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useSupplementStore } from '../stores/useSupplementStore';

const PROFILE_CACHE_KEY = 'momentum_profile_cache';
const THEME_KEYS = ['theme_settings_v5', 'theme_settings_v4', 'theme_settings_v3'] as const;
const NUTRITION_CACHE_KEY = '@momentum_nutrition_cache';
const SUPPLEMENT_CACHE_KEY = '@momentum_supplement_totals';

/**
 * Single-batch AsyncStorage read that hydrates critical stores before any
 * network calls. One multiGet bridge call replaces many sequential getItem calls.
 */
export async function bootstrapFromCache(): Promise<void> {
  try {
    const pairs = await AsyncStorage.multiGet([
      PROFILE_CACHE_KEY,
      ...THEME_KEYS,
      NUTRITION_CACHE_KEY,
      SUPPLEMENT_CACHE_KEY,
    ]);
    const map = new Map(pairs);

    // Today's date for cache freshness checks
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Hydrate cached profile → auth store
    const profileRaw = map.get(PROFILE_CACHE_KEY);
    if (profileRaw) {
      try {
        const profile = JSON.parse(profileRaw);
        useAuthStore.setState({ profile, initialized: true });
      } catch {}
    }

    // Hydrate theme — use first found key (v5 > v4 > v3)
    let themeRaw: string | null | undefined = null;
    for (const key of THEME_KEYS) {
      themeRaw = map.get(key);
      if (themeRaw) break;
    }
    if (themeRaw) {
      try {
        const data = JSON.parse(themeRaw);
        const savedMode = data.mode || 'dark';
        const mode: ThemeMode = (savedMode === 'light' || savedMode === 'dark') ? savedMode : 'dark';
        const accent: AccentColor = typeof data.accent === 'string' ? data.accent : null;
        useThemeStore.setState({ mode, accent, initialized: true });
      } catch {}
    } else {
      // No saved theme — mark as initialized with defaults
      useThemeStore.setState({ initialized: true });
    }

    // Hydrate nutrition cache (today only)
    const nutritionRaw = map.get(NUTRITION_CACHE_KEY);
    if (nutritionRaw) {
      try {
        const cached = JSON.parse(nutritionRaw);
        if (cached.date === today) {
          useNutritionStore.setState({
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
      } catch {}
    }

    // Hydrate supplement totals cache (today only)
    const supplementRaw = map.get(SUPPLEMENT_CACHE_KEY);
    if (supplementRaw) {
      try {
        const cached = JSON.parse(supplementRaw);
        if (cached.date === today) {
          useSupplementStore.setState({
            water: cached.water,
            waterGoal: cached.waterGoal,
            supplementTotals: cached.totals || {},
          });
        }
      } catch {}
    }
  } catch {
    // multiGet failed — stores will initialize via their own fallback paths
  }
}
