import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import WorkoutSummaryModal from './WorkoutSummaryModal';

export default function WorkoutFinishScreen() {
  const showSummary = useActiveWorkoutStore((s) => s.showSummary);
  const summaryData = useActiveWorkoutStore((s) => s.summaryData);
  const dismissSummary = useActiveWorkoutStore((s) => s.dismissSummary);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const isGhost = showSummary && summaryData &&
    'ghostUserName' in summaryData && !!summaryData.ghostUserName;

  if (!showSummary || !summaryData || isGhost) return null;

  // Tab bar height: paddingTop sw(8) + icon ~24 + label ~12 + paddingBottom (insets.bottom)
  const tabBarHeight = sw(8) + ms(24) + ms(12) + insets.bottom + sw(8);

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: tabBarHeight,
      backgroundColor: colors.background,
    }}>
      <WorkoutSummaryModal
        mode="just-completed"
        data={summaryData}
        onDismiss={dismissSummary}
        inline
      />
    </View>
  );
}
