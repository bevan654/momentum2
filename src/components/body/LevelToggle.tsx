import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Level } from 'momentum-muscle-map';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

const LEVELS: { level: Level; label: string }[] = [
  { level: 'groups', label: 'Groups' },
  { level: 'muscles', label: 'Muscles' },
  { level: 'parts', label: 'Parts' },
];

interface Props {
  level: Level;
  onChange: (level: Level) => void;
}

/** Segmented control for how finely a body map divides the body. */
function LevelToggle({ level, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {LEVELS.map((item) => {
        const active = item.level === level;
        return (
          <Pressable
            key={item.level}
            onPress={() => onChange(item.level)}
            style={[styles.segment, active && styles.segmentActive]}
            hitSlop={{ top: sw(6), bottom: sw(6) }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show ${item.label.toLowerCase()}`}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default React.memo(LevelToggle);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    segment: {
      paddingHorizontal: sw(8),
      paddingVertical: sw(4),
      minWidth: sw(46),
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: colors.accent,
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.semiBold,
    },
    labelActive: {
      color: colors.textOnAccent,
    },
  });
