import type { FoodEntry, MealConfig } from '../../stores/useFoodLogStore';
import { sumMacros, type MacroTotals } from './dayTotals';

type MealItem =
  | { type: 'entry'; entry: FoodEntry }
  | { type: 'group'; groupId: string; groupName: string; entries: FoodEntry[] };

export interface MealBucket {
  /** The meal_type entries are saved with (or OTHER_SLOT for unmatched ones). */
  slot: string;
  label: string;
  icon: string;
  /** "HH:MM" the meal usually starts; used to time food logged into it on other days. */
  timeStart: string;
  items: MealItem[];
  /** Eaten totals (planned entries excluded, matching the day summary). */
  totals: MacroTotals;
  /** True if any entry in the meal is still planned. */
  hasPlanned: boolean;
}

/** Bucket for entries whose meal_type matches no enabled meal (old data, a disabled meal). */
export const OTHER_SLOT = '__other';

/**
 * Splits a day's entries into one bucket per enabled meal (in the user's order), by each
 * entry's saved meal_type. Logged meals (meal_group_id) stay together as one item.
 * Unmatched entries go in an "Other" bucket that only appears when it has something.
 */
export function groupEntriesByMeal(entries: FoodEntry[], configs: MealConfig[]): MealBucket[] {
  const meals = configs
    .filter((c) => c.enabled)
    .sort((a, b) => a.sort_order - b.sort_order);
  const known = new Set(meals.map((m) => m.slot));

  const bySlot = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const slot = known.has(e.meal_type) ? e.meal_type : OTHER_SLOT;
    const list = bySlot.get(slot);
    if (list) list.push(e);
    else bySlot.set(slot, [e]);
  }

  const buckets: MealBucket[] = meals.map((m) =>
    makeBucket(m.slot, m.label, m.icon || 'restaurant-outline', m.time_start, bySlot.get(m.slot) || []),
  );
  const other = bySlot.get(OTHER_SLOT);
  if (other?.length) buckets.push(makeBucket(OTHER_SLOT, 'Other', 'ellipsis-horizontal-circle-outline', '12:00', other));
  return buckets;
}

function makeBucket(slot: string, label: string, icon: string, timeStart: string, entries: FoodEntry[]): MealBucket {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const items: MealItem[] = [];
  const groups = new Map<string, FoodEntry[]>();
  for (const e of sorted) {
    if (e.meal_group_id) {
      const existing = groups.get(e.meal_group_id);
      if (existing) {
        existing.push(e);
        continue;
      }
      const list = [e];
      groups.set(e.meal_group_id, list);
      items.push({ type: 'group', groupId: e.meal_group_id, groupName: e.meal_group_name || 'Meal', entries: list });
    } else {
      items.push({ type: 'entry', entry: e });
    }
  }
  return {
    slot,
    label,
    icon,
    timeStart,
    items,
    totals: sumMacros(sorted),
    hasPlanned: sorted.some((e) => e.is_planned),
  };
}

/** Hour (0–23) from a meal's "HH:MM" start time; falls back to noon. */
export function hourFromTimeStart(timeStart: string): number {
  const h = parseInt(timeStart.split(':')[0], 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 12;
}

/**
 * The meal a food logged at `hour` most likely belongs to: the enabled meal that started
 * most recently (by time_start), e.g. 13:00 → lunch with the default meals.
 */
export function mealSlotForHour(configs: MealConfig[], hour: number): string {
  const meals = configs
    .filter((c) => c.enabled)
    .map((c) => ({ slot: c.slot, start: hourFromTimeStart(c.time_start) }))
    .sort((a, b) => a.start - b.start);
  if (meals.length === 0) return 'snack';
  let pick = meals[0].slot;
  for (const m of meals) if (m.start <= hour) pick = m.slot;
  return pick;
}
