import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';

/* ─── Stats helper ───────────────────────────────────────── */

function computeWeekStats(workouts: WorkoutWithDetails[]) {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weekMs = weekStart.getTime();

  let sessions = 0;
  let totalDuration = 0;
  let prs = 0;
  let bestE1RM: { value: number; exercise: string } | null = null;

  for (const w of workouts) {
    const t = new Date(w.created_at).getTime();
    if (t < weekMs) continue;
    sessions++;
    totalDuration += w.duration || 0;
    prs += w.prCount || 0;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        if (!s.completed || s.kg <= 0 || s.reps <= 0) continue;
        const e1rm = s.reps === 1 ? s.kg : s.kg * (36 / (37 - s.reps));
        if (!bestE1RM || e1rm > bestE1RM.value) {
          bestE1RM = { value: Math.round(e1rm), exercise: ex.name };
        }
      }
    }
  }

  return {
    sessions,
    bestE1RM,
    avgDuration: sessions > 0 ? Math.round(totalDuration / sessions / 60) : 0,
    prs,
  };
}

/* ─── Layout ─────────────────────────────────────────────── */

const CELL_GAP = sw(6);

/* ─── Component ──────────────────────────────────────────── */

export default function QuickStatsGrid() {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const stats = useMemo(() => computeWeekStats(workouts), [workouts]);

  const statItems = useMemo(() => [
    { label: 'Sessions', value: String(stats.sessions), icon: 'barbell-outline' as const },
    { label: 'Avg Time', value: stats.avgDuration > 0 ? `${stats.avgDuration}m` : '—', icon: 'time-outline' as const },
    { label: 'Best e1RM', value: stats.bestE1RM ? `${stats.bestE1RM.value}kg` : '—', icon: 'trending-up-outline' as const },
    { label: 'PRs Hit', value: String(stats.prs), icon: 'trophy-outline' as const },
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
