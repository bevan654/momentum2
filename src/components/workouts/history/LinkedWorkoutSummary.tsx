import React, { useCallback, useEffect, useRef, useState } from 'react';
import WorkoutSummaryModal from '../../workout-sheet/WorkoutSummaryModal';
import Sheet from '../../ui/Sheet';
import { setOpenWorkoutSummary } from '../../../lib/navigationBridge';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useWorkoutStore, type WorkoutWithDetails } from '../../../stores/useWorkoutStore';

/** How long a requested workout may wait for the history to load (a cold start on a slow network). */
const WAIT_MS = 30_000;

/**
 * A workout's summary opened from outside the history list: the home screen Last workout widget
 * (momentum://workout/<id>, through navigation/widgetLinks.ts and navigationBridge). Mounted once by
 * TabNavigator. Shown in the app's own sheet (like the just-finished summary), so it can open over
 * other screens. If the history hasn't loaded yet it waits for it (up to WAIT_MS); a workout the
 * loaded history doesn't have (deleted, too old) isn't opened.
 */
function LinkedWorkoutSummary() {
  const [requested, setRequested] = useState<{ id: string; at: number } | null>(null);
  const workoutId = requested?.id ?? null;
  // Only from the signed-in account's history (after an account switch the last one's can linger).
  const workout = useWorkoutStore((s) => (workoutId && s.historyUserId === useAuthStore.getState().user?.id
    ? s.workouts.find((w) => w.id === workoutId) ?? null
    : null));
  const historyLoaded = useWorkoutStore((s) => !s.loading && !!s.historyUserId && s.historyUserId === useAuthStore.getState().user?.id);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);
  const close = useCallback(() => setRequested(null), []);
  // Kept while the sheet slides away, so it doesn't go blank as it closes.
  const shown = useRef<WorkoutWithDetails | null>(null);
  if (workout) shown.current = workout;

  useEffect(() => {
    setOpenWorkoutSummary((id) => setRequested({ id, at: Date.now() }));
    return () => setOpenWorkoutSummary(null);
  }, []);

  // Not in the loaded history (deleted here or elsewhere, too old), or waited too long: forget it,
  // so it can't pop up later.
  useEffect(() => {
    if (!requested || workout) return;
    if (historyLoaded) {
      setRequested(null);
      return;
    }
    const timer = setTimeout(() => setRequested(null), Math.max(0, requested.at + WAIT_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [requested, workout, historyLoaded]);

  const data = shown.current;
  return (
    <Sheet visible={!!workout} onClose={close} height="92%">
      {data && (
        <WorkoutSummaryModal
          mode="historical"
          data={data}
          onDismiss={close}
          onDelete={async () => {
            const id = data.id;
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
