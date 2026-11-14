import { Alert } from 'react-native';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';

/**
 * Runs `start` (which starts a new workout) straight away when no workout is in progress.
 * Otherwise it asks first; Replace discards the workout in progress, then runs `start`.
 */
export function confirmReplaceWorkout(start: () => void): void {
  if (!useActiveWorkoutStore.getState().isActive) {
    start();
    return;
  }
  Alert.alert('Replace current workout?', 'Your workout in progress will be discarded.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Replace',
      style: 'destructive',
      onPress: () => {
        useActiveWorkoutStore.getState().discardWorkout();
        start();
      },
    },
  ]);
}
