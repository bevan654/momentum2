import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';

/* ─── Layout constants (must match MuscleRadarCard) ──────── */

const SCREEN_PAD = sw(16);
const ROW_GAP = sw(12);
const HALF_W = (SCREEN_WIDTH - SCREEN_PAD * 2 - ROW_GAP) / 2;
const CELL_GAP = sw(8);
const CELL_W = (HALF_W - CELL_GAP) / 2;

/* ─── Helpers ────────────────────────────────────────────── */

interface WeekStats {
  sessions: number;
  bestE1RM: { value: number; exercise: string } | null;
  avgDuration: number;
  prs: number;
}

function computeWeekStats(workouts: WorkoutWithDetails[]): WeekStats {
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

/* ─── Component ──────────────────────────────────────────── */

export default function WeeklyStatsGrid() {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const stats = useMemo(() => computeWeekStats(workouts), [workouts]);

  const statItems: { icon: string; label: string; value: string; sub?: string }[] = useMemo(() => [
    {
      icon: 'calendar-outline',
      label: 'Sessions',
      value: String(stats.sessions),
    },
    {
      icon: 'timer-outline',
      label: 'Avg Time',
      value: stats.avgDuration > 0 ? `${stats.avgDuration}m` : '—',
    },
    {
      icon: 'trophy-outline',
      label: 'Best e1RM',
      value: stats.bestE1RM ? `${stats.bestE1RM.value}kg` : '—',
      sub: stats.bestE1RM?.exercise,
    },
    {
      icon: 'ribbon-outline',
      label: 'PRs Hit',
      value: String(stats.prs),
    },
  ], [stats]);

  return (
    <View style={styles.grid}>
      {statItems.map((item) => (
        <View key={item.label} style={styles.cell}>
          <Ionicons name={item.icon as any} size={ms(13)} color={colors.accent} />
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          {item.sub && (
            <Text style={styles.sub} numberOfLines={1}>{item.sub}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: {
      width: HALF_W,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CELL_GAP,
    },
    cell: {
      width: CELL_W,
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(8),
      ...colors.cardShadow,
    },
    value: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      marginTop: sw(4),
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },
    sub: {
      color: colors.textTertiary,
      fontSize: ms(7),
      lineHeight: ms(9),
      fontFamily: Fonts.medium,
      marginTop: sw(1),
    },
  });
