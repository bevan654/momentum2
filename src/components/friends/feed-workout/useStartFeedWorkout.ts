import { useCallback } from 'react';
import { useActiveWorkoutStore } from '../../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';
import { confirmReplaceWorkout } from '../../../utils/confirmReplaceWorkout';
import { postedExerciseType, targetKg } from './feedWorkoutHelpers';

/** One exercise to race against: its sets as the target, and how many sets to start with. */
export interface FeedTargetExercise {
  name: string;
  sets: { kg: number; reps: number }[];
  setCount: number;
  /** The type the post gave this exercise, if any (else the catalog's). */
  postedType: string | null | undefined;
}

/**
 * Start a workout from a feed post ("Try workout" / "Beat this"), with the target's sets as the
 * ghost to beat. Returns start(routineId, targetName, exercises).
 */
export function useStartFeedWorkout(onDismiss: () => void) {
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);

  return useCallback((routineId: string, targetName: string, exercises: FeedTargetExercise[]) => {
    const ghostPrevMap: Record<string, { kg: number; reps: number }[]> = {};
    for (const ex of exercises) {
      if (ex.sets.length > 0) ghostPrevMap[ex.name] = ex.sets.map((s) => ({ kg: targetKg(s.kg), reps: s.reps }));
    }
    const routine = {
      id: routineId,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        default_sets: ex.setCount,
        exercise_type: postedExerciseType(ex.name, ex.postedType, catalogMap),
      })),
    };
    // Close this sheet first and start the workout once its close animation has
    // played, so the workout sheet doesn't open underneath it.
    confirmReplaceWorkout(() => {
      onDismiss();
      setTimeout(() => startFromRoutine(routine, catalogMap, ghostPrevMap, targetName), 350);
    });
  }, [startFromRoutine, catalogMap, onDismiss]);
}
