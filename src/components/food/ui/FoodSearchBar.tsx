import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useThemeStore } from '../../../stores/useThemeStore';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder: string;
  autoFocus?: boolean;
}

/** Shared food search field with a clear button. */
function FoodSearchBar({ value, onChangeText, onClear, placeholder, autoFocus }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  return (
    <View style={styles.bar}>
      <Ionicons name="search" size={ms(16)} color={colors.textTertiary} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        keyboardAppearance={isDark ? 'dark' : 'light'}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={10} style={styles.clear} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close" size={ms(12)} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

export default React.memo(FoodSearchBar);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      marginHorizontal: sw(16),
      paddingHorizontal: sw(12),
      height: sw(44),
      borderRadius: sw(14),
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.medium,
      paddingVertical: 0,
    },
    clear: {
      width: sw(20),
      height: sw(20),
      borderRadius: sw(10),
      backgroundColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
