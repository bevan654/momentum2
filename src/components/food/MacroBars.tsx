import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

export interface MacroBarItem {
  key: string;
  label: string;
  eaten: number;
  goal: number;
  color: string;
}

type Styles = ReturnType<typeof createStyles>;

const MacroBar = React.memo(function MacroBar({ item, styles, overColor }: { item: MacroBarItem; styles: Styles; overColor: string }) {
  const progress = item.goal > 0 ? Math.min(item.eaten / item.goal, 1) : 0;
  const over = item.goal > 0 && item.eaten > item.goal;

  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(progress, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={styles.item}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.numbers}>
          <Text style={[styles.eaten, over && { color: overColor }]}>{item.eaten}</Text>
          <Text style={styles.goal}> / {item.goal}g</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: over ? overColor : item.color }, fillStyle]} />
      </View>
    </View>
  );
});

/** Protein / carbs / fat progress bars for the nutrition summary. */
function MacroBars({ items }: { items: MacroBarItem[] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {items.map((m) => (
        <MacroBar key={m.key} item={m} styles={styles} overColor={colors.accentRed} />
      ))}
    </View>
  );
}

export default React.memo(MacroBars);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: {
      flex: 1,
      gap: sw(12),
      justifyContent: 'center',
    },
    item: {
      gap: sw(5),
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    label: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    numbers: {
      fontSize: ms(12),
      lineHeight: ms(16),
    },
    eaten: {
      color: colors.textPrimary,
      fontFamily: Fonts.bold,
    },
    goal: {
      color: colors.textTertiary,
      fontFamily: Fonts.medium,
    },
    track: {
      height: sw(6),
      borderRadius: sw(3),
      backgroundColor: colors.ring.track,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: sw(3),
    },
  });
