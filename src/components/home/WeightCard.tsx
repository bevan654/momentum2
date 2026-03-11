import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWeightStore } from '../../stores/useWeightStore';

export default function WeightCard() {
  const current = useWeightStore((s) => s.current);
  const trend = useWeightStore((s) => s.trend);
  const change = useWeightStore((s) => s.change);
  const entries = useWeightStore((s) => s.entries);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (current == null) return null;

  const trendDirection = trend != null && current != null
    ? (current > trend ? 'up' : current < trend ? 'down' : 'flat')
    : 'flat';

  const trendColor = trendDirection === 'up'
    ? colors.accentRed
    : trendDirection === 'down'
    ? colors.accentGreen
    : colors.textTertiary;

  const trendIcon = trendDirection === 'up'
    ? 'caret-up'
    : trendDirection === 'down'
    ? 'caret-down'
    : 'remove';

  const changeAbs = change != null ? Math.abs(change) : 0;
  const changeSign = change != null ? (change > 0 ? '+' : change < 0 ? '-' : '') : '';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Body Weight</Text>

      <View style={styles.mainRow}>
        <Text style={styles.weight}>{current.toFixed(1)}</Text>
        <Text style={styles.unit}>kg</Text>
        <View style={styles.trendWrap}>
          <Ionicons name={trendIcon as any} size={ms(12)} color={trendColor} />
        </View>
      </View>

      {change != null && changeAbs > 0 && (
        <Text style={[styles.change, { color: trendColor }]}>
          {changeSign}{changeAbs.toFixed(1)} kg over {entries.length} entries
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(10),
    gap: sw(4),
    ...colors.cardShadow,
  },
  title: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(4),
  },
  weight: {
    color: colors.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(26),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  unit: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
  },
  trendWrap: {
    marginLeft: sw(2),
  },
  change: {
    fontSize: ms(9),
    fontFamily: Fonts.medium,
  },
});
