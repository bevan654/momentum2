import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

interface Props {
  protein: number;
  carbs: number;
  fat: number;
  /** Show "P 30 · C 40 · F 10" under the bar. */
  showGrams?: boolean;
}

/**
 * Thin bar split by where the calories come from (protein and carbs 4 kcal/g, fat 9 kcal/g),
 * so a food's macro balance reads at a glance.
 */
function MacroSplitBar({ protein, carbs, fat, showGrams = true }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const p = Math.max(0, protein) * 4;
  const c = Math.max(0, carbs) * 4;
  const f = Math.max(0, fat) * 9;
  const total = p + c + f;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {total > 0 && (
          <>
            <View style={{ flex: p, backgroundColor: colors.protein }} />
            <View style={{ flex: c, backgroundColor: colors.carbs }} />
            <View style={{ flex: f, backgroundColor: colors.fat }} />
          </>
        )}
      </View>
      {showGrams && (
        <Text style={styles.grams} numberOfLines={1}>
          <Text style={{ color: colors.protein }}>P </Text>
          {Math.round(protein)}
          <Text style={styles.sep}>{'  ·  '}</Text>
          <Text style={{ color: colors.carbs }}>C </Text>
          {Math.round(carbs)}
          <Text style={styles.sep}>{'  ·  '}</Text>
          <Text style={{ color: colors.fat }}>F </Text>
          {Math.round(fat)}
          <Text style={styles.sep}> g</Text>
        </Text>
      )}
    </View>
  );
}

export default React.memo(MacroSplitBar);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: sw(4),
    },
    track: {
      flexDirection: 'row',
      height: sw(3),
      borderRadius: sw(1.5),
      overflow: 'hidden',
      backgroundColor: colors.ring.track,
      gap: sw(1.5),
    },
    grams: {
      color: colors.textSecondary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    sep: {
      color: colors.textTertiary,
    },
  });
