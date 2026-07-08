import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Keyboard,
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
import { toSlug, ALL_SLUGS, SLUG_LABELS } from '../../utils/muscleVolume';
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

/* ─── Note date formatting ─────────────────────────────── */

// Notes shown inline (via expand) before switching to a scrollable modal.
const PREV_NOTES_INLINE_CAP = 4;

// The 3 selectable note colors, mapped to theme tokens.
const NOTE_COLOR_OPTIONS: { key: string; token: 'accentGreen' | 'accentOrange' | 'accentRed' }[] = [
  { key: 'green', token: 'accentGreen' },
  { key: 'orange', token: 'accentOrange' },
  { key: 'red', token: 'accentRed' },
];

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const duplicateSet = useActiveWorkoutStore((s) => s.duplicateSet);
  const linkSuperset = useActiveWorkoutStore((s) => s.linkSuperset);
  const unlinkSuperset = useActiveWorkoutStore((s) => s.unlinkSuperset);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);
  const setExerciseNotes = useActiveWorkoutStore((s) => s.setExerciseNotes);
  const setExerciseNoteColor = useActiveWorkoutStore((s) => s.setExerciseNoteColor);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useActiveWorkoutStore((s) => s.toggleSetComplete);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const themeMode = useThemeStore((s) => s.mode);
  const isGhost = !!useActiveWorkoutStore((s) => s.ghostUserName);

  // Notes: `notesOpen` means actively editing. Otherwise show a read-only
  // note (if one exists) or the "Add a note" button.
  const hasNote = !!exercise.notes && exercise.notes.trim().length > 0;
  const [notesOpen, setNotesOpen] = useState(false);
  // Previous-note history: collapsed to the latest by default. Small histories
  // expand inline; large ones open a scrollable modal.
  const [showAllPrev, setShowAllPrev] = useState(false);
  const [notesHistoryOpen, setNotesHistoryOpen] = useState(false);

  const prevNotes = exercise.prevNotes ?? [];
  const prevUseModal = prevNotes.length > PREV_NOTES_INLINE_CAP;
  const visiblePrev = !prevUseModal && showAllPrev ? prevNotes : prevNotes.slice(0, 1);

  const noteColorValue = useCallback(
    (key?: string): string | null => {
      const opt = NOTE_COLOR_OPTIONS.find((o) => o.key === key);
      return opt ? colors[opt.token] : null;
    },
    [colors],
  );
  const todayColor = noteColorValue(exercise.noteColor);

  // Build body highlight data + focus region
  const { bodyData, focusY, bodySide, hasMuscles, bodyPartLabel } = useMemo(() => {
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

    // Body-part label: use the first primary muscle (catalog `category` is a
    // training type like "strength", not a body part). Fall back to category
    // only when it's a real body-part group.
    let bodyPartLabel: string | null = null;
    if (entry) {
      for (const m of entry.primary_muscles) {
        const sl = toSlug(m);
        if (sl && SLUG_LABELS[sl]) { bodyPartLabel = SLUG_LABELS[sl]; break; }
      }
    }
    if (!bodyPartLabel && category && CATEGORY_SLUGS[category]) bodyPartLabel = category;

    return { bodyData: bd, focusY: fy, bodySide: bs, hasMuscles: primarySlugs.size > 0, bodyPartLabel };
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
          {!!bodyPartLabel && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{bodyPartLabel}</Text>
            </View>
          )}
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
          {!isGhost && (
            <TouchableOpacity
              onPress={() => removeExercise(exerciseIndex)}
              style={styles.removeBtn}
              activeOpacity={0.5}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={ms(16)} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Notes */}
        {!isGhost && (
          <View>
            {/* Previous notes — read-only history (newest first) */}
            {prevNotes.length > 0 && (
              <View style={styles.notesPrevWrap}>
                {visiblePrev.map((n, i) => {
                  const c = noteColorValue(n.color);
                  return (
                    <View
                      key={`prevnote-${i}`}
                      style={[
                        styles.notesPrevItem,
                        i > 0 && styles.notesPrevItemDivider,
                        c && { borderLeftWidth: sw(3), borderLeftColor: c },
                      ]}
                    >
                      <Text style={[styles.notesPrevDate, c && { color: c }]}>{formatNoteDate(n.date)}</Text>
                      <Text style={styles.notesPrevText}>{n.note}</Text>
                    </View>
                  );
                })}
                {prevNotes.length > 1 && (
                  <TouchableOpacity
                    style={[styles.notesPrevToggle, styles.notesPrevItemDivider]}
                    onPress={() => (prevUseModal ? setNotesHistoryOpen(true) : setShowAllPrev((v) => !v))}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.notesPrevToggleText}>
                      {prevUseModal
                        ? `View all ${prevNotes.length} notes`
                        : showAllPrev
                        ? 'Show less'
                        : `Show ${prevNotes.length - 1} earlier ${prevNotes.length - 1 === 1 ? 'note' : 'notes'}`}
                    </Text>
                    <Ionicons
                      name={prevUseModal ? 'chevron-forward' : showAllPrev ? 'chevron-up' : 'chevron-down'}
                      size={ms(11)}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Today's note — editable */}
            {notesOpen ? (
              <View style={styles.notesWrap}>
                <TextInput
                  style={[styles.notesInput, todayColor && { borderLeftWidth: sw(3), borderLeftColor: todayColor }]}
                  value={exercise.notes ?? ''}
                  onChangeText={(t) => setExerciseNotes(exerciseIndex, t)}
                  onFocus={() => onExerciseFocus?.(exerciseIndex)}
                  placeholder="Add a note..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  autoFocus={!hasNote}
                />
                <View style={styles.notesEditFooter}>
                  <View style={styles.notesSwatches}>
                    {NOTE_COLOR_OPTIONS.map((opt) => {
                      const selected = exercise.noteColor === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => setExerciseNoteColor(exerciseIndex, selected ? undefined : opt.key)}
                          style={[styles.swatch, { backgroundColor: colors[opt.token] }, selected && styles.swatchSelected]}
                          activeOpacity={0.7}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          {selected && <Ionicons name="checkmark" size={ms(12)} color="#fff" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.notesEditActions}>
                    {(hasNote || !!exercise.noteColor) && (
                      <TouchableOpacity
                        style={styles.notesDeleteBtn}
                        onPress={() => {
                          setExerciseNotes(exerciseIndex, '');
                          setExerciseNoteColor(exerciseIndex, undefined);
                          Keyboard.dismiss();
                          setNotesOpen(false);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="trash-outline" size={ms(14)} color={colors.accentRed} />
                        <Text style={styles.notesDeleteText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.notesSaveBtn}
                      onPress={() => {
                        Keyboard.dismiss();
                        setNotesOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="checkmark" size={ms(14)} color={colors.accent} />
                      <Text style={styles.notesSaveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : hasNote ? (
              <TouchableOpacity
                style={[styles.notesDisplay, todayColor && { borderLeftWidth: sw(3), borderLeftColor: todayColor }]}
                onPress={() => setNotesOpen(true)}
                activeOpacity={0.6}
              >
                <Text style={styles.notesDisplayText}>{exercise.notes}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.notesAddBtn}
                onPress={() => setNotesOpen(true)}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.notesAddText}>Add a note</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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
                  onPress={() => addSet(exerciseIndex)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionBtnText, { color: colors.accent }]}>Add set</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, exercise.sets.length === 0 && styles.actionBtnDisabled]}
                  onPress={() => {
                    if (exercise.sets.length === 0) return;
                    duplicateSet(exerciseIndex, exercise.sets.length - 1);
                  }}
                  activeOpacity={0.7}
                  disabled={exercise.sets.length === 0}
                >
                  <Text style={[styles.actionBtnText, { color: colors.accent }]}>Copy</Text>
                </TouchableOpacity>

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
                  <Text style={[styles.actionBtnText, { color: colors.accentBabyBlue }]}>Drop set</Text>
                </TouchableOpacity>

                {(() => {
                  const isLinked = exercise.supersetWith != null;
                  const canLink = isLinked || !isLast;
                  const tint = isLinked ? colors.accentRed : colors.accent;
                  return (
                    <TouchableOpacity
                      style={[styles.actionBtn, !canLink && styles.actionBtnDisabled]}
                      activeOpacity={0.7}
                      disabled={!canLink}
                      onPress={() => {
                        if (isLinked) unlinkSuperset(exerciseIndex);
                        else linkSuperset(exerciseIndex);
                      }}
                    >
                      <Text style={[styles.actionBtnText, { color: canLink ? tint : colors.textSecondary }]}>
                        {isLinked ? 'Unlink' : 'Superset'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}
      </View>
    </Swipeable>

      {/* Full note history — scrollable modal for large histories */}
      {notesHistoryOpen && (
        <Modal transparent animationType="slide" onRequestClose={() => setNotesHistoryOpen(false)}>
          <Pressable style={styles.notesModalOverlay} onPress={() => setNotesHistoryOpen(false)}>
            <Pressable style={styles.notesModalSheet} onPress={() => {}}>
              <View style={styles.notesModalHeader}>
                <Text style={styles.notesModalTitle} numberOfLines={1}>
                  {exercise.name.replace(/\b\w/g, (c) => c.toUpperCase())} · Notes
                </Text>
                <TouchableOpacity
                  onPress={() => setNotesHistoryOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={ms(20)} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.notesModalScroll}
                contentContainerStyle={styles.notesModalContent}
                showsVerticalScrollIndicator
              >
                {prevNotes.map((n, i) => {
                  const c = noteColorValue(n.color);
                  return (
                    <View
                      key={`histnote-${i}`}
                      style={[
                        styles.notesModalItem,
                        i > 0 && styles.notesPrevItemDivider,
                        c && { borderLeftWidth: sw(3), borderLeftColor: c, paddingLeft: sw(10) },
                      ]}
                    >
                      <Text style={[styles.notesPrevDate, c && { color: c }]}>{formatNoteDate(n.date)}</Text>
                      <Text style={styles.notesModalText}>{n.note}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </Pressable>
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
  removeBtn: {
    padding: sw(2),
    marginLeft: sw(2),
  },

  // Notes
  notesAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    marginTop: sw(8),
  },
  notesAddText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
  notesWrap: {
    marginTop: sw(8),
  },
  notesInput: {
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.regular,
    lineHeight: ms(16),
    minHeight: sw(34),
  },
  notesEditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sw(6),
  },
  notesSwatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  swatch: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: sw(2),
    borderColor: colors.textPrimary,
  },
  notesEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  notesDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    paddingVertical: sw(5),
    paddingHorizontal: sw(10),
    borderRadius: sw(6),
    backgroundColor: colors.accentRed + '15',
  },
  notesDeleteText: {
    color: colors.accentRed,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
  notesSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(3),
    paddingVertical: sw(5),
    paddingHorizontal: sw(12),
    borderRadius: sw(6),
    backgroundColor: colors.accent + '15',
  },
  notesSaveText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
  notesDisplay: {
    marginTop: sw(8),
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
  },
  notesDisplayText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.regular,
    lineHeight: ms(16),
  },
  notesPrevWrap: {
    marginTop: sw(8),
    borderRadius: sw(6),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  notesPrevItem: {
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
  },
  notesPrevItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  notesPrevToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(3),
    paddingVertical: sw(7),
    paddingHorizontal: sw(10),
  },
  notesPrevToggleText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },

  // Note history modal
  notesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notesModalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: sw(16),
    borderTopRightRadius: sw(16),
    maxHeight: '70%',
    paddingBottom: sw(24),
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingTop: sw(16),
    paddingBottom: sw(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  notesModalTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    marginRight: sw(12),
  },
  notesModalScroll: {
    flexGrow: 0,
  },
  notesModalContent: {
    paddingHorizontal: sw(16),
    paddingTop: sw(4),
  },
  notesModalItem: {
    paddingVertical: sw(12),
  },
  notesModalText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.regular,
    lineHeight: ms(18),
    marginTop: sw(2),
  },
  notesPrevText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.regular,
    lineHeight: ms(15),
  },
  notesPrevDate: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: sw(2),
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
});
