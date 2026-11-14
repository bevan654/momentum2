import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

interface Props {
  /** Region name. */
  label: string;
  /** Its value: volume, recovery, ... */
  detail: string;
  /** Swatch and detail colour. Defaults to the accent. */
  color?: string;
}

/** The tapped region of a body map: swatch, name and value. */
function RegionChip({ label, detail, color }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tint = color ?? colors.accent;
  return (
    <View style={styles.chip} accessibilityLiveRegion="polite">
      <View style={[styles.swatch, { backgroundColor: tint }]} />
      <Text style={styles.name} numberOfLines={1}>{label}</Text>
      <View style={styles.divider} />
      <Text style={[styles.detail, color ? { color } : null]} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

export default React.memo(RegionChip);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      maxWidth: '100%',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
      gap: sw(6),
    },
    swatch: {
      width: sw(7),
      height: sw(7),
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
      flexShrink: 1,
    },
    divider: {
      width: 1,
      height: sw(12),
      backgroundColor: colors.cardBorder,
    },
    detail: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.extraBold,
    },
  });
