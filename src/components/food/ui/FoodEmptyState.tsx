import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  /** Shows a spinner instead of the icon. */
  loading?: boolean;
  icon?: IconName;
  title: string;
  subtitle?: string;
}

/** Centered empty / loading message for food lists. */
function FoodEmptyState({ loading, icon = 'nutrition-outline', title, subtitle }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.iconWrap}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons name={icon} size={ms(22)} color={colors.textTertiary} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

export default React.memo(FoodEmptyState);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      paddingVertical: sw(40),
      paddingHorizontal: sw(32),
      gap: sw(6),
    },
    iconWrap: {
      width: sw(48),
      height: sw(48),
      borderRadius: sw(24),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(6),
    },
    title: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(17),
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },
  });
