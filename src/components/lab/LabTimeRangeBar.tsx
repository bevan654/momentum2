import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import {
  useLabTimeRangeStore,
  LAB_RANGE_OPTIONS,
} from '../../stores/useLabTimeRangeStore';

export default function LabTimeRangeBar() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const setRange = useLabTimeRangeStore((s) => s.setRange);

  return (
    <View style={styles.bar}>
      <Text style={styles.label}>Showing</Text>
      <View style={styles.pillRow}>
        {LAB_RANGE_OPTIONS.map((opt) => {
          const active = opt.days === rangeDays;
          return (
            <Pressable
              key={opt.label}
              onPress={() => setRange(opt.days)}
              style={[
                styles.pill,
                active && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Text style={[styles.pillText, active && { color: colors.textOnAccent }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingHorizontal: sw(4),
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    pillRow: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: sw(6),
    },
    pill: {
      paddingHorizontal: sw(12),
      paddingVertical: sw(6),
      borderRadius: sw(14),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    pillText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
    },
  });
