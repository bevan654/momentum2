import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import MacroSplitBar from '../MacroSplitBar';

interface Props {
  name: string;
  /** Second line, e.g. "Brand · 100 g" or "3 items". */
  subtitle?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** 'verified' shows a tick, 'ai_estimated' a sparkle. */
  confidence?: string | null;
  onPress: () => void;
  onLongPress?: () => void;
  /** Right-hand control (favourite heart, add button, chevron). */
  trailing?: React.ReactNode;
  accessibilityHint?: string;
}

/** One food in a picker list: name + badge, subtitle, kcal, and its macro split. */
function FoodRow({
  name, subtitle, calories, protein, carbs, fat, confidence, onPress, onLongPress, trailing, accessibilityHint,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${name}${subtitle ? `, ${subtitle}` : ''}, ${Math.round(calories)} calories`}
        accessibilityHint={accessibilityHint}
      >
        <View style={styles.top}>
          <View style={styles.nameCol}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {confidence === 'verified' && (
                <Ionicons name="checkmark-circle" size={ms(12)} color={colors.accentGreen} />
              )}
              {confidence === 'ai_estimated' && (
                <Ionicons name="sparkles" size={ms(12)} color={colors.accent} />
              )}
            </View>
            {!!subtitle && <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>}
          </View>
          <Text style={styles.kcal}>
            {Math.round(calories)}
            <Text style={styles.kcalUnit}> kcal</Text>
          </Text>
        </View>
        <MacroSplitBar protein={protein} carbs={carbs} fat={fat} />
      </Pressable>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

export default React.memo(FoodRow);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: sw(16),
      paddingLeft: sw(14),
      paddingRight: sw(6),
      borderRadius: sw(16),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    body: {
      flex: 1,
      paddingVertical: sw(11),
      gap: sw(7),
    },
    pressed: {
      opacity: 0.6,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
    },
    nameCol: {
      flex: 1,
      gap: sw(1),
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
    },
    name: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    sub: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.regular,
    },
    kcal: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.bold,
    },
    kcalUnit: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
    },
    trailing: {
      paddingLeft: sw(4),
    },
  });
