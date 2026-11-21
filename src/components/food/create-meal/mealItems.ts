import { MICRO_KEYS, type FoodEntry } from '../../../stores/useFoodLogStore';
import type { MealItem } from '../../../stores/useSavedMealsStore';
import type { MealItemData } from '../foodDetailTypes';

/** Name used when a meal item has none (a blank quick add), so the diary never shows an empty row. */
const UNNAMED_ITEM = 'Quick add';

const round = (v: number, factor: number) => Math.round(v * factor) / factor;

/** A local id for an item in the meal being built (only used as a list key and to edit/remove it). */
export function newItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** A random UUID v4 for `food_entries.meal_group_id`. */
export function generateGroupId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}

/** A new meal item from what the food detail screen or Quick add returns (values per serving). */
export function itemFromData(data: MealItemData): MealItem {
  return {
    id: newItemId(),
    name: data.name.trim() || UNNAMED_ITEM,
    brand: data.brand,
    food_catalog_id: data.food_catalog_id,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    fiber: data.fiber,
    sugar: data.sugar,
    micros: data.micros,
    serving_size: data.serving_size,
    serving_unit: data.serving_unit,
    quantity: data.quantity,
  };
}

/** An existing item updated from the detail screen, name and brand included. */
export function updateItemFromData(item: MealItem, data: MealItemData): MealItem {
  return { ...itemFromData(data), id: item.id, food_catalog_id: item.food_catalog_id ?? data.food_catalog_id };
}

/** A logged meal group's entries (totals) → meal items (per serving), for editing the group. */
export function entriesToMealItems(entries: FoodEntry[]): MealItem[] {
  return entries.map((e) => {
    const qty = e.quantity || 1;
    const micros: Record<string, number | null> = {};
    for (const key of MICRO_KEYS) {
      const v = e[key];
      micros[key] = v != null ? Number(v) / qty : null;
    }
    return {
      id: `item-${e.id}`,
      name: e.name,
      brand: e.brand,
      food_catalog_id: e.food_catalog_id,
      calories: e.calories / qty,
      protein: e.protein / qty,
      carbs: e.carbs / qty,
      fat: e.fat / qty,
      fiber: e.fiber != null ? e.fiber / qty : null,
      sugar: e.sugar != null ? e.sugar / qty : null,
      micros,
      serving_size: e.serving_size || 1,
      serving_unit: e.serving_unit || 'serving',
      quantity: qty,
    };
  });
}

/** Totals of the items (per serving × quantity), rounded to whole numbers for display. */
export function itemTotals(items: MealItem[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const i of items) {
    calories += i.calories * i.quantity;
    protein += i.protein * i.quantity;
    carbs += i.carbs * i.quantity;
    fat += i.fat * i.quantity;
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

interface RowContext {
  userId: string;
  mealSlot: string;
  groupId: string;
  groupName: string;
  createdAt: string;
  isPlanned: boolean;
  /** When editing a logged group: the original entry for each item id, to keep its catalog link. */
  originals: Map<string, FoodEntry>;
}

/** One `food_entries` row per item (totals = per serving × quantity), all in the same meal group. */
export function buildMealEntryRows(items: MealItem[], ctx: RowContext): Record<string, unknown>[] {
  return items.map((item) => {
    const qty = item.quantity;
    const orig = ctx.originals.get(item.id);
    const row: Record<string, unknown> = {
      user_id: ctx.userId,
      name: item.name.trim() || UNNAMED_ITEM,
      // One decimal, like single foods: whole grams per item undercounted meals of small items.
      calories: round(item.calories * qty, 10),
      protein: round(item.protein * qty, 10),
      carbs: round(item.carbs * qty, 10),
      fat: round(item.fat * qty, 10),
      meal_type: ctx.mealSlot,
      brand: item.brand || null,
      food_catalog_id: orig?.food_catalog_id ?? item.food_catalog_id ?? null,
      serving_size: Number(item.serving_size) || 1,
      serving_unit: item.serving_unit || 'serving',
      quantity: qty,
      fiber: item.fiber != null ? round(item.fiber * qty, 10) : null,
      sugar: item.sugar != null ? round(item.sugar * qty, 10) : null,
      is_planned: ctx.isPlanned,
      created_at: ctx.createdAt,
      meal_group_id: ctx.groupId,
      meal_group_name: ctx.groupName,
    };
    // Micronutrients travel with each item per serving (kept items start from their entry,
    // and the detail screen rescales them when the serving changes).
    for (const key of MICRO_KEYS) {
      const v = item.micros?.[key];
      row[key] = v != null ? round(Number(v) * qty, 100) : null;
    }
    return row;
  });
}
