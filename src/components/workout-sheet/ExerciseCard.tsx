import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useThemeStore } from '../../stores/useThemeStore';
import type { ActiveExercise } from '../../stores/useActiveWorkoutStore';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { toSlug, ALL_SLUGS } from '../../utils/muscleVolume';
import SetRow from './SetRow';

/* ─── Ghost set comparison ─────────────────────────────── */

function compareGhostSet(
  userKg: number, userReps: number,
  ghostKg: number, ghostReps: number,
): 'win' | 'loss' | 'tie' {
  if (userKg < ghostKg) return 'loss';
  if (userKg === ghostKg) {
    if (userReps > ghostReps) return 'win';
    if (userReps < ghostReps) return 'loss';
    return 'tie';
  }
  const userVol = userKg * userReps;
  const ghostVol = ghostKg * ghostReps;
  if (userVol > ghostVol) return 'win';
  if (userVol < ghostVol) return 'loss';
  return 'tie';
}

/* ─── Focused body map helpers ─────────────────────────── */

const CATEGORY_SLUGS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids', 'rear-deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'],
  Core: ['abs', 'obliques'],
};

const SLUG_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  chest:          { y: 0.32, side: 'front' },
  deltoids:       { y: 0.26, side: 'front' },
  'rear-deltoids':{ y: 0.26, side: 'back' },
  biceps:         { y: 0.37, side: 'front' },
  triceps:        { y: 0.37, side: 'back' },
  forearm:        { y: 0.48, side: 'front' },
  abs:            { y: 0.44, side: 'front' },
  obliques:       { y: 0.44, side: 'front' },
  'upper-back':   { y: 0.32, side: 'back' },
  'lower-back':   { y: 0.44, side: 'back' },
  trapezius:      { y: 0.23, side: 'back' },
  quadriceps:     { y: 0.66, side: 'front' },
  hamstring:      { y: 0.66, side: 'back' },
  gluteal:        { y: 0.53, side: 'back' },
  calves:         { y: 0.83, side: 'back' },
  adductors:      { y: 0.62, side: 'front' },
  tibialis:       { y: 0.80, side: 'front' },
};

const CATEGORY_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  Chest:     { y: 0.32, side: 'front' },
  Back:      { y: 0.32, side: 'back' },
  Shoulders: { y: 0.26, side: 'front' },
  Arms:      { y: 0.37, side: 'front' },
  Legs:      { y: 0.66, side: 'front' },
  Core:      { y: 0.44, side: 'front' },
};

const BODY_SCALE = 0.35;
const BODY_W = 200 * BODY_SCALE;
const BODY_H = 400 * BODY_SCALE;



/* ─── ExerciseCard ─────────────────────────────────────── */

interface Props {
  exercise: ActiveExercise;
  exerciseIndex: number;
  isLast: boolean;
  totalExercises: number;
  isCurrent?: boolean;
  overloadTracker?: React.ReactNode;
  onReplace: (exerciseIndex: number) => void;
  onExerciseFocus?: (exerciseIndex: number) => void;
  onInputFocus?: (y: number) => void;
}

