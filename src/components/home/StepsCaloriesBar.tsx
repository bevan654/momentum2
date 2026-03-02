import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

export default function StepsCaloriesBar() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <Text style={styles.icon}>👣</Text>
        <Text style={styles.label}>Steps</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <Text style={styles.icon}>🔥</Text>
        <Text style={styles.label}>Cal Burned</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Coming Soon</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: sw(14),
    gap: sw(16),
    opacity: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    marginRight: sw(4),
  },
  label: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  divider: {
    width: 1,
    height: sw(16),
    backgroundColor: colors.cardBorder,
  },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
  },
  badgeText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
  },
});
