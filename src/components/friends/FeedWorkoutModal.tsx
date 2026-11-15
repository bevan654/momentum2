import React, { useRef } from 'react';
import type { ActivityFeedItem } from '../../lib/friendsDatabase';
import Sheet from '../ui/Sheet';
import { WorkoutContent } from './feed-workout/WorkoutContent';
import { GhostContent } from './feed-workout/GhostContent';

interface Props {
  item: ActivityFeedItem | null;
  onDismiss: () => void;
}

/* ── Thin wrapper — always mounted, toggles Sheet visibility ── */

export default function FeedWorkoutModal({ item, onDismiss }: Props) {
  const visible = !!item;
  // Keep showing the last item while the sheet animates closed.
  const lastItem = useRef(item);
  if (item) lastItem.current = item;
  const shown = item ?? lastItem.current;
  const isGhost = !!(shown?.ghost_username && shown?.ghost_result && shown?.ghost_exercises);

  return (
    <Sheet visible={visible} onClose={onDismiss} height="92%">
      {shown && (
        isGhost
          ? <GhostContent item={shown} onDismiss={onDismiss} />
          : <WorkoutContent item={shown} onDismiss={onDismiss} />
      )}
    </Sheet>
  );
}
