import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  unit: string;
  keyboardType: KeyboardTypeOptions;
  maxLength: number;
  placeholder?: string;
  /** Goals step: left-aligned text. */
  goal?: boolean;
}

/** Number field with a unit badge next to it (onboarding body details and goals). */
function UnitInput({ value, onChangeText, unit, keyboardType, maxLength, placeholder, goal = false }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.inputWithUnit}>
      <TextInput
        style={[styles.input, styles.inputFlex, goal && styles.goalInput]}
        placeholder={placeholder}
        placeholderTextColor={placeholder != null ? colors.textTertiary : undefined}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
      <View style={styles.unitBadge}>
        <Text style={styles.unitBadgeText}>{unit}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    input: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(14),
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    inputFlex: {
      flex: 1,
    },
    goalInput: {
      textAlign: 'left',
    },
    inputWithUnit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
    },
    unitBadge: {
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      paddingHorizontal: sw(14),
      paddingVertical: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    unitBadgeText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
  });

export default memo(UnitInput);
