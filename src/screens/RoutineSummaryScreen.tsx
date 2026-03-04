import React, { useMemo, useCallback } from 'react';
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
import { useThemeStore } from '../stores/useThemeStore';
import Body, { type ExtendedBodyPart } from '../components/BodyHighlighter';
import { toSlug, ALL_SLUGS } from '../utils/muscleVolume';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

/* ─── Body map helpers ─────────────── */

const CATEGORY_SLUGS: Record<string, string[]> = {
  Chest: ['chest'], Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids', 'rear-deltoids'], Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'], Core: ['abs', 'obliques'],
};

const SLUG_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  chest: { y: 0.32, side: 'front' }, deltoids: { y: 0.26, side: 'front' },
  'rear-deltoids': { y: 0.26, side: 'back' }, biceps: { y: 0.37, side: 'front' },
  triceps: { y: 0.37, side: 'back' }, forearm: { y: 0.48, side: 'front' },
  abs: { y: 0.44, side: 'front' }, obliques: { y: 0.44, side: 'front' },
  'upper-back': { y: 0.32, side: 'back' }, 'lower-back': { y: 0.44, side: 'back' },
  trapezius: { y: 0.23, side: 'back' }, quadriceps: { y: 0.66, side: 'front' },
  hamstring: { y: 0.66, side: 'back' }, gluteal: { y: 0.53, side: 'back' },
  calves: { y: 0.83, side: 'back' }, adductors: { y: 0.62, side: 'front' },
};

const CATEGORY_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  Chest: { y: 0.32, side: 'front' }, Back: { y: 0.32, side: 'back' },
  Shoulders: { y: 0.26, side: 'front' }, Arms: { y: 0.37, side: 'front' },
  Legs: { y: 0.66, side: 'front' }, Core: { y: 0.44, side: 'front' },
};

const BODY_SCALE = 0.35;
const BODY_W = 200 * BODY_SCALE;
const BODY_H = 400 * BODY_SCALE;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'RoutineSummary'>;

export default function RoutineSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const { routineId } = route.params;

  const routine = useRoutineStore((s) => s.routines.find((r) => r.id === routineId));
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const themeMode = useThemeStore((s) => s.mode);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bodyPalette = useMemo(() => {
    const a = colors.accent;
    if (themeMode === 'dark') {
      return ['#1A1A1E', '#2A2A2E', a + '40', a + '60', a + '80', a, a];
    }
    return ['#E8E4DE', '#C8C4BE', a + '40', a + '60', a + '80', a, a];
  }, [themeMode, colors.accent]);

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
    startFromRoutine(routine, catalogMap, prevMap);
    navigation.popToTop();
  }, [routine, catalogMap, prevMap, startFromRoutine, navigation]);

  const MAP_W = sw(44);
  const MAP_H = sw(52);

  if (!routine) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Routine Summary</Text>
          <View style={styles.backBtn} />
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Routine Summary</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('CreateRoutine', { routineId })}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={ms(20)} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Routine info */}
        <View style={styles.routineInfo}>
          <Text style={styles.routineName}>{routine.name}</Text>
          <Text style={styles.routineSub}>
            {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
            {daysLabel ? `  ·  ${daysLabel}` : ''}
          </Text>
        </View>

        {/* Exercise cards */}
        {routine.exercises.map((ex, i) => {
          const reps = ex.set_reps || Array(ex.default_sets).fill(ex.default_reps);
          const weights = ex.set_weights || Array(ex.default_sets).fill(0);
          const prev = prevMap[ex.name] || [];
          const minR = Math.min(...reps);
          const maxR = Math.max(...reps);
          const repRange = minR === maxR ? `${minR}` : `${minR}-${maxR}`;

          // Build body map data
          const entry = catalogMap[ex.name];
          const primarySlugs = new Set<string>();
          const secondarySlugs = new Set<string>();

          if (entry) {
            for (const m of entry.primary_muscles) {
              const s = toSlug(m);
              if (s) primarySlugs.add(s);
            }
            for (const m of entry.secondary_muscles) {
              const s = toSlug(m);
              if (s) secondarySlugs.add(s);
            }
          }

          const category = entry?.category || null;
          if (primarySlugs.size === 0 && category) {
            const slugs = CATEGORY_SLUGS[category];
            if (slugs) slugs.forEach((s) => primarySlugs.add(s));
          }

          let focusY = 0.35;
          let bodySide: 'front' | 'back' = 'front';
          const firstSlug = [...primarySlugs][0];
          if (firstSlug && SLUG_FOCUS[firstSlug]) {
            focusY = SLUG_FOCUS[firstSlug].y;
            bodySide = SLUG_FOCUS[firstSlug].side;
          } else if (category && CATEGORY_FOCUS[category]) {
            focusY = CATEGORY_FOCUS[category].y;
            bodySide = CATEGORY_FOCUS[category].side;
          }

          const bodyData: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
            slug,
            intensity: primarySlugs.has(slug) ? 6 : secondarySlugs.has(slug) ? 3 : 1,
          }));

          const hasMuscles = primarySlugs.size > 0;
          const bodyOffsetX = -(BODY_W - MAP_W) / 2;
          const bodyOffsetY = -(BODY_H * focusY) + MAP_H / 2;

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

                {hasMuscles && (
                  <View style={[styles.bodyMapClip, { width: MAP_W, height: MAP_H }]}>
                    <View style={{ position: 'absolute', left: bodyOffsetX, top: bodyOffsetY }}>
                      <Body
                        data={bodyData}
                        side={bodySide}
                        gender="male"
                        scale={BODY_SCALE}
                        colors={bodyPalette}
                        border="none"
                        backColor={colors.cardBorder}
                      />
                    </View>
                  </View>
                )}
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
          <Ionicons name="play" size={ms(18)} color={colors.textOnAccent} />
          <Text style={styles.startBtnText}>Start Workout</Text>
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
  backBtn: {
    width: sw(36),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(100),
  },

  /* Routine info */
  routineInfo: {
    marginBottom: sw(16),
    gap: sw(4),
  },
  routineName: {
    color: colors.textPrimary,
    fontSize: ms(22),
    fontFamily: Fonts.bold,
    lineHeight: ms(28),
  },
  routineSub: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
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
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
    paddingBottom: sw(32),
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: sw(14),
    borderRadius: sw(12),
    gap: sw(8),
  },
  startBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
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
