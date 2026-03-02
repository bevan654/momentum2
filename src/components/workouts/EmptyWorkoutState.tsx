import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

export default function EmptyWorkoutState() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="barbell-outline" size={ms(48)} color={colors.textTertiary} />
      <Text style={styles.title}>No workouts yet</Text>
      <Text style={styles.subtitle}>Tap 'Start Workout' to begin</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: sw(80),
    gap: sw(10),
  },
  title: {
    color: colors.textSecondary,
    fontSize: ms(16),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(22),
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },
});
