import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSavedMealsStore, type SavedMeal } from '../../../stores/useSavedMealsStore';

/** Asks, then deletes a saved meal from My meals (food already logged from it stays in the diary). */
export function confirmDeleteMeal(meal: Pick<SavedMeal, 'id' | 'name'>, onDeleted?: () => void) {
  Alert.alert(
    'Delete this meal?',
    `"${meal.name}" will be removed from your saved meals. Food you've already logged from it stays in your diary.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          useSavedMealsStore.getState().deleteMeal(meal.id).then(() => onDeleted?.(), () => {});
        },
      },
    ],
  );
}
