import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';
import { useLabTimeRangeStore } from '../../stores/useLabTimeRangeStore';

/* ─── Stats helper ───────────────────────────────────────── */

function computeWindowStats(workouts: WorkoutWithDetails[], days: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();

  let sessions = 0;
  let totalDuration = 0;

  for (const w of workouts) {
    const t = new Date(w.created_at).getTime();
    if (t < startMs) continue;
    sessions++;
    totalDuration += w.duration || 0;
  }

  return {
    sessions,
    avgDuration: sessions > 0 ? Math.round(totalDuration / sessions / 60) : 0,
  };
}

/* ─── Layout ─────────────────────────────────────────────── */

const CELL_GAP = sw(6);

/* ─── Component ──────────────────────────────────────────── */

export default function QuickStatsGrid() {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const rangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const stats = useMemo(() => computeWindowStats(workouts, rangeDays), [workouts, rangeDays]);

  const statItems = useMemo(() => [
    { label: 'Sessions', value: String(stats.sessions), icon: 'barbell-outline' as const },
    { label: 'Avg Time', value: stats.avgDuration > 0 ? `${stats.avgDuration}m` : '—', icon: 'time-outline' as const },
  ], [stats]);

  return (
    <View style={styles.grid}>
      {statItems.map((item) => (
        <View key={item.label} style={styles.cell}>
          <View style={[styles.cellIcon, { backgroundColor: colors.accent + '12' }]}>
            <Ionicons name={item.icon} size={ms(11)} color={colors.accent} />
          </View>
          <Text style={styles.cellValue}>{item.value}</Text>
          <Text style={styles.cellLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: {
      flex: 35,
      gap: CELL_GAP,
    },
    cell: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(8),
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(1),
      ...colors.cardShadow,
    },
    cellIcon: {
      width: sw(20),
      height: sw(20),
      borderRadius: sw(5),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(1),
    },
    cellValue: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },
    cellLabel: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.medium,
    },
  });
