import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { useThemeStore } from '../../stores/useThemeStore';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { toSlug, ALL_SLUGS } from '../../utils/muscleVolume';
import type { ActivityFeedItem, FeedExerciseDetail } from '../../lib/friendsDatabase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useRoutineStore } from '../../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';

/* --- Body map helpers --- */

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

interface Props {
  item: ActivityFeedItem;
  onDismiss: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${kg} kg`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

export default function FeedWorkoutModal({ item, onDismiss }: Props) {
  const displayName = item.profile.username || item.profile.email;
  const exercises = item.exercise_details || [];
  const colors = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const bodyPalette = useMemo(() => {
    const a = colors.accent;
    if (themeMode === 'dark') {
      return ['#1A1A1E', '#2A2A2E', a + '40', a + '60', a + '80', a, a];
    }
    return ['#E8E4DE', '#C8C4BE', a + '40', a + '60', a + '80', a, a];
  }, [themeMode, colors.accent]);

  const MAP_W = sw(44);
  const MAP_H = sw(52);

  const userId = useAuthStore((s) => s.user?.id);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);

  const handleSaveRoutine = useCallback(async () => {
    if (!userId) return;
    const routineExercises = exercises.map((ex, i) => ({
      name: ex.name,
      exercise_order: i + 1,
      default_sets: ex.sets_count || 3,
      default_reps: ex.best_reps || 10,
      default_rest_seconds: 90,
      set_reps: ex.sets.length > 0 ? ex.sets.map((s) => s.reps) : [],
      set_weights: ex.sets.length > 0 ? ex.sets.map((s) => s.kg) : [],
      exercise_type: 'weighted',
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
  }, [userId, exercises, displayName, createRoutine]);

  const handleTryWorkout = useCallback(() => {
    // Build ghost prevMap from the poster's exercise data
    const ghostPrevMap: Record<string, { kg: number; reps: number }[]> = {};
    for (const ex of exercises) {
      if (ex.sets && ex.sets.length > 0) {
        ghostPrevMap[ex.name] = ex.sets.map((s) => ({ kg: s.kg, reps: s.reps }));
      } else if (ex.best_kg > 0 || ex.best_reps > 0) {
        ghostPrevMap[ex.name] = Array.from({ length: ex.sets_count || 3 }, () => ({
          kg: ex.best_kg,
          reps: ex.best_reps,
        }));
      }
    }
    const routine = {
      id: `feed-${item.id}`,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        default_sets: ex.sets_count || 3,
        exercise_type: 'weighted',
      })),
    };
    startFromRoutine(routine, catalogMap, ghostPrevMap, displayName);
    onDismiss();
  }, [item.id, exercises, startFromRoutine, catalogMap, onDismiss]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
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
            <Text style={styles.workoutDate}>{formatDate(item.created_at)}</Text>
            <Text style={styles.workoutSub}>
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
              {'  \u00b7  '}{formatDuration(item.duration)}
              {'  \u00b7  '}{formatVolume(item.total_volume)}
            </Text>
          </View>

          {/* Exercise cards */}
          {exercises.map((ex, i) => (
            <ExerciseCard
              key={i}
              exercise={ex}
              colors={colors}
              styles={styles}
              bodyPalette={bodyPalette}
              mapW={MAP_W}
              mapH={MAP_H}
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
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseCard({
  exercise: ex,
  colors,
  styles,
  bodyPalette,
  mapW,
  mapH,
}: {
  exercise: FeedExerciseDetail;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  bodyPalette: string[];
  mapW: number;
  mapH: number;
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

  // Build body map data
  const primarySlugs = new Set<string>();
  const secondarySlugs = new Set<string>();
  for (const m of ex.primary_muscles) {
    const s = toSlug(m);
    if (s) primarySlugs.add(s);
  }
  for (const m of ex.secondary_muscles) {
    const s = toSlug(m);
    if (s) secondarySlugs.add(s);
  }
  const category = ex.category || null;
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
  const bodyOffsetX = -(BODY_W - mapW) / 2;
  const bodyOffsetY = -(BODY_H * focusY) + mapH / 2;

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

        {hasMuscles && (
          <View style={[styles.bodyMapClip, { width: mapW, height: mapH }]}>
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

const createStyles = (colors: ThemeColors, topInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    marginTop: topInset + sw(44),
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(16),
    borderTopRightRadius: sw(16),
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: sw(16),
    paddingTop: sw(20),
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
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(12),
    borderRadius: sw(10),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
});
