import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useProgramStore } from '../stores/useProgramStore';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'ProgramProgress'>;

export default function ProgramProgressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const { programId } = route.params;

  const userId = useAuthStore((s) => s.user?.id);
  const program = useProgramStore((s) => s.programs.find((p) => p.id === programId));
  const progressData = useProgramStore((s) => s.progressData);
  const fetchProgress = useProgramStore((s) => s.fetchProgress);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const getDurationWeeks = useProgramStore((s) => s.getDurationWeeks);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const isActive = program?.status === 'active';
  const currentWeek = isActive ? getCurrentWeek() : 0;
  const durationWeeks = getDurationWeeks(program);

  useEffect(() => {
    if (userId && programId) fetchProgress(programId, userId);
  }, [userId, programId]);

  // Build scheduled day-of-week set
  const scheduledDays = useMemo(() => {
    if (!program) return new Set<number>();
    return new Set(program.days.map((d) => d.day_of_week));
  }, [program]);

  // Build calendar grid: each week → 7 day cells
  const calendarGrid = useMemo(() => {
    if (!program || !program.start_date) return [];

    const startDate = new Date(program.start_date);
    // Align to Monday
    const jsDay = startDate.getDay();
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + mondayOffset);

    const totalWeeks = durationWeeks > 0 ? durationWeeks : (isActive ? currentWeek : 4);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeks: {
      weekNum: number;
      days: {
        date: Date;
        dow: number; // 0=Mon ... 6=Sun
        isScheduled: boolean;
        isTrained: boolean;
        isToday: boolean;
        isPast: boolean;
        isMissed: boolean;
        isInProgram: boolean;
      }[];
    }[] = [];

    // Build a set of trained dates for quick lookup
    const trainedDates = new Set<string>();
    for (const p of progressData) {
      const d = new Date(p.created_at);
      trainedDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }

    const programStart = new Date(program.start_date);
    programStart.setHours(0, 0, 0, 0);
    const programEnd = program.end_date ? new Date(program.end_date) : null;
    if (programEnd) programEnd.setHours(23, 59, 59, 999);

    for (let w = 0; w < totalWeeks; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + w * 7 + d);
        date.setHours(0, 0, 0, 0);

        const dow = d; // 0=Mon ... 6=Sun
        const isScheduled = scheduledDays.has(dow);
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const isTrained = trainedDates.has(dateKey);
        const isToday = date.getTime() === today.getTime();
        const isPast = date < today;
        const isInProgram = date >= programStart && (!programEnd || date <= programEnd);
        const isMissed = isScheduled && isPast && !isTrained && isInProgram && !isToday;

        days.push({ date, dow, isScheduled, isTrained, isToday, isPast, isMissed, isInProgram });
      }
      weeks.push({ weekNum: w + 1, days });
    }

    return weeks;
  }, [program, durationWeeks, isActive, currentWeek, progressData, scheduledDays]);

  // Stats
  const stats = useMemo(() => {
    const totalTrained = progressData.length;
    const totalScheduled = calendarGrid.reduce((sum, week) =>
      sum + week.days.filter((d) => d.isScheduled && d.isPast && d.isInProgram).length, 0);
    const totalMissed = calendarGrid.reduce((sum, week) =>
      sum + week.days.filter((d) => d.isMissed).length, 0);
    const totalVolume = progressData.reduce((sum, p) => sum + p.total_volume, 0);
    const totalDuration = progressData.reduce((sum, p) => sum + p.duration, 0);
    const adherence = totalScheduled > 0 ? Math.round((totalTrained / totalScheduled) * 100) : 0;

    // Volume trend
    let volTrend = 0;
    if (progressData.length >= 2) {
      const firstWeek = progressData.filter((p) => p.week === 1);
      const lastWeek = progressData.filter((p) => p.week === currentWeek);
      const firstVol = firstWeek.reduce((s, p) => s + p.total_volume, 0);
      const lastVol = lastWeek.reduce((s, p) => s + p.total_volume, 0);
      if (firstVol > 0) volTrend = Math.round(((lastVol - firstVol) / firstVol) * 100);
    }

    return { totalTrained, totalMissed, adherence, totalVolume, totalDuration, volTrend };
  }, [progressData, calendarGrid, currentWeek]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };


  if (!program) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Program not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Program Progress</Text>
          <View style={{ width: sw(36) }} />
        </View>

        {/* Program info */}
        <View style={styles.infoBlock}>
          <Text style={styles.programName}>{program.name}</Text>
          <Text style={styles.programSub}>
            {isActive ? `Week ${currentWeek} of ${durationWeeks || '?'}` : program.status.toUpperCase()}
            {' · '}{program.days.length} days/week
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalTrained}</Text>
            <Text style={styles.statLabel}>Trained</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: stats.totalMissed > 0 ? colors.accentRed : colors.textPrimary }]}>
              {stats.totalMissed}
            </Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: stats.adherence >= 80 ? '#34C759' : stats.adherence >= 50 ? colors.accentOrange : colors.accentRed }]}>
              {stats.adherence}%
            </Text>
            <Text style={styles.statLabel}>Adherence</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: stats.volTrend >= 0 ? '#34C759' : colors.accentRed }]}>
              {stats.volTrend >= 0 ? '+' : ''}{stats.volTrend}%
            </Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
        </View>

        {stats.totalDuration > 0 && (
          <View style={styles.totalRow}>
            <View style={styles.totalItem}>
              <Ionicons name="time-outline" size={ms(14)} color={colors.textTertiary} />
              <Text style={styles.totalText}>{formatDuration(stats.totalDuration)} total</Text>
            </View>
            <View style={styles.totalItem}>
              <Ionicons name="barbell-outline" size={ms(14)} color={colors.textTertiary} />
              <Text style={styles.totalText}>{(stats.totalVolume / 1000).toFixed(1)}t volume</Text>
            </View>
          </View>
        )}

        {/* Calendar */}
        <Text style={styles.sectionLabel}>Calendar</Text>

        {/* Day headers */}
        <View style={styles.calendarHeader}>
          {DAYS.map((d) => (
            <Text key={d} style={styles.calendarDayHeader}>{d[0]}</Text>
          ))}
        </View>

        {/* Week rows */}
        {calendarGrid.map(({ weekNum, days }) => (
          <View key={weekNum} style={styles.calendarRow}>
            <Text style={[styles.weekLabel, weekNum === currentWeek && styles.weekLabelCurrent]}>
              W{weekNum}
            </Text>
            <View style={styles.calendarWeek}>
              {days.map((day, i) => {
                let cellStyle = styles.calendarCell;
                let cellInnerStyle = [styles.calendarCellInner];
                let textColor = colors.textTertiary;

                if (!day.isInProgram) {
                  // Outside program range
                  cellInnerStyle.push(styles.cellOutside);
                  textColor = colors.textTertiary + '40';
                } else if (day.isTrained) {
                  cellInnerStyle.push(styles.cellTrained);
                  textColor = colors.textOnAccent;
                } else if (day.isMissed) {
                  cellInnerStyle.push(styles.cellMissed);
                  textColor = '#fff';
                } else if (day.isToday) {
                  cellInnerStyle.push(styles.cellToday);
                  textColor = colors.accent;
                } else if (day.isScheduled) {
                  cellInnerStyle.push(styles.cellScheduled);
                  textColor = colors.textSecondary;
                }

                return (
                  <View key={i} style={cellStyle}>
                    <View style={cellInnerStyle}>
                      {day.isTrained ? (
                        <Ionicons name="checkmark" size={ms(12)} color={textColor} />
                      ) : day.isMissed ? (
                        <Ionicons name="close" size={ms(12)} color={textColor} />
                      ) : (
                        <Text style={[styles.calendarCellText, { color: textColor }]}>
                          {day.date.getDate()}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Trained</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accentRed + '60' }]} />
            <Text style={styles.legendText}>Missed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { borderWidth: 1, borderColor: colors.accent }]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.surface }]} />
            <Text style={styles.legendText}>Scheduled</Text>
          </View>
        </View>

        {/* Recent workouts */}
        {progressData.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent Workouts</Text>
            {[...progressData].reverse().slice(0, 8).map((entry) => {
              const d = new Date(entry.created_at);
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const dateStr = `${dayNames[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;

              return (
                <View key={entry.workout_id} style={styles.workoutRow}>
                  <View style={styles.workoutInfo}>
                    <Text style={styles.workoutDate}>{dateStr}</Text>
                    <Text style={styles.workoutMeta}>
                      W{entry.week} · {entry.exercises.length} exercises · {entry.total_sets} sets
                    </Text>
                  </View>
                  <View style={styles.workoutStats}>
                    <Text style={styles.workoutVolume}>{(entry.total_volume / 1000).toFixed(1)}t</Text>
                    <Text style={styles.workoutDuration}>{formatDuration(entry.duration)}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: sw(40) }} />
      </ScrollView>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────── */

const createStyles = (colors: ThemeColors, topInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: sw(20), paddingBottom: sw(20) },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(16),
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.bold,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: sw(40) },
  emptyText: { color: colors.textTertiary, fontSize: ms(14), fontFamily: Fonts.medium },
  infoBlock: { marginBottom: sw(16) },
  programName: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    marginBottom: sw(4),
  },
  programSub: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
  },

  /* Stats grid */
  statsGrid: {
    flexDirection: 'row',
    gap: sw(8),
    marginBottom: sw(12),
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(10),
    alignItems: 'center',
    gap: sw(2),
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  totalRow: {
    flexDirection: 'row',
    gap: sw(16),
    marginBottom: sw(16),
  },
  totalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  totalText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
  },

  /* Calendar */
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    marginBottom: sw(10),
    marginTop: sw(8),
  },
  calendarHeader: {
    flexDirection: 'row',
    marginLeft: sw(28),
    marginBottom: sw(4),
  },
  calendarDayHeader: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(4),
  },
  weekLabel: {
    width: sw(28),
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
  },
  weekLabelCurrent: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  calendarWeek: {
    flex: 1,
    flexDirection: 'row',
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sw(2),
  },
  calendarCellInner: {
    width: sw(26),
    height: sw(26),
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarCellText: {
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  cellTrained: {
    backgroundColor: colors.accent,
  },
  cellMissed: {
    backgroundColor: colors.accentRed + '60',
  },
  cellToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cellScheduled: {
    backgroundColor: colors.surface,
  },
  cellOutside: {
    opacity: 0.3,
  },

  /* Legend */
  legend: {
    flexDirection: 'row',
    gap: sw(12),
    marginTop: sw(8),
    marginBottom: sw(8),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  legendDot: {
    width: sw(10),
    height: sw(10),
  },
  legendText: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
  },

  /* Recent workouts */
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  workoutInfo: { flex: 1, gap: sw(2) },
  workoutDate: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  workoutMeta: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  workoutStats: { alignItems: 'flex-end', gap: sw(2) },
  workoutVolume: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
  },
  workoutDuration: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
});
