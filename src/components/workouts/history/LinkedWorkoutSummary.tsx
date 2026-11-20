import React, { useEffect, useState } from 'react';
import WorkoutSummaryModal from '../../workout-sheet/WorkoutSummaryModal';
import { setOpenWorkoutSummary } from '../../../lib/navigationBridge';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';

/**
 * A workout's summary opened from outside the history list: the home screen Last workout widget
 * (momentum://workout/<id>, through navigation/widgetLinks.ts and navigationBridge). Mounted once by
 * TabNavigator. Shows nothing when the workout isn't in the loaded history (deleted, or too old).
 */
function LinkedWorkoutSummary() {
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const workout = useWorkoutStore((s) => (workoutId ? s.workouts.find((w) => w.id === workoutId) ?? null : null));
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);

  useEffect(() => {
    setOpenWorkoutSummary(setWorkoutId);
    return () => setOpenWorkoutSummary(null);
  }, []);

  if (!workout) return null;
  return (
    <WorkoutSummaryModal
      mode="historical"
      data={workout}
      onDismiss={() => setWorkoutId(null)}
      onDelete={async () => {
        const id = workout.id;
        setWorkoutId(null);
        await deleteWorkout(id);
      }}
    />
  );
}

export default React.memo(LinkedWorkoutSummary);
