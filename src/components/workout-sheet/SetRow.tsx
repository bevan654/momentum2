import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  cancelAnimation,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import type { ActiveSet } from '../../stores/useActiveWorkoutStore';
import { type ExerciseType } from '../../utils/exerciseProgress';
import { showsKg } from './summary/summaryFormat';
import { setTypeStyle } from './setTypeStyle';
import { createSetRowStyles, SWIPE_THRESHOLD, ROW_HEIGHT } from './set-row/setRowStyles';
import SetRowInputs, { formatTimeDisplay } from './set-row/SetRowInputs';

/* ── Props ─────────────────────────────────────────────── */

interface Props {
  index: number;
  set: ActiveSet;
  prevSet: { kg: number; reps: number } | null;
  suggestedKg?: string;
  suggestedReps?: string;
  exerciseType?: ExerciseType;
  /** Callbacks get the set's index so the parent can pass the same functions to every row (keeps React.memo effective). */
  onUpdate: (index: number, field: 'kg' | 'reps', value: string) => void;
  onToggle: (index: number) => void;
  /** Delete this set; `target` is the set that was swiped (its index may have moved since). */
  onDelete: ((index: number, target: ActiveSet) => void) | null;
  onInputFocus?: (y: number) => void;
  isGhost?: boolean;
  ghostResult?: 'win' | 'loss' | 'tie' | null;
  isDropSet?: boolean;
  dropIndex?: number | null;
}

/* ── Helpers ───────────────────────────────────────────── */

function formatPrev(prevSet: { kg: number; reps: number } | null, exerciseType?: ExerciseType): string {
  if (!prevSet) return '—';
  if (exerciseType === 'duration') return formatTimeDisplay(String(prevSet.reps));
  if (exerciseType === 'bodyweight') return `${prevSet.reps}`;
  return `${prevSet.kg}×${prevSet.reps}`;
}

/* ── Component ─────────────────────────────────────────── */

