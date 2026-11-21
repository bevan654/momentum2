import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  onScan: () => void;
  onQuickAdd: () => void;
  /** Leave out to hide the tile (Make a meal shows only Scan and Quick add). */
  onLens?: () => void;
  onMeal?: () => void;
}

/** The ways to log besides search: barcode, AI photo, quick numbers, build a meal. */
function AddFoodActions({ onScan, onLens, onQuickAdd, onMeal }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tiles = ([
    { key: 'scan', icon: 'barcode-outline', label: 'Scan', onPress: onScan },
    { key: 'lens', icon: 'aperture-outline', label: 'MacroLens', onPress: onLens },
    { key: 'quick', icon: 'flash-outline', label: 'Quick add', onPress: onQuickAdd },
    { key: 'meal', icon: 'restaurant-outline', label: 'Make a meal', onPress: onMeal },
  ] as { key: string; icon: IconName; label: string; onPress?: () => void }[])
    .filter((t): t is { key: string; icon: IconName; label: string; onPress: () => void } => !!t.onPress);
  return (
    <View style={styles.row}>
      {tiles.map((t) => (
        <Pressable
          key={t.key}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={t.onPress}
          accessibilityRole="button"
          accessibilityLabel={t.label}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={t.icon} size={ms(19)} color={colors.accent} />
          </View>
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default React.memo(AddFoodActions);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: sw(8),
      marginHorizontal: sw(16),
    },
    tile: {
      flex: 1,
      alignItems: 'center',
      gap: sw(6),
      paddingVertical: sw(10),
      borderRadius: sw(16),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pressed: {
      opacity: 0.6,
    },
    iconWrap: {
      width: sw(36),
      height: sw(36),
      borderRadius: sw(12),
      backgroundColor: colors.accent + '1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      paddingHorizontal: sw(4),
    },
  });
