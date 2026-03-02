import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useStreakStore } from '../../stores/useStreakStore';
import { sw, ms } from '../../theme/responsive';

function StreakCard() {
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="flame-outline" size={ms(13)} color={colors.streak} />
        </View>
        <Text style={styles.title}>Streak</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.current}>{currentStreak}</Text>
        <Text style={styles.unit}> days</Text>
      </View>

      <Text style={styles.best}>Best: {longestStreak}d</Text>
    </View>
  );
}

export default React.memo(StreakCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(14),
    justifyContent: 'space-between',
    gap: sw(4),
    ...colors.cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    backgroundColor: colors.streak + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  current: {
    color: colors.textPrimary,
    fontSize: ms(26),
    lineHeight: ms(30),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  unit: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.regular,
  },
  best: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
});