function SetRow({ index, set, prevSet, suggestedKg, suggestedReps, exerciseType, onUpdate, onToggle, onDelete, onInputFocus, isGhost, ghostResult, isDropSet, dropIndex }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createSetRowStyles(colors), [colors]);

  const completed = set.completed;

  /* ── Local input state (prevents fast-typing race conditions) ── */
  const [localKg, setLocalKg] = useState(set.kg);
  const [localReps, setLocalReps] = useState(set.reps);

  const localKgRef = useRef(localKg);
  const localRepsRef = useRef(localReps);
  localKgRef.current = localKg;
  localRepsRef.current = localReps;

  useEffect(() => {
    if (set.kg !== localKgRef.current) setLocalKg(set.kg);
  }, [set.kg]);
  useEffect(() => {
    if (set.reps !== localRepsRef.current) setLocalReps(set.reps);
  }, [set.reps]);

  /* ── Animated values ───────────────────────────────── */

  const translateX = useSharedValue(0);
  const fadeAnim = useSharedValue(0);
  const flashAnim = useSharedValue(0);
  const rowHeight = useSharedValue(ROW_HEIGHT);
  const rowOpacity = useSharedValue(1);
  const rowMargin = useSharedValue(sw(1));

  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value * rowOpacity.value,
    height: rowHeight.value,
    marginVertical: rowMargin.value,
    overflow: 'hidden' as const,
  }));

  const leftActionAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const leftIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD], [0.6, 0.85, 1], Extrapolation.CLAMP) }],
  }));

  const rightActionAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const rightIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(translateX.value, [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0], [1, 0.85, 0.6], Extrapolation.CLAMP) }],
  }));

  const rowSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Ghost-mode result colour (null outside ghost mode or before a result): completed text, badge, check and row tint.
  const ghostColor = isGhost && ghostResult
    ? (ghostResult === 'win' ? colors.accentGreen : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary)
    : null;
  const flashColor = ghostColor ?? colors.accentGreen;
  const flashOverlayStyle = useAnimatedStyle(() => ({
    backgroundColor: flashColor,
    opacity: interpolate(flashAnim.value, [0, 1], [0, 0.15]),
  }));

  // Fade in on mount
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 200 });
    return () => {
      cancelAnimation(translateX);
      cancelAnimation(fadeAnim);
      cancelAnimation(flashAnim);
      cancelAnimation(rowHeight);
      cancelAnimation(rowOpacity);
      cancelAnimation(rowMargin);
    };
  }, []);

  /* ── Callback refs (always fresh for gesture) ────── */

  // The pan gesture below is built once per canDelete, so everything it calls goes through refs.
  // (It used to capture the first onUpdate: after an earlier exercise was removed, swipe-to-complete
  // wrote the suggested kg/reps into the wrong exercise.)
  const onToggleRef = useRef(onToggle);
  const onDeleteRef = useRef(onDelete);
  const onUpdateRef = useRef(onUpdate);
  const indexRef = useRef(index);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { indexRef.current = index; }, [index]);

  /* ── JS-thread callbacks for gestures ─────────────── */

  const suggestedKgRef = useRef(suggestedKg);
  const suggestedRepsRef = useRef(suggestedReps);
  useEffect(() => { suggestedKgRef.current = suggestedKg; }, [suggestedKg]);
  useEffect(() => { suggestedRepsRef.current = suggestedReps; }, [suggestedReps]);

  const fireComplete = useCallback(() => {
    if (!localKgRef.current && suggestedKgRef.current) {
      setLocalKg(suggestedKgRef.current);
      onUpdateRef.current(indexRef.current, 'kg', suggestedKgRef.current);
    }
    if (!localRepsRef.current && suggestedRepsRef.current) {
      setLocalReps(suggestedRepsRef.current);
      onUpdateRef.current(indexRef.current, 'reps', suggestedRepsRef.current);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleRef.current(indexRef.current);
  }, []);

  const deleteHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  /* ── Delete collapse ─────────────────────────────── */

  // Rows are keyed by position, so after a delete this row shows the next set. The swiped set is
  // recorded when the swipe ends and removed by identity once the collapse has finished (an earlier
  // row's delete can shift it to another row meanwhile). The collapse is undone as soon as the row
  // holds a different set (or, if the store refused the delete, shortly after), so no row stays invisible.
  const setRef = useRef(set);
  setRef.current = set;
  const deletedSetRef = useRef<ActiveSet | null>(null);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCollapse = useCallback(() => {
    deletedSetRef.current = null;
    cancelAnimation(translateX);
    cancelAnimation(rowOpacity);
    cancelAnimation(rowHeight);
    cancelAnimation(rowMargin);
    translateX.value = 0;
    rowOpacity.value = 1;
    rowHeight.value = ROW_HEIGHT;
    rowMargin.value = sw(1);
  }, []);

  // True from the end of a delete swipe until the collapse finishes or is undone
  const collapsingRef = useRef(false);
  const markDeleting = useCallback(() => {
    deletedSetRef.current = setRef.current;
    collapsingRef.current = true;
  }, []);

  useEffect(() => {
    const target = deletedSetRef.current;
    if (target && target !== set) {
      // The swiped set moved to another row before the collapse finished: delete it now (a no-op
      // if it's already gone, e.g. this row's own delete just went through).
      const collapsing = collapsingRef.current;
      collapsingRef.current = false;
      resetCollapse();
      if (collapsing) onDeleteRef.current?.(indexRef.current, target);
    }
  }, [set, resetCollapse]);

  useEffect(() => () => {
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    // Unmounted mid-collapse (an earlier quick delete shortened the list): the collapse won't finish,
    // so delete the swiped set now. By identity, so it's a no-op if it's gone or the exercise was removed.
    if (collapsingRef.current && deletedSetRef.current) {
      collapsingRef.current = false;
      onDeleteRef.current?.(indexRef.current, deletedSetRef.current);
    }
  }, []);

  const fireDelete = useCallback(() => {
    const target = deletedSetRef.current;
    collapsingRef.current = false;
    if (!target) return;
    onDeleteRef.current?.(indexRef.current, target);
    // Still the same set: the delete didn't happen (e.g. the workout is being saved)
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    restoreTimer.current = setTimeout(() => {
      restoreTimer.current = null;
      if (deletedSetRef.current && deletedSetRef.current === setRef.current) resetCollapse();
    }, 150);
  }, [resetCollapse]);

  /* ── Gesture Handler pan ─────────────────────────── */

  const canDelete = !!onDelete;

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-15, 15])
      .onUpdate((e) => {
        'worklet';
        const maxRight = SWIPE_THRESHOLD + 20;
        const maxLeft = canDelete ? -(SWIPE_THRESHOLD + 20) : 0;
        translateX.value = Math.max(maxLeft, Math.min(maxRight, e.translationX));
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationX > SWIPE_THRESHOLD) {
          // Complete
          translateX.value = withSequence(
            withTiming(SWIPE_THRESHOLD + 10, { duration: 80 }),
            withTiming(0, { duration: 180 }),
          );
          flashAnim.value = withSequence(
            withTiming(1, { duration: 100 }),
            withTiming(0, { duration: 300 }),
          );
          runOnJS(fireComplete)();
        } else if (e.translationX < -SWIPE_THRESHOLD && canDelete) {
          // Delete: slide out, collapse, then remove the set
          runOnJS(deleteHaptic)();
          runOnJS(markDeleting)();
          translateX.value = withTiming(-400, { duration: 200 });
          rowOpacity.value = withDelay(100, withTiming(0, { duration: 150 }));
          rowMargin.value = withDelay(150, withTiming(0, { duration: 200 }));
          rowHeight.value = withDelay(150, withTiming(0, { duration: 200 }, (finished) => {
            if (finished) runOnJS(fireDelete)();
          }));
        } else {
          translateX.value = withTiming(0, { duration: 180 });
        }
      }),
  [canDelete]);

  /* ── Set type config ───────────────────────────────── */

  const typeColor = setTypeStyle(colors, set.set_type)?.color;
  const typeConfig = typeColor
    ? { bg: typeColor + '18', color: typeColor }
    : { bg: colors.surface, color: colors.textSecondary };

  /* ── Render ────────────────────────────────────────── */

  const badgeLabel = isDropSet && dropIndex != null ? `D${dropIndex + 1}` : `S${index + 1}`;

  return (
    <Animated.View style={[styles.wrapper, wrapperStyle, isDropSet && styles.wrapperDrop]}>
      {/* Drop set connecting line */}
      {isDropSet && <View style={styles.dropLine} />}
      {/* Background actions */}
      <View style={styles.actionsContainer}>
        {/* Left: complete */}
        <Animated.View
          style={[
            styles.actionLeft,
            { backgroundColor: colors.accentGreen + '0A' },
            leftActionAnimStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.actionIconCircle,
              { backgroundColor: colors.accentGreen + '20' },
              leftIconStyle,
            ]}
          >
            <Ionicons name="checkmark" size={ms(20)} color={colors.accentGreen} />
          </Animated.View>
        </Animated.View>

        {/* Right: delete */}
        {onDelete && (
          <Animated.View
            style={[
              styles.actionRight,
              { backgroundColor: colors.accentRed + '0A' },
              rightActionAnimStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.actionIconCircle,
                { backgroundColor: colors.accentRed + '20' },
                rightIconStyle,
              ]}
            >
              <Ionicons name="trash" size={ms(18)} color={colors.accentRed} />
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {/* Swipeable row */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.row,
            completed && (ghostColor
              ? { backgroundColor: ghostColor + '08', borderColor: ghostColor + '15' }
              : styles.rowCompleted),
            rowSwipeStyle,
          ]}
        >
          {/* Green flash overlay */}
          <Animated.View
            style={[StyleSheet.absoluteFill, flashOverlayStyle]}
            pointerEvents="none"
          />

          {/* Set number / type badge */}
          <View style={[styles.setNumBadge, { backgroundColor: typeConfig.bg }]}>
            <Text style={[styles.setNumText, { color: completed ? (ghostColor ?? colors.accentGreen) : typeConfig.color }]}>
              {badgeLabel}
            </Text>
          </View>

          {/* Previous performance — hidden in ghost mode */}
          {!isGhost && (
            <Pressable
              style={styles.prevContainer}
              onPress={() => {
                if (!completed && prevSet) {
                  if (showsKg(exerciseType) && prevSet.kg > 0) {
                    const kgStr = String(prevSet.kg);
                    setLocalKg(kgStr);
                    onUpdate(index, 'kg', kgStr);
                  }
                  const repsStr = String(prevSet.reps);
                  setLocalReps(repsStr);
                  onUpdate(index, 'reps', repsStr);
                  Haptics.selectionAsync();
                }
              }}
              disabled={completed || !prevSet}
            >
              <Text
                style={[styles.prevText, completed && styles.prevTextCompleted]}
                numberOfLines={1}
              >
                {formatPrev(prevSet, exerciseType)}
              </Text>
            </Pressable>
          )}

          <SetRowInputs
            styles={styles}
            index={index}
            setKg={set.kg}
            setReps={set.reps}
            localKg={localKg}
            localReps={localReps}
            setLocalKg={setLocalKg}
            setLocalReps={setLocalReps}
            suggestedKg={suggestedKg}
            suggestedReps={suggestedReps}
            exerciseType={exerciseType}
            completed={completed}
            ghostColor={ghostColor}
            onUpdate={onUpdate}
            onInputFocus={onInputFocus}
          />

          {/* Complete / uncomplete toggle */}
          <TouchableOpacity onPress={() => {
            if (!completed) {
              if (showsKg(exerciseType) && !localKg && suggestedKg) { setLocalKg(suggestedKg); onUpdate(index, 'kg', suggestedKg); }
              if (!localReps && suggestedReps) { setLocalReps(suggestedReps); onUpdate(index, 'reps', suggestedReps); }
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle(index);
          }} style={styles.checkBtn} activeOpacity={0.6}>
            <Ionicons
              name={completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={ms(22)}
              color={completed ? (ghostColor ?? colors.accentGreen) : colors.textTertiary + '60'}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default React.memo(SetRow);
