import type { FoodCatalogItem } from '../../stores/useFoodLogStore';
import type { SavedMeal } from '../../stores/useSavedMealsStore';
import type { FoodDetailData } from './FoodDetailModal';

const MICRO_KEYS = [
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k', 'vitamin_b6', 'vitamin_b12',
  'folate', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'sodium',
] as const;

type Row = Record<string, unknown>;

const numOr = (v: unknown, fallback: number) => (v != null && Number.isFinite(Number(v)) ? Number(v) : fallback);
const numOrNull = (v: unknown) => (v != null ? Number(v) : null);

/** An ai_food_cache row or an AI search item → a picker item marked as an AI estimate. */
export function mapAiRow(row: Row, i: number): FoodCatalogItem {
  const item: FoodCatalogItem = {
    id: (row.id as string) ?? `ai-${Date.now()}-${i}`,
    name: String(row.name ?? ''),
    brand: (row.brand as string) || null,
    calories: numOr(row.calories, 0),
    protein: numOr(row.protein, 0),
    carbs: numOr(row.carbs, 0),
    fat: numOr(row.fat, 0),
    fiber: numOrNull(row.fiber),
    sugar: numOrNull(row.sugar),
    serving_size: Number(row.serving_size) || 100,
    serving_unit: (row.serving_unit as string) || 'g',
    confidence: 'ai_estimated',
    food_catalog_id: null,
  };
  for (const k of MICRO_KEYS) (item as unknown as Row)[k] = (row[k] as number | null) ?? null;
  return item;
}

/** AI search items → rows for the shared ai_food_cache table (same shape as before). */
export function aiItemsToCacheRows(items: Row[], searchQuery: string, fallbackName: string): Row[] {
  return items.map((item) => {
    const row: Row = {
      search_query: searchQuery,
      name: item.name || fallbackName,
      brand: item.brand || null,
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      fiber: item.fiber ?? null,
      sugar: item.sugar ?? null,
      serving_size: item.serving_size ?? 100,
      serving_unit: item.serving_unit ?? 'g',
    };
    for (const k of MICRO_KEYS) row[k] = item[k] ?? null;
    return row;
  });
}

/** A picker item → the data the food detail screen opens with. */
export function catalogToDetail(item: FoodCatalogItem): FoodDetailData {
  const data: FoodDetailData = {
    name: item.name,
    brand: item.brand,
    food_catalog_id: item.food_catalog_id || null,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber,
    sugar: item.sugar,
    serving_size: item.serving_size,
    serving_unit: item.serving_unit,
    confidence: item.confidence,
    caffeine: item.caffeine,
  };
  for (const k of MICRO_KEYS) (data as unknown as Row)[k] = item[k];
  return data;
}

/** "Brand · 100 g" line for a picker row. */
export function foodSubtitle(item: Pick<FoodCatalogItem, 'brand' | 'serving_size' | 'serving_unit'>): string {
  const serving = item.serving_size ? `${Math.round(item.serving_size * 10) / 10} ${item.serving_unit}` : '';
  return [item.brand, serving].filter(Boolean).join(' · ');
}

/** Totals for a saved meal (items store per-serving values plus a quantity). */
export function savedMealTotals(meal: SavedMeal) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const i of meal.items) {
    calories += i.calories * i.quantity;
    protein += i.protein * i.quantity;
    carbs += i.carbs * i.quantity;
    fat += i.fat * i.quantity;
  }
  return { calories, protein, carbs, fat };
}

/** Strip characters that break a PostgREST `.or()` filter (commas, brackets, double quotes, wildcards). Apostrophes are fine ("mcdonald's"). */
export function sanitizeForOrFilter(text: string): string {
  return text.replace(/[,()"\\%*]/g, ' ').replace(/\s+/g, ' ').trim();
}
