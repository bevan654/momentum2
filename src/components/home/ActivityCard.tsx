import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWorkoutStore, type WorkoutWithDetails } from '../../stores/useWorkoutStore';
import { useStreakStore } from '../../stores/useStreakStore';
import WorkoutSummaryModal from '../workout-sheet/WorkoutSummaryModal';
import { toLocalDateString } from '../../utils/localDate';
import { DAY_LABELS, MONTH_NAMES, type GridCell, buildMonthCells } from './activity/activityCalendarUtils';
import { YearViewModal } from './activity/YearViewModal';

/* ─── Memoized Calendar Cell ─────────────────────────── */

const CalendarCell = React.memo(function CalendarCell({
  day, dateKey, hasWorkout, isToday, isSelected, onPress, styles,
}: {
  day: number;
  dateKey: string;
  hasWorkout: boolean;
  isToday: boolean;
  isSelected: boolean;
  onPress: (key: string) => void;
  styles: any;
}) {
  return (
    <TouchableOpacity style={styles.dayCell} onPress={() => onPress(dateKey)} activeOpacity={0.6}>
      <View style={[
        styles.dayCellInner,
        hasWorkout && styles.workoutCellInner,
        isToday && styles.todayCellInner,
        isSelected && styles.selectedCellInner,
      ]}>
        <Text style={[styles.dayText, hasWorkout && styles.workoutDayText, isToday && styles.todayText, isSelected && styles.selectedText]}>{day}</Text>
        {hasWorkout && <View style={styles.workoutDot} />}
      </View>
    </TouchableOpacity>
  );
});

/* ─── Main Component ─────────────────────────────────── */

export default function ActivityCard() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const today = new Date();
  const todayKey = toLocalDateString(today);
  const [showYearView, setShowYearView] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const workoutMap = useMemo(() => {
    const map = new Map<string, WorkoutWithDetails>();
    for (const w of workouts) {
      const d = new Date(w.created_at);
      const key = toLocalDateString(d);
      if (!map.has(key)) map.set(key, w);
    }
    return map;
  }, [workouts]);

  const selectedWorkout = selectedDayKey ? workoutMap.get(selectedDayKey) ?? null : null;

  const monthLabel = useMemo(() => {
    return `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  }, [viewYear, viewMonth]);

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const gridRows = useMemo(() => {
    const cells = buildMonthCells(viewYear, viewMonth).cells;
    const rows: GridCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const row = cells.slice(i, i + 7);
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [viewYear, viewMonth]);

  const goToPrevMonth = useCallback(() => {
    setSelectedDayKey(null);
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    setSelectedDayKey(null);
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth, isCurrentMonth]);

  const handleCellPress = useCallback((key: string) => {
    if (!workoutMap.has(key)) { setSelectedDayKey(null); return; }
    setSelectedDayKey((prev) => (prev === key ? null : key));
  }, [workoutMap]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="calendar-outline" size={ms(13)} color={colors.accent} />
          </View>
          <Text style={styles.title}>Activity</Text>
        </View>
        <TouchableOpacity onPress={() => setShowYearView(true)} activeOpacity={0.6} hitSlop={8}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Month nav */}
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
          <Ionicons name="chevron-forward" size={ms(18)} color={isCurrentMonth ? colors.textTertiary + '40' : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Streak bar */}
      <View style={styles.streakRow}>
        <View style={styles.streakItem}>
          <Ionicons name="flame" size={ms(14)} color={colors.accent} />
          <Text style={styles.streakValue}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Ionicons name="trophy-outline" size={ms(13)} color={colors.textTertiary} />
          <Text style={styles.streakValue}>{longestStreak}</Text>
          <Text style={styles.streakLabel}>best</Text>
        </View>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.weekRow}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.weekCell}>
            <Text style={styles.weekLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {gridRows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((cell, ci) => {
              if (!cell) return <View key={`empty-${ri}-${ci}`} style={styles.dayCell} />;
              return (
                <CalendarCell
                  key={cell.key}
                  day={cell.day}
                  dateKey={cell.key}
                  hasWorkout={workoutMap.has(cell.key)}
                  isToday={cell.key === todayKey}
                  isSelected={cell.key === selectedDayKey}
                  onPress={handleCellPress}
                  styles={styles}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Workout detail modal */}
      {selectedWorkout && (
        <WorkoutSummaryModal
          mode="historical"
          data={selectedWorkout}
          onDismiss={() => setSelectedDayKey(null)}
        />
      )}

      {/* Year view modal */}
      <YearViewModal
        visible={showYearView}
        onClose={() => setShowYearView(false)}
        workoutMap={workoutMap}
        todayKey={todayKey}
      />
    </View>
  );
}

/* ─── Main Styles ────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(14),
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sw(10),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  viewAllText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },

  /* Calendar */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(10),
    marginBottom: sw(6),
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
    minWidth: sw(110),
    textAlign: 'center',
  },

  /* Streak bar */
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(12),
    marginBottom: sw(8),
  },
  streakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  streakValue: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  streakLabel: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  streakDivider: {
    width: 1,
    height: sw(14),
    backgroundColor: colors.textTertiary + '30',
  },

  weekRow: {
    flexDirection: 'row',
    marginBottom: sw(6),
  },
  weekCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  grid: {
    flex: 1,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sw(2),
  },
  dayCellInner: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sw(8),
    borderWidth: 1,
    borderColor: colors.textTertiary + '15',
  },
  workoutCellInner: {
    backgroundColor: colors.accent + '18',
    borderColor: colors.accent + '30',
  },
  todayCellInner: { borderColor: colors.accent + '40' },
  selectedCellInner: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + '15',
  },
  dayText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  workoutDayText: {
    color: colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  todayText: { color: colors.accent, fontFamily: Fonts.bold },
  selectedText: { color: colors.accent, fontFamily: Fonts.bold },
  workoutDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.accent,
    marginTop: sw(3),
  },
});
