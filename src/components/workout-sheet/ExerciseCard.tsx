import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
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
  onTitlePress?: (exerciseName: string) => void;
}

function ExerciseCard({ exercise, exerciseIndex, isLast, totalExercises, isCurrent, overloadTracker, onReplace, onExerciseFocus, onInputFocus, onTitlePress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const addDropSet = useActiveWorkoutStore((s) => s.addDropSet);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useActiveWorkoutStore((s) => s.toggleSetComplete);
  const cycleSetType = useActiveWorkoutStore((s) => s.cycleSetType);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const themeMode = useThemeStore((s) => s.mode);
  const isGhost = !!useActiveWorkoutStore((s) => s.ghostUserName);

  // Long-press context menu state
  const [contextMenu, setContextMenu] = useState<{ setIdx: number; y: number } | null>(null);

  const handleBadgeLongPress = useCallback((setIdx: number, pageY: number) => {
    setContextMenu({ setIdx, y: pageY });
  }, []);

  const dismissContextMenu = useCallback(() => setContextMenu(null), []);

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

  // Per-set suggestion engine (same logic as ProgressiveOverloadCard)
  const suggestedSets = useMemo(() => {
    const prevSets = exercise.prevSets;
    if (!prevSets || prevSets.length === 0) return exercise.sets.map(() => null);

    const isBodyweight = exercise.exercise_type === 'bodyweight';
    const isDurationType = exercise.exercise_type === 'duration';

    const prevTotal = prevSets.reduce((sum, s) =>
      sum + (isBodyweight || isDurationType ? s.reps : s.kg * s.reps), 0);
    if (prevTotal <= 0) return exercise.sets.map(() => null);

    let completedVol = 0;
    let lastKg = 0;
    let lastReps = 0;
    for (const s of exercise.sets) {
      if (s.completed) {
        const kg = parseFloat(s.kg) || 0;
        const reps = parseInt(s.reps, 10) || 0;
        completedVol += isBodyweight || isDurationType ? reps : kg * reps;
        if (kg > 0 || isBodyweight || isDurationType) { lastKg = kg; lastReps = reps; }
      }
    }

    const results: ({ kg: number; reps: number } | null)[] = [];
    let runningVol = completedVol;
    let uncompleted = exercise.sets.filter(s => !s.completed).length;

    for (let i = 0; i < exercise.sets.length; i++) {
      if (exercise.sets[i].completed) { results.push(null); continue; }

      const prev = prevSets[Math.min(i, prevSets.length - 1)];
      const volLeft = Math.max(prevTotal - runningVol + 1, 0);

      if (volLeft <= 0 || uncompleted <= 0) {
        results.push(prev ? { kg: prev.kg, reps: prev.reps } : null);
        uncompleted--;
        continue;
      }

      if (isBodyweight || isDurationType) {
        const perSet = Math.ceil(volLeft / uncompleted);
        const reps = Math.max(perSet, (prev?.reps || 0) + 1);
        results.push({ kg: 0, reps });
        runningVol += reps;
      } else {
        const baseKg = lastKg > 0 ? lastKg : (prev?.kg || 0);
        const baseReps = lastKg > 0 ? lastReps : (prev?.reps || 0);
        if (baseKg <= 0) { results.push(null); uncompleted--; continue; }

        const e1rm = baseKg * (1 + baseReps / 30);
        const volPerSet = Math.ceil(volLeft / uncompleted);
        const needed = Math.max(Math.ceil(volPerSet / baseKg), 1);
        const maxPossible = Math.max(Math.round(30 * (e1rm / baseKg - 1)), 1);

        let suggestReps = Math.min(needed, maxPossible);
        // Never suggest fewer reps than prev — aim to beat each set
        if (prev && baseKg <= prev.kg) {
          suggestReps = Math.max(suggestReps, prev.reps + 1);
        }

        results.push({ kg: baseKg, reps: suggestReps });
        runningVol += baseKg * suggestReps;
      }
      uncompleted--;
    }

    return results;
  }, [exercise.sets, exercise.prevSets, exercise.exercise_type]);

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
      renderRightActions={isGhost ? undefined : renderRightActions}
      enabled={!isGhost}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => onTitlePress?.(exercise.name)}
            style={styles.nameRow}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.name} numberOfLines={1}>
              {exercise.name.replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
            <Ionicons name="chevron-forward" size={ms(11)} color={colors.textTertiary} />
          </Pressable>
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
              {!isGhost && (
                <Text style={[styles.colHeader, { width: sw(46) }]}>PREV</Text>
              )}
              {!isGhost && (
                <Text style={[styles.colHeader, { width: sw(46) }]}>REC</Text>
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
              const ghostPrev = isGhost ? (exercise.prevSets?.[setIdx] || null) : null;
              const ghostResult = (isGhost && set.completed && ghostPrev)
                ? compareGhostSet(
                    parseFloat(set.kg) || 0, parseInt(set.reps) || 0,
                    ghostPrev.kg, ghostPrev.reps,
                  )
                : null;

              const isDropSetRow = set.set_type === 'drop' && set.parent_set_number != null;
              // Compute drop ordinal: count preceding drops with the same parent
              let dropIdx: number | null = null;
              if (isDropSetRow) {
                let count = 0;
                for (let i = 0; i < setIdx; i++) {
                  if (exercise.sets[i].set_type === 'drop' && exercise.sets[i].parent_set_number === set.parent_set_number) {
                    count++;
                  }
                }
                dropIdx = count;
              }

              return (
                <SetRow
                  key={`set-${setIdx}`}
                  index={setIdx}
                  set={set}
                  prevSet={exercise.prevSets?.[setIdx] || null}
                  suggestedSet={suggestedSets[setIdx]}
                  exerciseType={exercise.exercise_type}
                  suggestedKg={ghostPrev ? String(ghostPrev.kg) : (suggestedSets[setIdx]?.kg ? String(suggestedSets[setIdx]!.kg) : undefined)}
                  suggestedReps={ghostPrev ? String(ghostPrev.reps) : (suggestedSets[setIdx]?.reps ? String(suggestedSets[setIdx]!.reps) : undefined)}
                  onUpdate={(field, value) => { onExerciseFocus?.(exerciseIndex); updateSet(exerciseIndex, setIdx, field, value); }}
                  onToggle={() => { onExerciseFocus?.(exerciseIndex); toggleSetComplete(exerciseIndex, setIdx); }}
                  onCycleSetType={() => cycleSetType(exerciseIndex, setIdx)}
                  onBadgeLongPress={!isGhost && !isDropSetRow ? (pageY: number) => handleBadgeLongPress(setIdx, pageY) : undefined}
                  onDelete={exercise.sets.length > 1 && !isGhost ? () => removeSet(exerciseIndex, setIdx) : null}
                  onInputFocus={(y) => { onExerciseFocus?.(exerciseIndex); onInputFocus?.(y); }}
                  isGhost={isGhost}
                  ghostResult={ghostResult}
                  isDropSet={isDropSetRow}
                  dropIndex={dropIdx}
                />
              );
            })}

            {/* Action buttons — hidden in ghost mode */}
            {!isGhost && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    let lastWorkingIdx = -1;
                    for (let i = exercise.sets.length - 1; i >= 0; i--) {
                      if (exercise.sets[i].set_type === 'working') { lastWorkingIdx = i; break; }
                    }
                    if (lastWorkingIdx >= 0) addDropSet(exerciseIndex, lastWorkingIdx);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-down" size={ms(13)} color={colors.accentPink} />
                  <Text style={[styles.actionBtnText, { color: colors.accentPink }]}>Drop</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => addSet(exerciseIndex)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={ms(13)} color={colors.accent} />
                  <Text style={[styles.actionBtnText, { color: colors.accent }]}>Set</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDisabled]}
                  activeOpacity={0.7}
                  disabled
                >
                  <Ionicons name="git-compare-outline" size={ms(13)} color={colors.textSecondary} />
                  <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Superset</Text>
                </TouchableOpacity>
              </View>
            )}
      </View>
    </Swipeable>

      {/* Long-press context menu */}
      {contextMenu && (
        <Modal transparent animationType="fade" onRequestClose={dismissContextMenu}>
          <Pressable style={styles.menuOverlay} onPress={dismissContextMenu}>
            <View style={[styles.menuContainer, { top: contextMenu.y - sw(44) }]}>
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={() => {
                  addDropSet(exerciseIndex, contextMenu.setIdx);
                  dismissContextMenu();
                }}
              >
                <Ionicons name="arrow-down" size={ms(15)} color={colors.accentPink} />
                <Text style={[styles.menuItemText, { color: colors.accentPink }]}>Add Drop Set</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={[styles.menuItem, styles.actionBtnDisabled]}
                activeOpacity={0.7}
                disabled
              >
                <Ionicons name="git-compare-outline" size={ms(15)} color={colors.textSecondary} />
                <Text style={[styles.menuItemText, { color: colors.textSecondary }]}>Add Superset</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
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
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: sw(3),
    flexShrink: 1,
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

  // Action buttons row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    marginTop: sw(6),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(5),
    paddingHorizontal: sw(10),
    gap: sw(3),
    borderRadius: sw(6),
    backgroundColor: colors.surface,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },

  // Context menu
  menuOverlay: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    left: sw(40),
    backgroundColor: colors.card,
    borderRadius: sw(10),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: sw(4),
    minWidth: sw(160),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
    paddingHorizontal: sw(14),
    gap: sw(8),
  },
  menuItemText: {
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginHorizontal: sw(10),
  },
});
