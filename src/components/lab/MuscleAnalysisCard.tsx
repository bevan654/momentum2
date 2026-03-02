import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MuscleHeatmap from '../body/MuscleHeatmap';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import { useMuscleAnalysisStore } from '../../stores/useMuscleAnalysisStore';

interface Props {
  exercises: ExerciseWithSets[];
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return String(kg);
}

export default function MuscleAnalysisCard({ exercises }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const analysis = useMuscleAnalysisStore((s) => s.analysis);

  const trainedCount = analysis
    ? Object.values(analysis.groups).filter((g) => g.weeklyVolume > 0).length
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.weekLabel}>THIS WEEK</Text>
        {analysis && analysis.workoutCount > 0 && (
          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              {analysis.workoutCount} {analysis.workoutCount === 1 ? 'workout' : 'workouts'}
            </Text>
            <View style={styles.statDot} />
            <Text style={styles.statText}>
              {formatVolume(analysis.totalVolume)} kg
            </Text>
            <View style={styles.statDot} />
            <Text style={styles.statText}>
              {trainedCount}/11 groups
            </Text>
          </View>
        )}
      </View>

      <MuscleHeatmap exercises={exercises} />

      <View style={styles.divider} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingTop: sw(14),
      paddingBottom: sw(4),
      alignItems: 'center',
    },
    headerRow: {
      alignItems: 'center',
      marginBottom: sw(4),
      gap: sw(6),
    },
    weekLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: 1.2,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    statText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
    statDot: {
      width: sw(3),
      height: sw(3),
      borderRadius: sw(1.5),
      backgroundColor: colors.textTertiary,
      opacity: 0.4,
    },
    divider: {
      width: '100%',
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
      marginTop: sw(16),
    },
  });
