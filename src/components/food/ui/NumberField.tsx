import React, { forwardRef, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useThemeStore } from '../../../stores/useThemeStore';
import { sanitizeDecimal } from '../decimalInput';
import { useRevealOnFocus } from './FoodSubScreen';

interface Props extends Pick<TextInputProps, 'returnKeyType' | 'onSubmitEditing' | 'blurOnSubmit'> {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  /** Colour bar on the left (macro colour); omit for a neutral field. */
  accentColor?: string;
  placeholder?: string;
}

/** Labelled numeric input card used by food forms (energy, macros). */
const NumberField = forwardRef<TextInput, Props>(function NumberField(
  { label, value, onChangeText, unit, accentColor, placeholder = '0', returnKeyType = 'next', onSubmitEditing, blurOnSubmit = false },
  ref,
) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const reveal = useRevealOnFocus();
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        {accentColor ? <View style={[styles.dot, { backgroundColor: accentColor }]} /> : null}
        <Text style={[styles.label, accentColor ? { color: accentColor } : null]} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          style={styles.input}
          value={value}
          // Accept a comma as the decimal mark ("1,5" → "1.5"); drop "-" and extra dots (Android).
          onChangeText={(v) => onChangeText(sanitizeDecimal(v))}
          onFocus={reveal}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          // 'numeric' keeps a return key on iOS, so Next moves between fields.
          keyboardType="numeric"
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          onSubmitEditing={onSubmitEditing}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          accessibilityLabel={unit ? `${label} in ${unit}` : label}
        />
        {!!unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
});

export default React.memo(NumberField);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      paddingHorizontal: sw(12),
      paddingVertical: sw(10),
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(4),
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
    },
    dot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: sw(4),
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(20),
      fontFamily: Fonts.bold,
      paddingVertical: 0,
    },
    unit: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
    },
  });
