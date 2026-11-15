/* Shared shapes for the food detail screen (kept here so other files can import them cheaply). */

/* ─── Types ────────────────────────────────────────────── */

/** A food as the detail screen opens it: per-serving values for one base serving. */
export interface FoodDetailData {
  name: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  serving_size: number;
  serving_unit: string;
  confidence?: string;
  barcode?: string;
  serving_size_estimated?: boolean;
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

/** Data returned by onAddToMeal — per-serving macros + quantity */
export interface MealItemData {
  name: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  serving_size: number;
  serving_unit: string;
  quantity: number;
}

/* ─── Static data ──────────────────────────────────────── */

export const MICROS: { key: string; label: string; unit: string }[] = [
  { key: 'caffeine', label: 'Caffeine', unit: 'mg' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'calcium', label: 'Calcium', unit: 'mg' },
  { key: 'iron', label: 'Iron', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'vitamin_a', label: 'Vitamin A', unit: 'mcg' },
  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg' },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'mcg' },
  { key: 'vitamin_e', label: 'Vitamin E', unit: 'mg' },
  { key: 'vitamin_k', label: 'Vitamin K', unit: 'mcg' },
  { key: 'vitamin_b6', label: 'Vitamin B6', unit: 'mg' },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'mcg' },
  { key: 'folate', label: 'Folate', unit: 'mcg' },
];

