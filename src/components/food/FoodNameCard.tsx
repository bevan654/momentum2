import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useThemeStore } from '../../stores/useThemeStore';
import { useRevealOnFocus } from './ui/FoodSubScreen';

interface Props {
  name: string;
  onNameChange: (v: string) => void;
  brand: string;
  onBrandChange: (v: string) => void;
  confidence?: string;
  /** Current barcode data source, or null when switching isn't possible. */
  altSource: 'off' | 'usda' | null;
  altLoading: boolean;
  onAltSource: () => void;
}

/** Editable food name and brand, a trust badge, and the Open Food Facts / USDA switch for scans. */
function FoodNameCard({ name, onNameChange, brand, onBrandChange, confidence, altSource, altLoading, onAltSource }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const keyboard = useThemeStore((s) => s.mode) === 'dark' ? 'dark' : 'light';

  const badge =
    confidence === 'verified' ? { icon: 'checkmark-circle' as const, text: 'Verified', color: colors.accentGreen }
    : confidence === 'user_submitted' ? { icon: 'person-outline' as const, text: 'Unverified', color: colors.textTertiary }
    : confidence === 'ai_estimated' ? { icon: 'sparkles' as const, text: 'AI estimate', color: colors.accent }
    : null;

  const reveal = useRevealOnFocus();
  return (
    <View style={styles.card}>
      <TextInput
        style={styles.name}
        value={name}
        onChangeText={onNameChange}
        onFocus={reveal}
        placeholder="Food name"
        placeholderTextColor={colors.textTertiary}
        keyboardAppearance={keyboard}
        returnKeyType="next"
        accessibilityLabel="Food name"
      />
      <TextInput
        style={styles.brand}
        value={brand}
        onChangeText={onBrandChange}
        onFocus={reveal}
        placeholder="Brand (optional)"
        placeholderTextColor={colors.textTertiary}
        keyboardAppearance={keyboard}
        returnKeyType="done"
        accessibilityLabel="Brand"
      />
      {(badge || altSource) && (
        <View style={styles.row}>
          {badge && (
            <View style={[styles.badge, { backgroundColor: badge.color + '1A' }]}>
              <Ionicons name={badge.icon} size={ms(12)} color={badge.color} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          )}
          {altSource && (
            <Pressable
              style={({ pressed }) => [styles.alt, pressed && styles.pressed]}
              onPress={onAltSource}
              disabled={altLoading}
              accessibilityRole="button"
            >
              <Ionicons name="swap-horizontal" size={ms(13)} color={colors.accent} />
              <Text style={styles.altText}>
                {altLoading ? 'Loading…' : altSource === 'off' ? 'Try USDA data' : 'Switch to Open Food Facts'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(FoodNameCard);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: sw(14),
      borderRadius: sw(18),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(6),
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(19),
      lineHeight: ms(25),
      fontFamily: Fonts.bold,
      padding: 0,
    },
    brand: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      padding: 0,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: sw(6),
      marginTop: sw(2),
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      paddingHorizontal: sw(8),
      paddingVertical: sw(4),
      borderRadius: sw(999),
    },
    badgeText: {
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
    },
    alt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
      borderRadius: sw(999),
      backgroundColor: colors.accent + '14',
    },
    pressed: {
      opacity: 0.6,
    },
    altText: {
      color: colors.accent,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
  });
