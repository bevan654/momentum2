import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw } from '../../../theme/responsive';
import RingsHero from './RingsHero';
import WeekBalance from './WeekBalance';
import StreakWeek from './StreakWeek';
import { useTodayGlance } from './useTodayGlance';

interface Props {
  onTraining: () => void;
}

/**
 * Home, no cards: Today (macro rings + weight, swipe for water / supplements), This week (body +
 * muscle-group rings), the weekly streak. Start workout and the Ask Claude chat
 * button are pinned above the tab bar by HomeScreen.
 */
function TodayHomeLayout({ onTraining }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { nutrition, water, waterGoal } = useTodayGlance();


  return (
    <View style={s.wrap}>
      <View style={s.block}>
        <RingsHero nutrition={nutrition} water={water} waterGoal={waterGoal} onOpenWeight={onTraining} />
        <WeekBalance onOpen={onTraining} />
        <StreakWeek />
      </View>

    </View>
  );
}

export default React.memo(TodayHomeLayout);

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    // Fill the screen and share the spare height between the sections (minimum gaps on small phones).
    wrap: { flex: 1, paddingTop: sw(4) },
    block: { flex: 1, justifyContent: 'space-between', paddingBottom: sw(4) },
  });
