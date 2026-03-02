import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { GROUP_LABELS, type MuscleGroup } from '../body/musclePathData';
import type { WeeklyAnalysis } from '../../stores/useMuscleAnalysisStore';

interface Props {
  analysis: WeeklyAnalysis | null;
}

const ALL_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'quads', 'hamstrings', 'glutes', 'calves',
];

/* Short labels for the x-axis */
const SHORT_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shld',
  biceps: 'Bi',
  triceps: 'Tri',
  forearms: 'Fore',
  abs: 'Abs',
  quads: 'Quad',
  hamstrings: 'Ham',
  glutes: 'Glute',
  calves: 'Calf',
};

const CHART_HEIGHT = sw(140);
const BAR_WIDTH = sw(8);
const BAR_GAP = sw(3);       // gap between this/prev bar in a pair
const GROUP_PAD = sw(4);     // padding between groups

function formatVol(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export default function WeeklyVolumeCard({ analysis }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const groups = useMemo(() => {
    if (!analysis) return [];
    return ALL_GROUPS
      .map((g) => ({
        group: g,
        thisWeek: analysis.groups[g].weeklyVolume,
        prevWeek: analysis.groups[g].prevWeekVolume,
        undertrained: analysis.groups[g].undertrained,
        overtrained: analysis.groups[g].overtrained,
      }))
      .filter((g) => g.thisWeek > 0 || g.prevWeek > 0);
  }, [analysis]);

  const maxVol = useMemo(
    () => Math.max(...groups.map((g) => Math.max(g.thisWeek, g.prevWeek)), 1),
    [groups],
  );

  const flags = useMemo(() => groups.filter((g) => g.undertrained || g.overtrained), [groups]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.accentDot} />
        <Text style={styles.title}>Volume Comparison</Text>
      </View>
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>Coming Soon</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(18),
      ...colors.cardShadow,
    },

    /* Header */
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: sw(14),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    accentDot: {
      width: sw(4),
      height: sw(16),
      borderRadius: sw(2),
      backgroundColor: colors.accent,
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
    },

    /* Legend */
    legend: {
      flexDirection: 'row',
      gap: sw(12),
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    legendDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    legendText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },

    /* Chart */
    chartContainer: {
      alignItems: 'center',
    },
    xAxis: {
      flexDirection: 'row',
      marginTop: sw(6),
    },
    xLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.semiBold,
      textAlign: 'center',
      position: 'absolute',
    },

    /* Flags */
    flagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(8),
      marginTop: sw(16),
      paddingTop: sw(14),
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    flagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: sw(8),
      borderWidth: 1,
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
      gap: sw(6),
    },
    flagIndicator: {
      width: sw(4),
      height: sw(4),
      borderRadius: sw(2),
    },
    flagText: {
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
    },
    flagType: {
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
      opacity: 0.7,
    },

    /* Coming soon */
    comingSoon: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      paddingVertical: sw(28),
      alignItems: 'center',
    },
    comingSoonText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },
  });
