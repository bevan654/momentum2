import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

export default function ProgramBanner() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.7}>
      <View style={styles.textArea}>
        <Text style={styles.title}>Start Your Program</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          AI-powered body composition coaching that...
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(18),
    flexDirection: 'row',
    alignItems: 'center',
  },
  textArea: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(17),
    lineHeight: ms(23),
    fontFamily: Fonts.bold,
    marginBottom: sw(4),
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  chevron: {
    color: colors.accent,
    fontSize: ms(28),
    lineHeight: ms(33),
    fontFamily: Fonts.regular,
    letterSpacing: -0.3,
    marginLeft: sw(12),
  },
});
