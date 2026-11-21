import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import WeekDots from './WeekDots';
import SectionLabel from './SectionLabel';
import { useWorkoutWeek } from './useTodayData';
import { useStreakStore } from '../../../stores/useStreakStore';

/** Home streak section (no card): current and best streak, days trained, and the last 7 days with sets per day. */
function StreakWeek() {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const currentStreak = useStreakStore((st) => st.currentStreak);
  const longestStreak = useStreakStore((st) => st.longestStreak);
  const { week } = useWorkoutWeek();
  const trainedDays = week.filter((d) => d.trained).length;

  return (
    <View style={s.wrap}>
      <SectionLabel label="Streak" detail={`Best ${longestStreak}`} />
      <View style={s.header}>
        <View style={s.titleRow}>
          <Ionicons name="flame" size={ms(15)} color={colors.streak} />
          <Text style={s.title}>{currentStreak}-day streak</Text>
          <Text style={s.days}>· {trainedDays} of 7 days</Text>
        </View>
      </View>
      <WeekDots week={week} showSets />
    </View>
  );
}

export default React.memo(StreakWeek);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginTop: sw(18),
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sw(10) },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: sw(6) },
    title: { color: colors.textPrimary, fontSize: ms(14), lineHeight: ms(19), fontFamily: Fonts.bold },
    days: { color: colors.textTertiary, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium },
  });
