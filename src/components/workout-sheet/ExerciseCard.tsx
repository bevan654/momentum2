import React, { useMemo, useCallback, useState } from 'react';
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
import type { ActiveExercise } from '../../stores/useActiveWorkoutStore';
import { toSlug, SLUG_LABELS } from '../../utils/muscleVolume';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import { suggestSets } from '../../utils/exerciseProgress';
import SetRow from './SetRow';
import RestInlineRow from './RestInlineRow';
import ExerciseNotes, { noteCount } from './ExerciseNotes';
import ExerciseProgressChart from './ExerciseProgressChart';
import ActionSheet, { type ActionSheetItem } from './ActionSheet';
import { GhostSetsCard } from './GhostMode';

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

/* ─── Body-part label helpers ─────────────────────────── */

const CATEGORY_SLUGS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids', 'rear-deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'],
  Core: ['abs', 'obliques'],
};

/* ─── ExerciseCard ─────────────────────────────────────── */

interface Props {
  exercise: ActiveExercise;
  exerciseIndex: number;
  isLast: boolean;
  isCurrent?: boolean;
  /** Ghost mode: show the friend's sets under this card (current exercise only). */
  showGhostSets?: boolean;
  onReplace: (exerciseIndex: number) => void;
  onExerciseFocus?: (exerciseIndex: number) => void;
  onInputFocus?: (y: number) => void;
  onTitlePress?: (exerciseName: string) => void;
}

