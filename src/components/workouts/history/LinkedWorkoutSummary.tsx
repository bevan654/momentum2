import React, { useCallback, useEffect, useState } from 'react';
import WorkoutSummaryModal from '../../workout-sheet/WorkoutSummaryModal';
import Sheet from '../../ui/Sheet';
import { setOpenWorkoutSummary } from '../../../lib/navigationBridge';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';

/**
 * A workout's summary opened from outside the history list: the home screen Last workout widget
 * (momentum://workout/<id>, through navigation/widgetLinks.ts and navigationBridge). Mounted once by
 * TabNavigator. Shown in the app's own sheet (like the just-finished summary), so it can open over
 * other screens; a workout that isn't in the loaded history (deleted, too old) isn't opened.
 */
function LinkedWorkoutSummary() {
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const workout = useWorkoutStore((s) => (workoutId ? s.workouts.find((w) => w.id === workoutId) ?? null : null));
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);
  const close = useCallback(() => setWorkoutId(null), []);

  useEffect(() => {
    setOpenWorkoutSummary((id) => {
      if (useWorkoutStore.getState().workouts.some((w) => w.id === id)) setWorkoutId(id);
    });
    return () => setOpenWorkoutSummary(null);
  }, []);

  // The workout went away (deleted here or elsewhere): forget it, so it can't pop up later.
  useEffect(() => {
    if (workoutId && !workout) setWorkoutId(null);
  }, [workoutId, workout]);

  return (
    <Sheet visible={!!workout} onClose={close} height="92%">
      {workout && (
        <WorkoutSummaryModal
          mode="historical"
          data={workout}
          onDismiss={close}
          onDelete={async () => {
            const id = workout.id;
            close();
            await deleteWorkout(id);
          }}
          inline
        />
      )}
    </Sheet>
  );
}

export default React.memo(LinkedWorkoutSummary);
