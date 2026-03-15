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

function formatVolume(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1)}k`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return kg.toLocaleString();
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function SummaryStatsCard({ analysis }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasData = analysis !== null && analysis.workoutCount > 0;

  const dateRange = useMemo(() => {
    if (!analysis) return '';
    return `${formatDate(analysis.weekStart)} – ${formatDate(analysis.weekEnd)}`;
  }, [analysis]);

  return (
    <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Analysis</Text>
          {hasData && <Text style={styles.dateRange}>{dateRange}</Text>}
        </View>

        {hasData && analysis ? (
          <>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statTile, { backgroundColor: colors.accent + '12' }]}>
                <Text style={styles.label}>Volume</Text>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                  {formatVolume(analysis.totalVolume)}
                </Text>
                <Text style={styles.unit}>kg</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.label}>Sessions</Text>
                <Text style={styles.statValue}>{analysis.workoutCount}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.label}>Active Time</Text>
                <Text style={styles.statValue}>
                  {formatDuration(analysis.totalDuration)}
                </Text>
              </View>
            </View>

            {/* Stimulus row */}
            <View style={styles.stimulusRow}>
              <View style={styles.stimulusItem}>
                <Text style={styles.label}>Highest Stimulus</Text>
                <View style={styles.stimulusValueRow}>
                  <View style={[styles.stimulusDot, { backgroundColor: colors.accentGreen }]} />
                  <Text style={styles.stimulusValue}>
                    {analysis.mostTrained ? GROUP_LABELS[analysis.mostTrained] : '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.stimulusDivider} />
              <View style={styles.stimulusItem}>
                <Text style={styles.label}>Neglected</Text>
                <View style={styles.stimulusValueRow}>
                  <View style={[styles.stimulusDot, { backgroundColor: colors.accentOrange }]} />
                  <Text style={[styles.stimulusValue, { color: colors.textSecondary }]} numberOfLines={1}>
                    {analysis.leastTrained ? GROUP_LABELS[analysis.leastTrained] : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Smart insight */}
            {analysis.weeklyWin && (
              <View style={styles.insightRow}>
                <Text style={styles.insightEmoji}>{analysis.weeklyWin.emoji}</Text>
                <Text style={styles.insightText}>{analysis.weeklyWin.text}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No data recorded this period</Text>
          </View>
        )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(14),
      ...colors.cardShadow,
    },

    /* Header */
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: sw(12),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    dateRange: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },

    /* Stats row */
    statsRow: {
      flexDirection: 'row',
      gap: sw(8),
      marginBottom: sw(8),
    },
    statTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      paddingVertical: sw(8),
      paddingHorizontal: sw(10),
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: ms(20),
      lineHeight: ms(25),
      fontFamily: Fonts.bold,
      marginTop: sw(1),
    },

    /* Shared */
    label: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    unit: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },

    /* Insight row */
    insightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      paddingTop: sw(10),
      marginTop: sw(10),
      gap: sw(8),
    },
    insightEmoji: {
      fontSize: ms(20),
      lineHeight: ms(26),
    },
    insightText: {
      flex: 1,
      color: colors.accent,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },

    /* Stimulus row */
    stimulusRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      overflow: 'hidden',
    },
    stimulusItem: {
      flex: 1,
      paddingVertical: sw(8),
      paddingHorizontal: sw(12),
      alignItems: 'center',
    },
    stimulusDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.cardBorder,
    },
    stimulusValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      marginTop: sw(3),
    },
    stimulusDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    stimulusValue: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },

    /* Empty */
    emptyState: {
      paddingVertical: sw(16),
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
  });