function ExerciseCard({ exercise, exerciseIndex, isLast, totalExercises, isCurrent, overloadTracker, onReplace, onExerciseFocus, onInputFocus }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useActiveWorkoutStore((s) => s.toggleSetComplete);
  const cycleSetType = useActiveWorkoutStore((s) => s.cycleSetType);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const themeMode = useThemeStore((s) => s.mode);


  // Build body highlight data + focus region
  const { bodyData, focusY, bodySide, hasMuscles } = useMemo(() => {
    const entry = catalogMap[exercise.name];
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

    const category = exercise.category || entry?.category || null;
    if (primarySlugs.size === 0 && category) {
      const slugs = CATEGORY_SLUGS[category];
      if (slugs) slugs.forEach((s) => primarySlugs.add(s));
    }

    const firstSlug = [...primarySlugs][0];
    let fy = 0.35;
    let bs: 'front' | 'back' = 'front';

    if (firstSlug && SLUG_FOCUS[firstSlug]) {
      fy = SLUG_FOCUS[firstSlug].y;
      bs = SLUG_FOCUS[firstSlug].side;
    } else if (category && CATEGORY_FOCUS[category]) {
      fy = CATEGORY_FOCUS[category].y;
      bs = CATEGORY_FOCUS[category].side;
    }

    const bd: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
      slug,
      intensity: primarySlugs.has(slug) ? 6 : secondarySlugs.has(slug) ? 3 : 1,
    }));

    return { bodyData: bd, focusY: fy, bodySide: bs, hasMuscles: primarySlugs.size > 0 };
  }, [exercise.name, exercise.category, catalogMap]);

  const bodyPalette = useMemo(() => {
    const a = colors.accent;
    if (themeMode === 'dark') {
      return ['#1A1A1E', '#2A2A2E', a + '40', a + '60', a + '80', a, a];
    }
    return ['#E8E4DE', '#C8C4BE', a + '40', a + '60', a + '80', a, a];
  }, [themeMode, colors.accent]);

  const MAP_W = sw(44);
  const MAP_H = sw(52);
  const bodyOffsetX = -(BODY_W - MAP_W) / 2;
  const bodyOffsetY = -(BODY_H * focusY) + MAP_H / 2;

  // Summary
  const repRange = useMemo(() => {
    if (exercise.sets.length === 0) return '0';
    const reps = exercise.sets.map((s) => {
      const n = parseInt(s.reps, 10);
      return isNaN(n) ? 0 : n;
    });
    const min = Math.min(...reps);
    const max = Math.max(...reps);
    return min === max ? `${min}` : `${min}-${max}`;
  }, [exercise.sets]);

  const summary = `${exercise.sets.length} sets · ${repRange} reps`;

  const swipeableRef = React.useRef<Swipeable>(null);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        removeExercise(exerciseIndex);
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="trash" size={ms(22)} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  ), [removeExercise, exerciseIndex, styles]);

  return (
    <Pressable
      style={[styles.swipeContainer, isCurrent && styles.currentBorder]}
      onPress={() => onExerciseFocus?.(exerciseIndex)}
    >
    <Swipeable
      ref={swipeableRef}
      renderRightActions={useActiveWorkoutStore.getState().ghostUserName ? undefined : renderRightActions}
      enabled={!useActiveWorkoutStore.getState().ghostUserName}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {exercise.name.replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={styles.reorderBtns}>
            <TouchableOpacity
              onPress={() => moveExercise(exerciseIndex, 'up')}
              disabled={exerciseIndex === 0}
              style={styles.reorderBtn}
              activeOpacity={0.5}
            >
              <Ionicons name="chevron-up" size={ms(14)} color={exerciseIndex === 0 ? colors.textTertiary + '30' : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveExercise(exerciseIndex, 'down')}
              disabled={isLast}
              style={styles.reorderBtn}
              activeOpacity={0.5}
            >
              <Ionicons name="chevron-down" size={ms(14)} color={isLast ? colors.textTertiary + '30' : colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Overload tracker */}
        {overloadTracker}

        {/* Divider */}
        <View style={styles.divider} />

            {/* Column headers */}
            <View style={styles.colHeaders}>
              <Text style={[styles.colHeader, { width: sw(28) }]}>SET</Text>
              {!useActiveWorkoutStore.getState().ghostUserName && (
                <Text style={[styles.colHeader, { width: sw(46) }]}>PREV</Text>
              )}
              {(exercise.exercise_type === 'weighted' || exercise.exercise_type === 'weighted+bodyweight') && (
                <Text style={[styles.colHeader, { flex: 1 }]}>
                  {exercise.exercise_type === 'weighted+bodyweight' ? '+KG' : 'KG'}
                </Text>
              )}
              <Text style={[styles.colHeader, { flex: exercise.exercise_type === 'duration' ? 2 : 1 }]}>
                {exercise.exercise_type === 'duration' ? 'TIME' : 'REPS'}
              </Text>
              <View style={{ width: sw(24) }} />
            </View>

            {/* Sets */}
            {exercise.sets.map((set, setIdx) => {
              const isGhost = !!useActiveWorkoutStore.getState().ghostUserName;
              const ghostPrev = isGhost ? (exercise.prevSets?.[setIdx] || null) : null;
              const ghostResult = (isGhost && set.completed && ghostPrev)
                ? compareGhostSet(
                    parseFloat(set.kg) || 0, parseInt(set.reps) || 0,
                    ghostPrev.kg, ghostPrev.reps,
                  )
                : null;
              return (
              <SetRow
                key={`${set.id}-${setIdx}`}
                index={setIdx}
                set={set}
                prevSet={exercise.prevSets?.[setIdx] || null}
                exerciseType={exercise.exercise_type}
                suggestedKg={ghostPrev ? String(ghostPrev.kg) : undefined}
                suggestedReps={ghostPrev ? String(ghostPrev.reps) : undefined}
                onUpdate={(field, value) => { onExerciseFocus?.(exerciseIndex); updateSet(exerciseIndex, setIdx, field, value); }}
                onToggle={() => { onExerciseFocus?.(exerciseIndex); toggleSetComplete(exerciseIndex, setIdx); }}
                onCycleSetType={() => cycleSetType(exerciseIndex, setIdx)}
                onDelete={exercise.sets.length > 1 && !isGhost ? () => removeSet(exerciseIndex, setIdx) : null}
                onInputFocus={(y) => { onExerciseFocus?.(exerciseIndex); onInputFocus?.(y); }}
                isGhost={isGhost}
                ghostResult={ghostResult}
              />
            );
            })}

            {/* Add Set button — hidden in ghost mode */}
            {!useActiveWorkoutStore.getState().ghostUserName && (
              <TouchableOpacity
                style={styles.addSetBtn}
                onPress={() => addSet(exerciseIndex)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={ms(14)} color={colors.accent} />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>
            )}
      </View>
    </Swipeable>
    </Pressable>
  );
}

export default React.memo(ExerciseCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: sw(8),
    borderWidth: sw(2),
    borderColor: colors.cardBorder,
  },
  currentBorder: {
    borderWidth: sw(1),
    borderColor: colors.textTertiary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(12),
  },
  deleteAction: {
    backgroundColor: colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: sw(80),
    gap: sw(4),
  },
  deleteText: {
    color: '#fff',
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(17),
    flexShrink: 1,
  },
  categoryChip: {
    backgroundColor: colors.accent + '15',
    paddingHorizontal: sw(8),
    paddingVertical: sw(2),
    borderRadius: sw(4),
  },
  categoryText: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Reorder buttons
  reorderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(2),
  },
  reorderBtn: {
    padding: sw(2),
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(10),
  },

  // Column headers
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(6),
    marginBottom: sw(1),
    gap: sw(6),
  },
  colHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Add Set
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(7),
    marginTop: sw(3),
    gap: sw(4),
  },
  addSetText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
});
