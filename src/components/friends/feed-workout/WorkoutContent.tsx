import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import ExerciseMuscleThumb from '../../body/ExerciseMuscleThumb';
import type { ActivityFeedItem, FeedExerciseDetail } from '../../../lib/friendsDatabase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useRoutineStore } from '../../../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';
import { confirmReplaceWorkout } from '../../../utils/confirmReplaceWorkout';
import { formatVolume, postedExerciseType, targetKg, routineSetTargets } from './feedWorkoutHelpers';
import { formatHoursMinutes } from '../../../utils/formatDuration';
import { formatWorkoutDate } from '../../../utils/dateLabels';

/* ── Normal workout content ────────────────────────── */

export function WorkoutContent({ item, onDismiss }: { item: ActivityFeedItem; onDismiss: () => void }) {
  const displayName = item.profile.username || item.profile.email;
  const exercises = item.exercise_details || [];
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);

  const handleSaveRoutine = useCallback(async () => {
    if (!userId) return;
    const routineExercises = exercises.map((ex, i) => ({
      name: ex.name,
      exercise_order: i + 1,
      default_sets: ex.sets_count || 3,
      default_reps: ex.best_reps || 10,
      default_rest_seconds: 90,
      ...routineSetTargets(ex),
      exercise_type: postedExerciseType(ex.name, ex.exercise_type, catalogMap),
    }));
    const { error } = await createRoutine(
      userId,
      `${displayName}'s Workout`,
      routineExercises,
    );
    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Saved', 'Routine saved to My Routines');
    }
  }, [userId, exercises, displayName, createRoutine, catalogMap]);

  const handleTryWorkout = useCallback(() => {
    const ghostPrevMap: Record<string, { kg: number; reps: number }[]> = {};
    for (const ex of exercises) {
      if (ex.sets && ex.sets.length > 0) {
        ghostPrevMap[ex.name] = ex.sets.map((s) => ({ kg: targetKg(s.kg), reps: s.reps }));
      } else if (ex.best_kg > 0 || ex.best_reps > 0) {
        ghostPrevMap[ex.name] = Array.from({ length: ex.sets_count || 3 }, () => ({
          kg: targetKg(ex.best_kg),
          reps: ex.best_reps,
        }));
      }
    }
    const routine = {
      id: `feed-${item.id}`,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        default_sets: ex.sets_count || 3,
        exercise_type: postedExerciseType(ex.name, ex.exercise_type, catalogMap),
      })),
    };
    // Close this sheet first and start the workout once its close animation has
    // played, so the workout sheet doesn't open underneath it.
    confirmReplaceWorkout(() => {
      onDismiss();
      setTimeout(() => startFromRoutine(routine, catalogMap, ghostPrevMap, displayName), 350);
    });
  }, [item.id, exercises, startFromRoutine, catalogMap, onDismiss, displayName]);

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{displayName}'s Workout</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Workout info */}
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutDate}>{formatWorkoutDate(item.created_at)}</Text>
          <Text style={styles.workoutSub}>
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
            {'  \u00b7  '}{formatHoursMinutes(item.duration)}
            {'  \u00b7  '}{formatVolume(item.total_volume)}
          </Text>
        </View>

        {/* Exercise cards */}
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={i}
            exercise={ex}
            styles={styles}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRoutine} activeOpacity={0.8}>
            <Ionicons name="bookmark-outline" size={ms(13)} color={colors.accent} />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tryBtn} onPress={handleTryWorkout} activeOpacity={0.8}>
            <Ionicons name="flash" size={ms(13)} color={colors.textOnAccent} />
            <Text style={styles.tryBtnText}>Beat This</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

/* ── Normal workout detail ─────────────────────────── */

function ExerciseCard({
  exercise: ex,
  styles,
}: {
  exercise: FeedExerciseDetail;
  styles: ReturnType<typeof createStyles>;
}) {
  const sets = ex.sets?.length > 0
    ? [...ex.sets].sort((a, b) => a.set_number - b.set_number)
    : [];

  const repRange = useMemo(() => {
    if (sets.length === 0) return `${ex.best_reps}`;
    const reps = sets.map((s) => s.reps).filter((r) => r > 0);
    if (reps.length === 0) return '0';
    const min = Math.min(...reps);
    const max = Math.max(...reps);
    return min === max ? `${min}` : `${min}-${max}`;
  }, [sets, ex.best_reps]);

  return (
    <View style={styles.exerciseCard}>
      {/* Exercise header */}
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseHeaderLeft}>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {ex.name.replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <Text style={styles.exerciseSummary}>
            {ex.sets_count} sets · {repRange} reps
          </Text>
        </View>

        <ExerciseMuscleThumb exercise={ex} width={sw(44)} height={sw(52)} style={styles.bodyMapClip} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Column headers */}
      <View style={styles.colHeaders}>
        <Text style={[styles.colHeader, styles.colSet]}>SET</Text>
        <Text style={[styles.colHeader, styles.colVal]}>KG</Text>
        <Text style={[styles.colHeader, styles.colVal]}>REPS</Text>
      </View>

      {/* Set rows */}
      {sets.length > 0 ? (
        sets.map((s, si) => (
          <View key={si} style={styles.setRow}>
            <Text style={[styles.setNum, styles.colSet]}>{si + 1}</Text>
            <Text style={[styles.cellVal, styles.colVal]}>{s.kg > 0 ? s.kg : '\u2014'}</Text>
            <Text style={[styles.cellVal, styles.colVal]}>{s.reps > 0 ? s.reps : '\u2014'}</Text>
          </View>
        ))
      ) : (
        Array.from({ length: ex.sets_count }, (_, si) => (
          <View key={si} style={styles.setRow}>
            <Text style={[styles.setNum, styles.colSet]}>{si + 1}</Text>
            <Text style={[styles.cellVal, styles.colVal]}>{ex.best_kg > 0 ? ex.best_kg : '\u2014'}</Text>
            <Text style={[styles.cellVal, styles.colVal]}>{ex.best_reps > 0 ? ex.best_reps : '\u2014'}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: {
    paddingHorizontal: sw(16),
    paddingTop: sw(4),
    paddingBottom: sw(8),
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(100),
  },

  /* Workout info */
  workoutInfo: {
    marginBottom: sw(16),
    gap: sw(4),
    alignItems: 'center',
  },
  workoutDate: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
  workoutSub: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },

  /* Exercise card */
  exerciseCard: {
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: sw(2),
    borderColor: colors.cardBorder,
    padding: sw(12),
    marginBottom: sw(10),
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseHeaderLeft: {
    flex: 1,
    gap: sw(4),
    marginRight: sw(10),
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
    flexShrink: 1,
  },
  exerciseSummary: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(13),
  },
  bodyMapClip: {
    overflow: 'hidden',
    borderRadius: sw(8),
    opacity: 0.85,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(10),
  },

  /* Set table */
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(2),
  },
  colHeader: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  colSet: {
    width: sw(30),
  },
  colVal: {
    flex: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  setNum: {
    color: colors.textSecondary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  cellVal: {
    color: colors.textPrimary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },

  /* Footer */
  footer: {
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
    paddingBottom: sw(32),
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  footerRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(5),
    paddingVertical: sw(12),
    borderRadius: sw(10),
    borderWidth: 1,
    borderColor: colors.accent,
  },
  saveBtnText: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
  tryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(5),
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.accent,
  },
  tryBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
});
