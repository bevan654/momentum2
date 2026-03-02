import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWorkoutStore, type WorkoutWithDetails } from '../../stores/useWorkoutStore';
import WorkoutSummaryModal from '../workout-sheet/WorkoutSummaryModal';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function WorkoutCalendar() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);

  // Build lookup map: YYYY-MM-DD → WorkoutWithDetails
  const workoutMap = useMemo(() => {
    const map = new Map<string, WorkoutWithDetails>();
    for (const w of workouts) {
      const d = new Date(w.created_at);
      const key = toDateKey(d);
      // Keep the first (most recent) workout per day since workouts are newest-first
      if (!map.has(key)) map.set(key, w);
    }
    return map;
  }, [workouts]);

  // Calendar grid data
  const { daysInMonth, startDow, monthLabel } = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDow = firstDay.getDay(); // 0=Sun
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return { daysInMonth, startDow, monthLabel: `${monthNames[viewMonth]} ${viewYear}` };
  }, [viewYear, viewMonth]);

  const todayKey = toDateKey(today);
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const goToNextMonth = useCallback(() => {
    // Don't go past current month
    if (isCurrentMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth, isCurrentMonth]);

  const handleDayPress = useCallback((day: number) => {
    const key = toDateKey(new Date(viewYear, viewMonth, day));
    const workout = workoutMap.get(key);
    if (workout) setSelectedWorkout(workout);
  }, [viewYear, viewMonth, workoutMap]);

  // Build grid cells: empty padding + day cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={goToPrevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={ms(18)} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={goToNextMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={isCurrentMonth}
          >
            <Ionicons
              name="chevron-forward"
              size={ms(18)}
              color={isCurrentMonth ? colors.textTertiary + '40' : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.weekRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayCell}>
            <Text style={styles.weekLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) {
            return <View key={`empty-${i}`} style={styles.dayCell} />;
          }

          const key = toDateKey(new Date(viewYear, viewMonth, day));
          const hasWorkout = workoutMap.has(key);
          const isToday = key === todayKey;

          return (
            <TouchableOpacity
              key={key}
              style={styles.dayCell}
              onPress={() => handleDayPress(day)}
              activeOpacity={hasWorkout ? 0.6 : 1}
              disabled={!hasWorkout}
            >
              <View style={[styles.dayCircle, isToday && styles.todayCircle]}>
                <Text style={[styles.dayText, isToday && styles.todayText]}>
                  {day}
                </Text>
              </View>
              {hasWorkout && <View style={styles.workoutDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Workout summary modal */}
      {selectedWorkout && (
        <WorkoutSummaryModal
          mode="historical"
          data={selectedWorkout}
          onDismiss={() => setSelectedWorkout(null)}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(16),
    marginTop: sw(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(10),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
    minWidth: sw(110),
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: sw(2),
  },
  weekLabel: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Fixed height for 6 rows so all months render the same size
    height: sw(190),
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: sw(1.5),
  },
  dayCircle: {
    width: sw(28),
    height: sw(28),
    borderRadius: sw(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCircle: {
    backgroundColor: colors.accent + '20',
  },
  dayText: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  todayText: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  workoutDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.accent,
    marginTop: sw(2),
  },
});
