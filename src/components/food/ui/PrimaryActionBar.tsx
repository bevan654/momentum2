import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  label: string;
  /** Small text on the right of the button, e.g. "320 kcal". */
  sublabel?: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  /** 'accent' for logging, 'planned' (green) for planning ahead. */
  tone?: 'accent' | 'planned';
  /** Optional square button on the left (e.g. delete). */
  secondary?: { icon: IconName; onPress: () => void; label: string; destructive?: boolean };
}

/** The main action at the bottom of a food screen ("Add", "Update", "Log meal"...). */
function PrimaryActionBar({ label, sublabel, icon, onPress, disabled, tone = 'accent', secondary }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bg = tone === 'planned' ? colors.accentGreen : colors.accent;
  return (
    <View style={styles.row}>
      {secondary && (
        <Pressable
          onPress={secondary.onPress}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={secondary.label}
        >
          <Ionicons name={secondary.icon} size={ms(20)} color={secondary.destructive ? colors.accentRed : colors.textSecondary} />
        </Pressable>
      )}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.primary, { backgroundColor: bg }, disabled && styles.disabled, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
        accessibilityState={{ disabled: !!disabled }}
      >
        {icon && <Ionicons name={icon} size={ms(19)} color={colors.textOnAccent} />}
        <Text style={styles.label}>{label}</Text>
        {!!sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      </Pressable>
    </View>
  );
}

export default React.memo(PrimaryActionBar);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: sw(10),
    },
    primary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      minHeight: sw(52),
      borderRadius: sw(16),
    },
    secondary: {
      width: sw(52),
      height: sw(52),
      borderRadius: sw(16),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.75,
    },
    label: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    sublabel: {
      color: colors.textOnAccent,
      opacity: 0.75,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
  });
