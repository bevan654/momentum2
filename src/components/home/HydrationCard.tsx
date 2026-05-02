import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useSupplementStore } from '../../stores/useSupplementStore';

function formatNumber(n: number) {
  return n.toLocaleString('en-US');
}

function HydrationCard() {
  const water = useSupplementStore((s) => s.water);
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = waterGoal > 0 ? Math.min(water / waterGoal, 1) : 0;
  const liters = (water / 1000).toFixed(1);

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Hydration</Text>
      <View style={styles.statRow}>
        <View style={styles.statLeft}>
          <Text style={styles.statValue}>{liters}<Text style={styles.unit}> L</Text></Text>
          <Text style={styles.statLabel}>WATER</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

export default React.memo(HydrationCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 0.6,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(14),
    justifyContent: 'space-between',
    gap: sw(12),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: sw(16),
  },
  statLeft: {},
  statValue: {
    color: colors.textPrimary,
    fontFamily: Fonts.extraBold,
    fontSize: ms(26),
    lineHeight: ms(30),
    letterSpacing: -0.6,
  },
  unit: {
    color: colors.textTertiary,
    fontFamily: Fonts.medium,
    fontSize: ms(15),
    letterSpacing: 0,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
    marginTop: sw(2),
  },
  statRight: {
    alignItems: 'flex-end',
    gap: sw(2),
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  targetDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.accent,
  },
  targetWord: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
  },
  targetValue: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  targetUnit: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
  },
  progressTrack: {
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: sw(2),
  },
});
