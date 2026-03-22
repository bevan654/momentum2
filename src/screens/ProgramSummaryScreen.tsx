import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useProgramStore, type ProgramDayExercise } from '../stores/useProgramStore';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'ProgramSummary'>;

export default function ProgramSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const { programId } = route.params;

  const userId = useAuthStore((s) => s.user?.id);
  const program = useProgramStore((s) => s.programs.find((p) => p.id === programId));
  const progressData = useProgramStore((s) => s.progressData);
  const fetchProgress = useProgramStore((s) => s.fetchProgress);
  const startProgram = useProgramStore((s) => s.startProgram);
  const abandonProgram = useProgramStore((s) => s.abandonProgram);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const getTodaysRoutine = useProgramStore((s) => s.getTodaysRoutine);
  const getDurationWeeks = useProgramStore((s) => s.getDurationWeeks);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const startFromProgram = useActiveWorkoutStore((s) => s.startFromProgram);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const isActive = program?.status === 'active';
  const isDraft = !isActive;
  const currentWeek = isActive ? getCurrentWeek() : 0;
  const todaysRoutine = isActive ? getTodaysRoutine() : null;
  const durationWeeks = getDurationWeeks(program);

  useEffect(() => {
    if (userId && programId) fetchProgress(programId, userId);
  }, [userId, programId]);

  // Build week completion grid
  const weekGrid = useMemo(() => {
    if (!program || !isActive || durationWeeks === 0) return [];
    const weeks: { week: number; days: { dow: number; completed: boolean }[] }[] = [];
    for (let w = 1; w <= durationWeeks; w++) {
      const days = program.days.map((d) => {
        const completed = progressData.some((p) => p.week === w && p.day_of_week === d.day_of_week);
        return { dow: d.day_of_week, completed };
      });
      weeks.push({ week: w, days });
    }
    return weeks;
  }, [program, isActive, progressData, durationWeeks]);

  // Progression stats
  const progressionStats = useMemo(() => {
    if (progressData.length < 2) return null;
    const firstWeek = progressData.filter((p) => p.week === 1);
    const lastWeek = progressData.filter((p) => p.week === currentWeek);
    if (firstWeek.length === 0 || lastWeek.length === 0) return null;

    const firstVol = firstWeek.reduce((s, p) => s + p.total_volume, 0);
    const lastVol = lastWeek.reduce((s, p) => s + p.total_volume, 0);
    const volChange = firstVol > 0 ? Math.round(((lastVol - firstVol) / firstVol) * 100) : 0;

    return { totalSessions: progressData.length, volChange };
  }, [progressData, currentWeek]);


  const handleStartToday = useCallback(() => {
    if (!todaysRoutine || !program) return;
    // Build a pseudo-routine for startFromProgram
    const pseudoRoutine = {
      id: `program-${program.id}-day-${todaysRoutine.day_of_week}`,
      exercises: todaysRoutine.exercises.map((e) => ({
        name: e.name,
        default_sets: e.default_sets,
        exercise_type: e.exercise_type,
      })),
    };
    startFromProgram(pseudoRoutine, catalogMap, prevMap, program.id, currentWeek);
    setTimeout(() => navigation.popToTop(), 300);
  }, [todaysRoutine, program, catalogMap, prevMap, currentWeek, startFromProgram, navigation]);

  const handleActivate = useCallback(async () => {
    if (!program) return;
    const { error } = await startProgram(program.id);
    if (error) Alert.alert('Error', error);
  }, [program, startProgram]);

  const handleAbandon = useCallback(() => {
    if (!program) return;
    Alert.alert('Abandon Program', `Stop "${program.name}"? Your workout history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: () => abandonProgram(program.id) },
    ]);
  }, [program, abandonProgram]);

  const formatDate = (date: string | null) => {
    if (!date) return '';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
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
          <Text style={styles.headerTitle}>Program Summary</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('CreateProgram', { programId })}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={ms(20)} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Program info */}
        <View style={styles.infoBlock}>
          <Text style={styles.programName}>{program.name}</Text>
          <Text style={styles.programSub}>
            {program.days.length} days/week
            {durationWeeks > 0 ? ` · ${durationWeeks} weeks` : ''}
            {program.start_date && program.end_date
              ? ` · ${formatDate(program.start_date)} – ${formatDate(program.end_date)}`
              : ''}
            {isActive ? ` · Week ${currentWeek}` : ''}
          </Text>
        </View>

        {/* Status badge + action */}
        {isDraft && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleActivate} activeOpacity={0.7}>
            <Ionicons name="play" size={ms(18)} color={colors.textOnAccent} />
            <Text style={styles.actionBtnText}>Start Program</Text>
          </TouchableOpacity>
        )}

        {isActive && todaysRoutine && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleStartToday} activeOpacity={0.7}>
            <Ionicons name="barbell-outline" size={ms(18)} color={colors.textOnAccent} />
            <Text style={styles.actionBtnText}>Start Today — {todaysRoutine.label}</Text>
          </TouchableOpacity>
        )}

        {isActive && !todaysRoutine && (
          <View style={styles.restDayBanner}>
            <Ionicons name="bed-outline" size={ms(18)} color={colors.textTertiary} />
            <Text style={styles.restDayText}>Rest Day</Text>
          </View>
        )}

        {/* Progression stats */}
        {progressionStats && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{progressionStats.totalSessions}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: progressionStats.volChange >= 0 ? '#34C759' : colors.accentRed }]}>
                {progressionStats.volChange >= 0 ? '+' : ''}{progressionStats.volChange}%
              </Text>
              <Text style={styles.statLabel}>Volume</Text>
            </View>
            {durationWeeks > 0 && (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{currentWeek}/{durationWeeks}</Text>
                <Text style={styles.statLabel}>Weeks</Text>
              </View>
            )}
          </View>
        )}

        {/* Weekly schedule */}
        <Text style={styles.sectionLabel}>Weekly Schedule</Text>
        {DAYS.map((day, i) => {
          const entry = program.days.find((d) => d.day_of_week === i);
          const jsDay = new Date().getDay();
          const todayDow = jsDay === 0 ? 6 : jsDay - 1;
          const isToday = isActive && i === todayDow;

          return (
            <View key={day} style={[styles.scheduleRow, isToday && styles.scheduleRowToday]}>
              <Text style={[styles.scheduleDayName, isToday && styles.scheduleDayNameToday]}>{day}</Text>
              {entry ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleRoutineName}>{entry.label}</Text>
                  <Text style={styles.scheduleRoutineDetail}>{entry.exercises.length} exercises</Text>
                </View>
              ) : (
                <Text style={styles.scheduleRest}>Rest</Text>
              )}
              {isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Today</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Week progress grid */}
        {weekGrid.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Progress</Text>
            {weekGrid.map(({ week, days }) => (
              <View key={week} style={styles.weekRow}>
                <Text style={[styles.weekLabel, week === currentWeek && styles.weekLabelCurrent]}>W{week}</Text>
                <View style={styles.weekDots}>
                  {days.map((d, i) => (
                    <View
                      key={i}
                      style={[
                        styles.weekDot,
                        d.completed && styles.weekDotComplete,
                        week === currentWeek && !d.completed && styles.weekDotCurrent,
                      ]}
                    >
                      {d.completed && <Ionicons name="checkmark" size={ms(10)} color={colors.textOnAccent} />}
                    </View>
                  ))}
                </View>
                {week <= currentWeek && (
                  <Text style={styles.weekCount}>
                    {days.filter((d) => d.completed).length}/{days.length}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* Abandon */}
        {isActive && (
          <TouchableOpacity style={styles.abandonBtn} onPress={handleAbandon} activeOpacity={0.7}>
            <Text style={styles.abandonText}>Abandon Program</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  editBtn: {
    width: sw(36),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(40),
  },

  // Program info
  infoBlock: {
    marginBottom: sw(16),
    gap: sw(4),
  },
  programName: {
    color: colors.textPrimary,
    fontSize: ms(20),
    fontFamily: Fonts.bold,
    lineHeight: ms(26),
  },
  programSub: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },

  // Action button
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: sw(12),
    paddingVertical: sw(14),
    gap: sw(8),
    marginBottom: sw(16),
  },
  actionBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
  },
  restDayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(12),
    paddingVertical: sw(14),
    gap: sw(8),
    marginBottom: sw(16),
  },
  restDayText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: sw(8),
    marginBottom: sw(16),
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
    gap: sw(2),
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.bold,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Section
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: sw(8),
    marginBottom: sw(10),
  },

  // Schedule
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: sw(14),
    paddingVertical: sw(10),
    marginBottom: sw(3),
    borderRadius: sw(6),
  },
  scheduleRowToday: {
    borderLeftWidth: sw(3),
    borderLeftColor: colors.accent,
  },
  scheduleDayName: {
    width: sw(36),
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  scheduleDayNameToday: {
    color: colors.accent,
  },
  scheduleRoutineName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },
  scheduleRoutineDetail: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  scheduleRest: {
    flex: 1,
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
  },
  todayBadge: {
    backgroundColor: colors.accent,
    borderRadius: sw(4),
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
  },
  todayBadgeText: {
    color: colors.textOnAccent,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },

  // Week progress
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(6),
    gap: sw(8),
  },
  weekLabel: {
    width: sw(28),
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  weekLabelCurrent: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  weekDots: {
    flexDirection: 'row',
    gap: sw(6),
    flex: 1,
  },
  weekDot: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(11),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDotComplete: {
    backgroundColor: colors.accent,
  },
  weekDotCurrent: {
    borderWidth: 1,
    borderColor: colors.accent + '50',
  },
  weekCount: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    width: sw(24),
    textAlign: 'right',
  },

  // Abandon
  abandonBtn: {
    marginTop: sw(24),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  abandonText: {
    color: colors.accentRed,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },

  // Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
  },
});
