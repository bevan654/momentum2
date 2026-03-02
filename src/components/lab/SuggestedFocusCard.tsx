import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { GROUP_LABELS } from '../body/musclePathData';
import type { WeeklyAnalysis } from '../../stores/useMuscleAnalysisStore';

interface Props {
  analysis: WeeklyAnalysis | null;
}

export default function SuggestedFocusCard({ analysis }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const focus = analysis?.suggestedFocus ?? [];

  if (focus.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggested Focus</Text>
      <Text style={styles.subtitle}>
        Fully recovered and undertrained muscles
      </Text>
      <View style={styles.chipRow}>
        {focus.map((g) => (
          <View key={g} style={styles.chip}>
            <Text style={styles.chipText}>{GROUP_LABELS[g]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      padding: sw(20),
      marginTop: sw(10),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(24),
      fontFamily: Fonts.bold,
      marginBottom: sw(4),
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginBottom: sw(12),
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(8),
    },
    chip: {
      backgroundColor: colors.accentGreen + '20',
      borderRadius: sw(10),
      paddingHorizontal: sw(14),
      paddingVertical: sw(6),
    },
    chipText: {
      color: colors.accentGreen,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
  });
