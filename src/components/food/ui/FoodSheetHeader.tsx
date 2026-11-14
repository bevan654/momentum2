import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

interface Props {
  title: string;
  subtitle?: string;
  /** 'close' (×, top-level sheet) or 'back' (‹, a screen opened from another). */
  leading: 'close' | 'back';
  onLeading: () => void;
  right?: React.ReactNode;
}

/** Shared header for every food popup: round close/back button, title, optional subtitle and right slot. */
function FoodSheetHeader({ title, subtitle, leading, onLeading, right }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onLeading}
        hitSlop={10}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={leading === 'close' ? 'Close' : 'Back'}
      >
        <Ionicons name={leading === 'close' ? 'close' : 'chevron-back'} size={ms(18)} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.titleCol}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export default React.memo(FoodSheetHeader);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingTop: sw(6),
      paddingBottom: sw(10),
      gap: sw(12),
    },
    btn: {
      width: sw(36),
      height: sw(36),
      borderRadius: sw(18),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.6,
    },
    titleCol: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(17),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
      letterSpacing: -0.2,
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
    right: {
      minWidth: sw(36),
      alignItems: 'flex-end',
    },
  });
