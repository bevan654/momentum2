import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useRoutineStore, type Routine } from '../../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useProgramStore, type ProgramDayExercise } from '../../stores/useProgramStore';
import { hideRecoveryOverlay } from '../../lib/navigationBridge';

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function TodayScheduled({ programHeader, onPreview, onOpenPlans }: { programHeader?: React.ReactNode; onPreview?: (routine: Routine) => void; onOpenPlans?: () => void }) {
  const routines = useRoutineStore((s) => s.routines);
  const programs = useProgramStore((s) => s.programs);
  const activeProgram = useProgramStore((s) => s.activeProgram);
  const getTodaysRoutine = useProgramStore((s) => s.getTodaysRoutine);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const startFromProgram = useActiveWorkoutStore((s) => s.startFromProgram);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const jsDay = new Date().getDay();
  const todayDow = jsDay === 0 ? 6 : jsDay - 1;

  const programToday = activeProgram ? getTodaysRoutine() : null;
  const week = activeProgram ? getCurrentWeek() : 0;
  const durationWeeks = activeProgram ? useProgramStore.getState().getDurationWeeks(activeProgram) : 0;
  const todayRoutines = routines.filter((r) => r.days.includes(todayDow));

  const programDaysPerWeek = activeProgram?.days.length ?? 0;
  const sortedDays = activeProgram ? [...activeProgram.days].sort((a, b) => a.day_of_week - b.day_of_week) : [];
  const dayNumber = programToday ? sortedDays.findIndex((d) => d.day_of_week === programToday.day_of_week) + 1 : 0;

  const visibleProgram = programToday && activeProgram && !skipped.has(`program-${activeProgram.id}`);
  const visibleRoutines = todayRoutines.filter((r) => !skipped.has(`routine-${r.id}`));
  const totalVisible = (visibleProgram ? 1 : 0) + visibleRoutines.length;

  return (
    <View style={styles.todaySection}>
      <View style={styles.todaySectionHeader}>
        <Text style={styles.todaySectionTitle}>
          TODAY'S WORKOUT
        </Text>
        {totalVisible > 0 && (
          <View style={styles.todayCount}>
            <Text style={styles.todayCountText}>{totalVisible}</Text>
          </View>
        )}
      </View>

      {/* Empty state — nothing scheduled for today, no active program */}
      {totalVisible === 0 && !activeProgram && (
        <TouchableOpacity style={styles.emptyState} activeOpacity={0.7} onPress={onOpenPlans}>
          {programs.length > 0 || routines.length > 0 ? (
            <>
              <Ionicons name="bed-outline" size={ms(24)} color={colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>Rest Day</Text>
              <Text style={styles.emptyStateSub}>No workout scheduled for {DAYS_FULL[todayDow]}</Text>
              <View style={styles.emptyStateBtn}>
                <Text style={styles.emptyStateBtnText}>View Plans</Text>
                <Ionicons name="chevron-forward" size={ms(12)} color={colors.accent} />
              </View>
            </>
          ) : (
            <>
              <Ionicons name="clipboard-outline" size={ms(24)} color={colors.textTertiary} />
              <Text style={styles.emptyStateTitle}>No workout scheduled</Text>
              <Text style={styles.emptyStateSub}>Create a routine or program to see your workouts here</Text>
              <View style={styles.emptyStateBtn}>
                <Text style={styles.emptyStateBtnText}>View Plans</Text>
                <Ionicons name="chevron-forward" size={ms(12)} color={colors.accent} />
              </View>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Program workout */}
      {activeProgram && programToday && !skipped.has(`program-${activeProgram.id}`) && (
        <View style={styles.todayProgramBlock}>
          {programHeader}
          {programHeader && <View style={styles.todayProgramDivider} />}
          <Text style={styles.todayTitle}>{programToday.label}</Text>
          <Text style={styles.todayExSummary}>
            Day {dayNumber} of {programDaysPerWeek} · {programToday.exercises.length} exercise{programToday.exercises.length !== 1 ? 's' : ''}
          </Text>

          <View style={styles.todayBtnRow}>
            <TouchableOpacity
              style={styles.todaySkipBtn}
              activeOpacity={0.7}
              onPress={() => setSkipped((prev) => new Set(prev).add(`program-${activeProgram.id}`))}
            >
              <Text style={styles.todaySkipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.todaySummaryBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (!onPreview) return;
                const now = new Date().toISOString();
                onPreview({
                  id: `program-${activeProgram.id}-day-${programToday.day_of_week}`,
                  name: programToday.label,
                  days: [programToday.day_of_week],
                  exercises: programToday.exercises.map((e: ProgramDayExercise, i: number) => ({
                    name: e.name,
                    exercise_order: e.exercise_order ?? i,
                    default_sets: e.default_sets,
                    default_reps: e.default_reps,
                    default_rest_seconds: e.default_rest_seconds,
                    set_reps: e.set_reps || Array(e.default_sets).fill(e.default_reps),
                    set_weights: e.set_weights || Array(e.default_sets).fill(0),
                    exercise_type: e.exercise_type,
                  })),
                  created_at: now,
                  updated_at: now,
                });
              }}
            >
              <Text style={styles.todaySummaryText}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.todayStartBtn}
              activeOpacity={0.7}
              onPress={() => {
                const pseudoRoutine = {
                  id: `program-${activeProgram.id}-day-${programToday.day_of_week}`,
                  exercises: programToday.exercises.map((e: ProgramDayExercise) => ({
                    name: e.name,
                    default_sets: e.default_sets,
                    exercise_type: e.exercise_type,
                  })),
                };
                hideRecoveryOverlay();
                startFromProgram(pseudoRoutine, catalogMap, prevMap, activeProgram.id, week);
              }}
            >
              <Ionicons name="play" size={ms(14)} color={colors.textOnAccent} />
              <Text style={styles.todayStartText}>Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Program rest day */}
      {activeProgram && !programToday && todayRoutines.length === 0 && (
        <View style={styles.todayCard}>
          <View style={styles.todayRestBlock}>
            <Ionicons name="bed-outline" size={ms(28)} color={colors.textTertiary} />
            <Text style={styles.todayRestText}>Rest Day</Text>
            <Text style={styles.todayRestSub}>No workout scheduled for today</Text>
          </View>
        </View>
      )}

      {/* Routines scheduled for today */}
      {todayRoutines.filter((r) => !skipped.has(`routine-${r.id}`)).map((routine) => (
        <View key={routine.id} style={[styles.todayCard, styles.todayCardRoutine]}>
          <View style={styles.todayHeader}>
            <View style={[styles.todaySourceBadge, styles.todaySourceBadgeRoutine]}>
              <Text style={[styles.todaySourceBadgeText, styles.todaySourceBadgeTextRoutine]}>ROUTINE</Text>
            </View>
          </View>

          <Text style={styles.todayTitle}>{routine.name}</Text>
          <Text style={styles.todayExSummary}>
            {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
          </Text>

          <View style={styles.todayBtnRow}>
            <TouchableOpacity
              style={styles.todaySkipBtn}
              activeOpacity={0.7}
              onPress={() => setSkipped((prev) => new Set(prev).add(`routine-${routine.id}`))}
            >
              <Text style={styles.todaySkipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.todaySummaryBtn}
              activeOpacity={0.7}
              onPress={() => onPreview?.(routine)}
            >
              <Text style={styles.todaySummaryText}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.todayStartBtn}
              activeOpacity={0.7}
              onPress={() => {
                hideRecoveryOverlay();
                startFromRoutine(routine, catalogMap, prevMap);
              }}
            >
              <Ionicons name="play" size={ms(14)} color={colors.textOnAccent} />
              <Text style={styles.todayStartText}>Start</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

export default React.memo(TodayScheduled);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  todaySection: {
    gap: sw(6),
  },
  todaySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  todaySectionTitle: {
    color: colors.textPrimary,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  todayCount: {
    backgroundColor: colors.surface,
    width: sw(16),
    height: sw(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayCountText: {
    color: colors.textPrimary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
  },
  todayCard: {
    gap: sw(3),
  },
  todayProgramBlock: {
    backgroundColor: colors.surface,
    padding: sw(12),
    gap: sw(3),
  },
  todayProgramDivider: {
    height: 0.5,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(6),
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    marginBottom: sw(2),
  },
  todaySourceBadge: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: sw(5),
    paddingVertical: sw(1),
  },
  todaySourceBadgeText: {
    color: colors.accent,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  todaySourceBadgeRoutine: {
    backgroundColor: colors.accentOrange + '20',
  },
  todaySourceBadgeTextRoutine: {
    color: colors.accentOrange,
  },
  todayTitle: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  todayMeta: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  todayBtnRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginTop: sw(8),
  },
  todayExSummary: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  todaySkipBtn: {
    paddingVertical: sw(8),
    paddingHorizontal: sw(12),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  todaySkipText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
  },
  todaySummaryBtn: {
    paddingVertical: sw(8),
    paddingHorizontal: sw(12),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  todaySummaryText: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
  },
  todayStartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: sw(8),
    gap: sw(5),
  },
  todayStartText: {
    color: colors.textOnAccent,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  todayRestBlock: {
    alignItems: 'center',
    paddingVertical: sw(12),
    gap: sw(4),
    backgroundColor: colors.surface,
  },
  todayRestText: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  todayRestSub: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  todayProgramName: {
    flex: 1,
    color: colors.accent,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
  },
  todayDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(6),
  },
  todayCardRoutine: {
    backgroundColor: colors.surface,
    padding: sw(12),
  },
  emptyState: {
    backgroundColor: colors.surface,
    padding: sw(16),
    alignItems: 'center',
    gap: sw(4),
  },
  emptyStateTitle: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    marginTop: sw(4),
  },
  emptyStateSub: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    marginTop: sw(6),
  },
  emptyStateBtnText: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
});
