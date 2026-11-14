import { Alert } from 'react-native';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';

/** The store ignores starts and discards while Finish is saving, so say so instead of doing nothing. */
function alertStillSaving(): void {
  Alert.alert('Still saving your workout', 'Try again in a moment.');
}

/**
 * Runs `start` (which starts a new workout) straight away when no workout is in progress.
 * Otherwise it asks first; Replace discards the workout in progress, then runs `start`.
 * While the workout in progress is being saved (Finish), it does neither and says so.
 */
export function confirmReplaceWorkout(start: () => void): void {
  const store = useActiveWorkoutStore.getState();
  if (store.isSaving()) {
    alertStillSaving();
    return;
  }
  if (!store.isActive) {
    start();
    return;
  }
  // A workout reopened with Undo is already saved; discarding it deletes that saved copy.
  const message = store.saveMode === 'replace'
    ? 'This workout is already saved — replacing it deletes it from your history.'
    : 'Your workout in progress will be discarded.';
  Alert.alert('Replace current workout?', message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Replace',
      style: 'destructive',
      onPress: () => {
        const current = useActiveWorkoutStore.getState();
        if (current.isSaving()) {
          alertStillSaving();
          return;
        }
        current.discardWorkout();
        start();
      },
    },
  ]);
}
