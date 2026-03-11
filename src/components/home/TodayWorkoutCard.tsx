import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWorkoutStore } from '../../stores/useWorkoutStore';

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(vol));
}

export default function TodayWorkoutCard() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const todayKey = toDateKey(new Date());
  const todayWorkout = useMemo(() => {
    for (const w of workouts) {
      if (toDateKey(new Date(w.created_at)) === todayKey) return w;
    }
    return null;
  }, [workouts, todayKey]);

  if (!todayWorkout) return null;

  const muscles = todayWorkout.muscleGroups?.slice(0, 3) ?? [];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today</Text>

      {muscles.length > 0 && (
        <Text style={styles.muscles} numberOfLines={1}>
          {muscles.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}
        </Text>
      )}

      <Text style={styles.statLine}>
        {formatDuration(todayWorkout.duration)} · {todayWorkout.total_exercises} ex · {formatVolume(todayWorkout.totalVolume)} kg
      </Text>

      {todayWorkout.prCount > 0 && (
        <View style={styles.prBadge}>
          <Ionicons name="trophy" size={ms(9)} color={colors.accentOrange} />
          <Text style={styles.prText}>{todayWorkout.prCount} PR{todayWorkout.prCount !== 1 ? 's' : ''}</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(10),
    gap: sw(4),
    ...colors.cardShadow,
  },
  title: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  muscles: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
  },
  statLine: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
  },
  prText: {
    color: colors.accentOrange,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
  },
});
