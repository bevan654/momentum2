import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { FeedExerciseDetail } from '../../../lib/friendsDatabase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useRoutineStore } from '../../../stores/useRoutineStore';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';
import { postedExerciseType, routineSetTargets } from './feedWorkoutHelpers';

/** "Save as routine" for a friend's posted workout: saved as "<name>'s Workout" in My Routines. */
export function useSaveFeedRoutine(exercises: FeedExerciseDetail[], displayName: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);

  return useCallback(async () => {
    if (!userId) return;
    const routineExercises = exercises.map((ex, i) => ({
      name: ex.name,
      exercise_order: i + 1,
      default_sets: ex.sets_count || 3,
      default_reps: ex.best_reps || 10,
      default_rest_seconds: 90,
      ...routineSetTargets(ex),
      exercise_type: postedExerciseType(ex.name, ex.exercise_type, catalogMap),
    }));
    const { error } = await createRoutine(userId, `${displayName}'s Workout`, routineExercises);
    if (error) Alert.alert('Error', error);
    else Alert.alert('Saved', 'Routine saved to My Routines');
  }, [userId, exercises, displayName, createRoutine, catalogMap]);
}
