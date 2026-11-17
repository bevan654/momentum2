import React from 'react';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { formatClock } from '../../utils/formatDuration';

/**
 * The active workout's running clock, as text for a parent <Text>. Its own component so the 1 s tick
 * re-renders only this, not the header or banner around it.
 */
const ElapsedClock = React.memo(function ElapsedClock() {
  const elapsedSeconds = useActiveWorkoutStore((s) => s.elapsedSeconds);
  return <>{formatClock(elapsedSeconds)}</>;
});

export default ElapsedClock;