function ExerciseCard({ exercise, exerciseIndex, isLast, isCurrent, showGhostSets, onReplace, onExerciseFocus, onInputFocus, onTitlePress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const addDropSet = useActiveWorkoutStore((s) => s.addDropSet);
  const duplicateSet = useActiveWorkoutStore((s) => s.duplicateSet);
  const linkSuperset = useActiveWorkoutStore((s) => s.linkSuperset);
  const unlinkSuperset = useActiveWorkoutStore((s) => s.unlinkSuperset);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useActiveWorkoutStore((s) => s.toggleSetComplete);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const isGhost = !!useActiveWorkoutStore((s) => s.ghostUserName);
  // Index of this card's set that started the current rest (-1 = none). A
  // primitive selector so cards only re-render when the anchor moves.
  const restSetIndex = useActiveWorkoutStore((s) =>
    s.restAnchor && s.restAnchor.exerciseIndex === exerciseIndex ? s.restAnchor.setIndex : -1,
  );

  const showProgressCharts = useProfileSettingsStore((s) => s.showProgressCharts);
  const notesExpanded = useProfileSettingsStore((s) => !!s.expandedNotes[exercise.name]);
  const toggleNotesExpanded = useProfileSettingsStore((s) => s.toggleNotesExpanded);
  const notesBadge = noteCount(exercise);
  const [menuOpen, setMenuOpen] = useState(false);

  // Body-part label: use the first primary muscle (catalog `category` is a
  // training type like "strength", not a body part). Fall back to category
  // only when it's a real body-part group.
  const bodyPartLabel = useMemo(() => {
    const entry = catalogMap[exercise.name];
    const category = exercise.category || entry?.category || null;
    let label: string | null = null;
    if (entry) {
      for (const m of entry.primary_muscles) {
        const sl = toSlug(m);
        if (sl && SLUG_LABELS[sl]) { label = SLUG_LABELS[sl]; break; }
      }
    }
    if (!label && category && CATEGORY_SLUGS[category]) label = category;
    return label;
  }, [exercise.name, exercise.category, catalogMap]);

  // Per-set suggestions to beat last session's volume
  const suggestedSets = useMemo(
    () => suggestSets(exercise.sets, exercise.prevSets, exercise.exercise_type),
    [exercise.sets, exercise.prevSets, exercise.exercise_type],
  );

  const swipeableRef = React.useRef<Swipeable>(null);

  const displayName = exercise.name.replace(/\b\w/g, (c) => c.toUpperCase());
  const menuActions = useMemo<ActionSheetItem[]>(() => {
    const actions: ActionSheetItem[] = [
      { key: 'up', label: 'Move up', icon: 'arrow-up', onPress: () => moveExercise(exerciseIndex, 'up'), disabled: exerciseIndex === 0 },
      { key: 'down', label: 'Move down', icon: 'arrow-down', onPress: () => moveExercise(exerciseIndex, 'down'), disabled: isLast },
    ];
    if (!isGhost) {
      actions.unshift({ key: 'replace', label: 'Replace exercise', icon: 'swap-horizontal', onPress: () => onReplace(exerciseIndex) });
      actions.push({ key: 'remove', label: 'Remove exercise', icon: 'trash-outline', onPress: () => removeExercise(exerciseIndex), destructive: true });
    }
    return actions;
  }, [exerciseIndex, isLast, isGhost, moveExercise, onReplace, removeExercise]);

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
              {displayName}
            </Text>
            <Ionicons name="chevron-forward" size={ms(11)} color={colors.textTertiary} />
          </Pressable>
          {!!bodyPartLabel && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{bodyPartLabel}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {!isGhost && (
            <TouchableOpacity
              onPress={() => toggleNotesExpanded(exercise.name)}
              style={styles.notesToggle}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityLabel={notesExpanded ? 'Hide notes' : 'Show notes'}
            >
              <Ionicons
                name={notesExpanded ? 'document-text' : 'document-text-outline'}
                size={ms(14)}
                color={notesExpanded || notesBadge > 0 ? colors.textSecondary : colors.textTertiary}
              />
              {notesBadge > 0 && (
                <Text style={[styles.notesCount, notesExpanded && { color: colors.textSecondary }]}>{notesBadge}</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={styles.moreBtn}
            activeOpacity={0.5}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Exercise options"
          >
            <Ionicons name="ellipsis-horizontal" size={ms(16)} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Notes (collapsed behind the header icon) */}
        {!isGhost && notesExpanded && (
          <ExerciseNotes exercise={exercise} exerciseIndex={exerciseIndex} onExerciseFocus={onExerciseFocus} />
        )}

        {/* Progress chart with progressive-overload target */}
        {showProgressCharts && (
          <ExerciseProgressChart
            exerciseName={exercise.name}
            exerciseType={exercise.exercise_type}
            sets={exercise.sets}
            onOpenHistory={onTitlePress}
          />
        )}

        {/* Overload tracker */}
        {showGhostSets && <GhostSetsCard exercise={exercise} />}

        {/* Divider */}
        <View style={styles.divider} />

            {/* Column headers */}
            <View style={styles.colHeaders}>
              <Text style={[styles.colHeader, { width: sw(28) }]}>SET</Text>
              {!isGhost && (
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
                <React.Fragment key={`set-${setIdx}`}>
                <SetRow
                  index={setIdx}
                  set={set}
                  prevSet={exercise.prevSets?.[setIdx] || null}
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
                {setIdx === restSetIndex && <RestInlineRow />}
                </React.Fragment>
              );
            })}

            {/* Action buttons — hidden in ghost mode */}
            {!isGhost && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.addSetBtn}
                  onPress={() => addSet(exerciseIndex)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={ms(14)} color={colors.accent} />
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
                  accessibilityLabel="Copy last set"
                >
                  <Ionicons name="copy-outline" size={ms(13)} color={colors.textSecondary} />
                  <Text style={styles.actionBtnText}>Copy</Text>
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
                  accessibilityLabel="Add drop set"
                >
                  <Ionicons name="trending-down" size={ms(13)} color={colors.textSecondary} />
                  <Text style={styles.actionBtnText}>Drop</Text>
                </TouchableOpacity>

                {(() => {
                  const isLinked = exercise.supersetWith != null;
                  const canLink = isLinked || !isLast;
                  const tint = isLinked ? colors.accent : colors.textSecondary;
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
                      <Ionicons name={isLinked ? 'unlink-outline' : 'link-outline'} size={ms(13)} color={tint} />
                      <Text style={[styles.actionBtnText, { color: tint }]}>
                        {isLinked ? 'Unlink' : 'Superset'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}
      </View>
    </Swipeable>

      <ActionSheet
        visible={menuOpen}
        title={displayName}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
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
    backgroundColor: colors.surface,
    paddingHorizontal: sw(8),
    paddingVertical: sw(2),
    borderRadius: sw(4),
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Options ("⋯") button
  moreBtn: {
    padding: sw(2),
    marginLeft: sw(2),
  },

  // Notes toggle (header)
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(2),
    padding: sw(2),
  },
  notesCount: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
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

  // Action buttons row: one primary (Add set) + compact neutral secondaries
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    marginTop: sw(8),
  },
  addSetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(7),
    gap: sw(3),
    borderRadius: sw(8),
    backgroundColor: colors.accent + '18',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(7),
    paddingHorizontal: sw(9),
    gap: sw(4),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
});
