import type { FoodEntry } from '../../stores/useFoodLogStore';

/** Micronutrient keys that exist as columns on FoodEntry. */
const ENTRY_MICRO_KEYS = new Set([
  'caffeine', 'sodium', 'fiber', 'sugar', 'calcium', 'iron', 'potassium', 'magnesium', 'zinc',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b6', 'vitamin_b12', 'folate',
]);

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Eaten totals for a day, rounded. Planned entries don't count until they're eaten. */
export function sumMacros(entries: FoodEntry[]): MacroTotals {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const e of entries) {
    if (e.is_planned) continue;
    calories += e.calories;
    protein += e.protein;
    carbs += e.carbs;
    fat += e.fat;
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

/** Eaten micronutrient totals for the given keys (planned entries excluded). */
export function sumMicros(entries: FoodEntry[], keys: string[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const e of entries) {
    if (e.is_planned) continue;
    for (const key of keys) {
      if (!ENTRY_MICRO_KEYS.has(key)) continue;
      const val = (e as unknown as Record<string, unknown>)[key];
      if (val != null) sums[key] = (sums[key] || 0) + Number(val);
    }
  }
  return sums;
}

export function formatMicroValue(value: number, unit: string): string {
  if (unit === 'mcg' || unit === 'mg') {
    return value % 1 === 0 ? String(value) : value.toFixed(1);
  }
  return String(Math.round(value));
}
