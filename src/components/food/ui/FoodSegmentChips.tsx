import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

interface Props<K extends string> {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
}

/** Segmented control used for the food pickers' default lists (For you / Favourites / Meals...). */
function FoodSegmentChips<K extends string>({ options, value, onChange }: Props<K>) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[styles.seg, active && styles.segActive]}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
          >
            <Ionicons name={o.icon} size={ms(13)} color={active ? colors.textPrimary : colors.textTertiary} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default React.memo(FoodSegmentChips) as typeof FoodSegmentChips;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      marginHorizontal: sw(16),
      padding: sw(3),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
      gap: sw(3),
    },
    seg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(5),
      paddingVertical: sw(7),
      borderRadius: sw(9),
    },
    segActive: {
      backgroundColor: colors.card,
      ...colors.cardShadow,
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    labelActive: {
      color: colors.textPrimary,
    },
  });
