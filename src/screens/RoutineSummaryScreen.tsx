import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import ExerciseMuscleThumb from '../components/body/ExerciseMuscleThumb';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import { confirmReplaceWorkout } from '../utils/confirmReplaceWorkout';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'RoutineSummary'>;

export default function RoutineSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const { routineId } = route.params;

  const routine = useRoutineStore((s) => s.routines.find((r) => r.id === routineId));
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatRest = useCallback((s: number) => {
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return rem > 0 ? `${m}m${rem}s` : `${m}m`;
    }
    return `${s}s`;
  }, []);

  const handleStart = useCallback(() => {
    if (!routine) return;
    // Dismiss the transparent-modal stack BEFORE flipping sheetVisible — iOS rejects
    // presenting ActiveWorkoutSheet's Modal while another modal is still on top.
    confirmReplaceWorkout(() => {
      navigation.popToTop();
      setTimeout(() => startFromRoutine(routine, catalogMap, prevMap), 350);
    });
  }, [routine, catalogMap, prevMap, startFromRoutine, navigation]);

  // Defer heavy content until after the navigation transition fully settles
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(timer);
  }, []);

  if (!routine) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Routine Summary</Text>
          <View style={styles.editBtn} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Routine not found</Text>
        </View>
      </View>
    );
  }

  const daysLabel = routine.days.length > 0
    ? routine.days.map((d) => DAY_NAMES[d]).join(', ')
    : null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.editBtn}>
            <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Routine Summary</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('CreateRoutine', { routineId })}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={ms(20)} color={colors.accent} />
          </TouchableOpacity>
        </View>
        {/* Routine info */}
        <View style={styles.routineInfo}>
          <Text style={styles.routineName}>{routine.name}</Text>
          <Text style={styles.routineSub}>
            {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
            {daysLabel ? `  ·  ${daysLabel}` : ''}
          </Text>
        </View>

        {/* Skeleton placeholders while loading */}
        {!ready && routine.exercises.map((_, i) => (
          <View key={`skel-${i}`} style={styles.exerciseCard}>
            <View style={styles.skelBar} />
            <View style={styles.skelBarShort} />
            <View style={{ height: sw(8) }} />
            <View style={styles.skelRow}>
              <View style={styles.skelCell} />
              <View style={styles.skelCell} />
              <View style={styles.skelCell} />
            </View>
            <View style={styles.skelRow}>
              <View style={styles.skelCell} />
              <View style={styles.skelCell} />
              <View style={styles.skelCell} />
            </View>
          </View>
        ))}

        {/* Exercise cards — deferred until transition completes */}
        {ready && routine.exercises.map((ex, i) => {
          const reps = ex.set_reps || Array(ex.default_sets).fill(ex.default_reps);
          const weights = ex.set_weights || Array(ex.default_sets).fill(0);
          const prev = prevMap[ex.name] || [];
          const minR = Math.min(...reps);
          const maxR = Math.max(...reps);
          const repRange = minR === maxR ? `${minR}` : `${minR}-${maxR}`;

          return (
            <View key={i} style={styles.exerciseCard}>
              {/* Exercise header */}
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderLeft}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {ex.name.replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.exerciseSummary}>
                    {reps.length} sets · {repRange} reps · {formatRest(ex.default_rest_seconds)}
                  </Text>
                </View>

                <ExerciseMuscleThumb exercise={{ name: ex.name }} width={sw(44)} height={sw(52)} style={styles.bodyMapClip} />
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Column headers */}
              <View style={styles.colHeaders}>
                <Text style={[styles.colHeader, styles.colSet]}>SET</Text>
                <Text style={[styles.colHeader, styles.colPrev]}>PREV</Text>
                <Text style={[styles.colHeader, styles.colVal]}>KG</Text>
                <Text style={[styles.colHeader, styles.colVal]}>REPS</Text>
              </View>

              {/* Set rows */}
              {reps.map((r: number, si: number) => {
                const p = prev[si];
                const w = weights[si] || 0;
                return (
                  <View key={si} style={styles.setRow}>
                    <Text style={[styles.setNum, styles.colSet]}>{si + 1}</Text>
                    <Text style={[styles.prevText, styles.colPrev]}>
                      {p ? `${p.kg}×${p.reps}` : '—'}
                    </Text>
                    <Text style={[styles.cellVal, styles.colVal]}>{w > 0 ? w : '—'}</Text>
                    <Text style={[styles.cellVal, styles.colVal]}>{r}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Pinned footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.8}>
          <Ionicons name="play" size={ms(22)} color={colors.textOnAccent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(80),
  },

  /* Routine info */
  routineInfo: {
    marginBottom: sw(16),
    gap: sw(4),
  },
  routineName: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
  },
  routineSub: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },

  /* Skeleton */
  skelBar: {
    height: sw(14),
    width: '60%',
    backgroundColor: colors.cardBorder,
    borderRadius: sw(4),
    marginBottom: sw(8),
  },
  skelBarShort: {
    height: sw(10),
    width: '35%',
    backgroundColor: colors.cardBorder,
    borderRadius: sw(4),
  },
  skelRow: {
    flexDirection: 'row',
    gap: sw(10),
    marginBottom: sw(6),
  },
  skelCell: {
    flex: 1,
    height: sw(12),
    backgroundColor: colors.cardBorder,
    borderRadius: sw(4),
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
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  exerciseSummary: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
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
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  colSet: {
    width: sw(30),
  },
  colPrev: {
    width: sw(60),
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
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  prevText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  cellVal: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: sw(32),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  startBtn: {
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },

  /* Empty state */
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
