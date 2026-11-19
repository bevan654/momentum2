import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import { useFoodLogStore, type FoodEntry } from '../../../stores/useFoodLogStore';
import { useNutritionStore } from '../../../stores/useNutritionStore';
import type { MealItem } from '../../../stores/useSavedMealsStore';
import { buildMealEntryRows, generateGroupId } from './mealItems';

interface Options {
  userId: string | undefined;
  mealSlot: string;
  targetHour?: number;
  /** Editing a logged meal: its group id and entries (replaced by the new rows). */
  editMealGroupId?: string | null;
  editMealGroupEntries?: FoodEntry[] | null;
  onLogged: () => void;
}

/**
 * Logs the meal into the diary as one batch of `food_entries` rows sharing a meal group, or
 * replaces a logged meal's rows when editing one. Returns the handler; a second tap while a
 * save is running is ignored, so a meal is never logged twice.
 */
export function useLogMeal({ userId, mealSlot, targetHour, editMealGroupId, editMealGroupEntries, onLogged }: Options) {
  const loggingRef = useRef(false);

  return useCallback(async (items: MealItem[], mealName: string) => {
    if (!userId || loggingRef.current) return;
    if (items.length === 0) {
      Alert.alert('No Items', 'Add at least one food item to log.');
      return;
    }
    loggingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { selectedDate, fetchDayEntries } = useFoodLogStore.getState();

      // When editing a logged group, keep what the editor doesn't show (catalog link, planned
      // flag, exact time) from the original entries.
      const originals = new Map((editMealGroupId && editMealGroupEntries ? editMealGroupEntries : [])
        .map((e) => [`item-${e.id}`, e]));
      const firstOriginal = editMealGroupId ? editMealGroupEntries?.[0] : undefined;

      let createdAt: string;
      if (firstOriginal?.created_at) {
        createdAt = firstOriginal.created_at;
      } else if (selectedDate && targetHour != null) {
        createdAt = new Date(selectedDate + `T${String(targetHour).padStart(2, '0')}:00:00`).toISOString();
      } else if (selectedDate) {
        createdAt = new Date(selectedDate + 'T12:00:00').toISOString();
      } else {
        createdAt = new Date().toISOString();
      }

      const rows = buildMealEntryRows(items, {
        userId,
        mealSlot,
        groupId: editMealGroupId || generateGroupId(),
        groupName: mealName.trim() || 'Meal',
        createdAt,
        isPlanned: firstOriginal?.is_planned ?? false,
        originals,
      });

      // Insert the new rows first, then remove the old ones, so a failure never loses the meal.
      const { data: inserted, error } = await supabase.from('food_entries').insert(rows).select('id');
      if (error) {
        if (__DEV__) console.error('[CreateMeal] Supabase insert error:', error);
        Alert.alert('Log Failed', error.message);
        return;
      }

      if (editMealGroupId && originals.size > 0) {
        const oldIds = [...originals.values()].map((e) => e.id);
        const { error: delErr } = await supabase.from('food_entries').delete().in('id', oldIds);
        if (delErr) {
          // Undo the insert so the meal isn't duplicated.
          const newIds = (inserted || []).map((r: { id: string }) => r.id);
          if (newIds.length) await supabase.from('food_entries').delete().in('id', newIds);
          if (__DEV__) console.error('[CreateMeal] Delete old group error:', delErr);
          Alert.alert('Update Failed', delErr.message);
          return;
        }
      }

      // Its foods stay in Recent / "Your foods" even if the meal is deleted from the diary later.
      useFoodLogStore.getState().rememberLoggedFoods(userId, rows);
      await fetchDayEntries(userId, selectedDate);
      useNutritionStore.getState().fetchTodayNutrition(userId);
      onLogged();
    } finally {
      loggingRef.current = false;
    }
  }, [userId, mealSlot, targetHour, editMealGroupId, editMealGroupEntries, onLogged]);
}
