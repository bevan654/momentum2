import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
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
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { ActiveSet } from '../../stores/useActiveWorkoutStore';

/* ── Constants ─────────────────────────────────────────── */

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = sw(72);
const ROW_HEIGHT = sw(42);

/* ── Props ─────────────────────────────────────────────── */

type ExerciseType = 'weighted' | 'bodyweight' | 'duration' | 'weighted+bodyweight';

interface Props {
  index: number;
  set: ActiveSet;
  prevSet: { kg: number; reps: number } | null;
  suggestedKg?: string;
  suggestedReps?: string;
  exerciseType?: ExerciseType;
  onUpdate: (field: 'kg' | 'reps', value: string) => void;
  onToggle: () => void;
  onCycleSetType: () => void;
  onDelete: (() => void) | null;
  onInputFocus?: (y: number) => void;
  isGhost?: boolean;
  ghostResult?: 'win' | 'loss' | 'tie' | null;
}

/* ── Helpers ───────────────────────────────────────────── */

function formatPrev(prevSet: { kg: number; reps: number } | null, exerciseType?: ExerciseType): string {
  if (!prevSet) return '—';
  if (exerciseType === 'duration') return formatTimeDisplay(String(prevSet.reps));
  if (exerciseType === 'bodyweight') return `${prevSet.reps}`;
  return `${prevSet.kg}×${prevSet.reps}`;
}

/** Convert seconds string to mm:ss display */
function formatTimeDisplay(secs: string): string {
  const n = parseInt(secs, 10);
  if (isNaN(n) || n <= 0) return '0:00';
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const showKg = (t?: ExerciseType) => t === 'weighted' || t === 'weighted+bodyweight' || !t;
const isDuration = (t?: ExerciseType) => t === 'duration';

/* ── Component ─────────────────────────────────────────── */

function SetRow({ index, set, prevSet, suggestedKg, suggestedReps, exerciseType, onUpdate, onToggle, onCycleSetType, onDelete, onInputFocus, isGhost, ghostResult }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const completed = set.completed;

  /* ── Local input state (prevents fast-typing race conditions) ── */
  const [localKg, setLocalKg] = useState(set.kg);
  const [localReps, setLocalReps] = useState(set.reps);
  const kgRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);

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

  const handleFocus = useCallback((inputRef: React.RefObject<TextInput>, value: string) => {
    if (value.length > 0 && inputRef.current) {
      inputRef.current.setNativeProps({ selection: { start: 0, end: value.length } });
    }
    if (onInputFocus && inputRef.current) {
      (inputRef.current as any).measureInWindow((_x: number, y: number) => {
        onInputFocus(y);
      });
    }
  }, [onInputFocus]);

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

  const ghostFlashColor = ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : ghostResult === 'tie' ? colors.textPrimary : colors.accentGreen;
  const flashOverlayStyle = useAnimatedStyle(() => ({
    backgroundColor: isGhost ? ghostFlashColor : colors.accentGreen,
    opacity: interpolate(flashAnim.value, [0, 1], [0, 0.15]),
  }));

  // Fade in on mount
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 200 });
    return () => {
      cancelAnimation(translateX);
      cancelAnimation(fadeAnim);
      cancelAnimation(flashAnim);
    };
  }, []);

  /* ── Callback refs (always fresh for gesture) ────── */

  const onToggleRef = useRef(onToggle);
  const onDeleteRef = useRef(onDelete);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  const handleCycleType = useCallback(() => {
    Haptics.selectionAsync();
    onCycleSetType();
  }, [onCycleSetType]);

  /* ── JS-thread callbacks for gestures ─────────────── */

  const suggestedKgRef = useRef(suggestedKg);
  const suggestedRepsRef = useRef(suggestedReps);
  useEffect(() => { suggestedKgRef.current = suggestedKg; }, [suggestedKg]);
  useEffect(() => { suggestedRepsRef.current = suggestedReps; }, [suggestedReps]);

  const fireComplete = useCallback(() => {
    if (!localKgRef.current && suggestedKgRef.current) {
      setLocalKg(suggestedKgRef.current);
      onUpdate('kg', suggestedKgRef.current);
    }
    if (!localRepsRef.current && suggestedRepsRef.current) {
      setLocalReps(suggestedRepsRef.current);
      onUpdate('reps', suggestedRepsRef.current);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleRef.current();
  }, [onUpdate]);

  const fireDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDeleteRef.current?.();
  }, []);

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
          // Delete: slide out then collapse
          translateX.value = withTiming(-400, { duration: 200 });
          rowOpacity.value = withDelay(100, withTiming(0, { duration: 150 }));
          rowHeight.value = withDelay(150, withTiming(0, { duration: 200 }));
          rowMargin.value = withDelay(150, withTiming(0, { duration: 200 }));
          runOnJS(fireDelete)();
        } else {
          translateX.value = withTiming(0, { duration: 180 });
        }
      }),
  [canDelete]);

  /* ── Set type config ───────────────────────────────── */

  const SET_TYPE_CONFIG: Record<string, { bg: string; color: string; label: string | null }> = {
    working: { bg: colors.surface, color: colors.textSecondary, label: null },
    warmup: { bg: colors.accentOrange + '18', color: colors.accentOrange, label: 'W' },
    drop: { bg: colors.accentPink + '18', color: colors.accentPink, label: 'D' },
    failure: { bg: colors.accentRed + '18', color: colors.accentRed, label: 'F' },
  };

  const typeConfig = SET_TYPE_CONFIG[set.set_type] || SET_TYPE_CONFIG.working;

  /* ── Render ────────────────────────────────────────── */

  return (
    <Animated.View style={[styles.wrapper, wrapperStyle]}>
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
            completed && (isGhost && ghostResult
              ? { backgroundColor: (ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary) + '08', borderColor: (ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary) + '15' }
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
          <Pressable
            onPress={handleCycleType}
            style={({ pressed }) => [
              styles.setNumBadge,
              { backgroundColor: typeConfig.bg },
              pressed && styles.setNumBadgePressed,
            ]}
          >
            <Text style={[styles.setNumText, { color: completed ? (isGhost && ghostResult ? (ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary) : colors.accentGreen) : typeConfig.color }]}>
              {`S${index + 1}`}
            </Text>
          </Pressable>

          {/* Previous performance — hidden in ghost mode */}
          {!isGhost && (
            <View style={styles.prevContainer}>
              <Text
                style={[styles.prevText, completed && styles.prevTextCompleted]}
                numberOfLines={1}
              >
                {formatPrev(prevSet, exerciseType)}
              </Text>
            </View>
          )}

          {/* KG input — only for weighted / weighted+bodyweight */}
          {showKg(exerciseType) && (
            <View style={[styles.inputContainer, completed && styles.inputContainerCompleted, !localKg && suggestedKg && styles.inputContainerSuggested]}>
              <TextInput
                ref={kgRef}
                style={[styles.input, completed && (isGhost && ghostResult ? { color: ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary } : styles.inputTextCompleted)]}
                value={localKg}
                onChangeText={(v) => { setLocalKg(v); onUpdate('kg', v); }}
                onFocus={() => handleFocus(kgRef, localKg)}
                onBlur={() => { if (localKg !== set.kg) onUpdate('kg', localKg); }}
                placeholder={suggestedKg || '—'}
                placeholderTextColor={suggestedKg ? colors.accent + '60' : colors.textTertiary + '50'}
                keyboardType="decimal-pad"
                editable={!completed}
              />
            </View>
          )}

          {/* DURATION input — time in seconds with +/- 15s steppers */}
          {isDuration(exerciseType) ? (
            <View style={[styles.repsRow, { flex: 2 }, completed && styles.repsRowCompleted]}>
              {!completed && (
                <TouchableOpacity
                  style={styles.repStepBtn}
                  onPress={() => {
                    const cur = parseInt(localReps, 10) || 0;
                    if (cur >= 15) {
                      const v = String(cur - 15);
                      setLocalReps(v);
                      onUpdate('reps', v);
                    }
                  }}
                  activeOpacity={0.5}
                >
                  <Ionicons name="remove" size={ms(12)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
              <View style={styles.timeDisplay}>
                <Ionicons name="timer-outline" size={ms(11)} color={completed ? colors.accentGreen : colors.textTertiary} style={{ marginRight: sw(3) }} />
                <TextInput
                  ref={repsRef}
                  style={[styles.repsInput, completed && (isGhost && ghostResult ? { color: ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary } : styles.inputTextCompleted)]}
                  value={localReps ? formatTimeDisplay(localReps) : ''}
                  onChangeText={(v) => {
                    // Strip non-numeric, treat raw input as seconds
                    const raw = v.replace(/[^0-9]/g, '');
                    setLocalReps(raw);
                    onUpdate('reps', raw);
                  }}
                  onFocus={() => handleFocus(repsRef, localReps)}
                  onBlur={() => { if (localReps !== set.reps) onUpdate('reps', localReps); }}
                  placeholder="0:00"
                  placeholderTextColor={colors.textTertiary + '50'}
                  keyboardType="number-pad"
                  editable={!completed}
                />
              </View>
              {!completed && (
                <TouchableOpacity
                  style={styles.repStepBtn}
                  onPress={() => {
                    const cur = parseInt(localReps, 10) || 0;
                    const v = String(cur + 15);
                    setLocalReps(v);
                    onUpdate('reps', v);
                  }}
                  activeOpacity={0.5}
                >
                  <Ionicons name="add" size={ms(12)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* REPS input with +/- 1 steppers */
            <View style={[styles.repsRow, completed && styles.repsRowCompleted, !localReps && suggestedReps && styles.repsRowSuggested]}>
              {!completed && (
                <TouchableOpacity
                  style={styles.repStepBtn}
                  onPress={() => {
                    const cur = parseInt(localReps, 10) || 0;
                    if (cur > 0) {
                      const v = String(cur - 1);
                      setLocalReps(v);
                      onUpdate('reps', v);
                    }
                  }}
                  activeOpacity={0.5}
                >
                  <Ionicons name="remove" size={ms(12)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
              <TextInput
                ref={repsRef}
                style={[styles.repsInput, completed && (isGhost && ghostResult ? { color: ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary } : styles.inputTextCompleted)]}
                value={localReps}
                onChangeText={(v) => { setLocalReps(v); onUpdate('reps', v); }}
                onFocus={() => handleFocus(repsRef, localReps)}
                onBlur={() => { if (localReps !== set.reps) onUpdate('reps', localReps); }}
                placeholder={suggestedReps || '—'}
                placeholderTextColor={suggestedReps ? colors.accent + '60' : colors.textTertiary + '50'}
                keyboardType="number-pad"
                editable={!completed}
              />
              {!completed && (
                <TouchableOpacity
                  style={styles.repStepBtn}
                  onPress={() => {
                    const cur = parseInt(localReps, 10) || 0;
                    const v = String(cur + 1);
                    setLocalReps(v);
                    onUpdate('reps', v);
                  }}
                  activeOpacity={0.5}
                >
                  <Ionicons name="add" size={ms(12)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Complete / uncomplete toggle */}
          <TouchableOpacity onPress={() => {
            if (!completed) {
              if (showKg(exerciseType) && !localKg && suggestedKg) { setLocalKg(suggestedKg); onUpdate('kg', suggestedKg); }
              if (!localReps && suggestedReps) { setLocalReps(suggestedReps); onUpdate('reps', suggestedReps); }
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle();
          }} style={styles.checkBtn} activeOpacity={0.6}>
            <Ionicons
              name={completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={ms(22)}
              color={completed ? (isGhost && ghostResult ? (ghostResult === 'win' ? '#34C759' : ghostResult === 'loss' ? colors.accentRed : colors.textPrimary) : colors.accentGreen) : colors.textTertiary + '60'}
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default React.memo(SetRow);

/* ── Styles ────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: sw(10),
    },

    /* ── Background actions ──────────────────────────── */
    actionsContainer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: sw(10),
      overflow: 'hidden',
    },
    actionLeft: {
      width: ACTION_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionRight: {
      width: ACTION_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionIconCircle: {
      width: sw(30),
      height: sw(30),
      borderRadius: sw(15),
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* ── Row ──────────────────────────────────────────── */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(5),
      paddingHorizontal: sw(6),
      gap: sw(6),
      borderRadius: sw(10),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rowCompleted: {
      backgroundColor: colors.accentGreen + '08',
      borderColor: colors.accentGreen + '15',
    },

    /* ── Set number badge ────────────────────────────── */
    setNumBadge: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(8),
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumBadgePressed: {
      opacity: 0.6,
      transform: [{ scale: 0.9 }],
    },
    setNumText: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
      textAlign: 'center',
    },

    /* ── Previous ────────────────────────────────────── */
    prevContainer: {
      width: sw(46),
      alignItems: 'center',
    },
    prevText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
      textAlign: 'center',
    },
    prevTextCompleted: {
      color: colors.textTertiary + '80',
    },

    /* ── Inputs ──────────────────────────────────────── */
    inputContainer: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      borderWidth: 1,
      borderColor: colors.surface,
    },
    inputContainerCompleted: {
      backgroundColor: colors.accentGreen + '08',
      borderColor: colors.accentGreen + '18',
    },
    input: {
      paddingVertical: sw(6),
      paddingHorizontal: sw(6),
      color: colors.textPrimary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(15),
      textAlign: 'center',
    },
    inputTextCompleted: {
      color: colors.accentGreen,
    },
    inputContainerSuggested: {
      borderColor: colors.accent + '30',
      backgroundColor: colors.accent + '08',
    },

    /* ── Reps row with steppers ────────────────────── */
    repsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      borderWidth: 1,
      borderColor: colors.surface,
      height: sw(32),
    },
    repsRowCompleted: {
      backgroundColor: colors.accentGreen + '08',
      borderColor: colors.accentGreen + '18',
    },
    repsRowSuggested: {
      borderColor: colors.accent + '30',
      backgroundColor: colors.accent + '08',
    },
    repsInput: {
      flex: 1,
      paddingVertical: 0,
      paddingHorizontal: sw(2),
      color: colors.textPrimary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      textAlign: 'center',
    },
    repStepBtn: {
      paddingHorizontal: sw(5),
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeDisplay: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Check button ────────────────────────────────── */
    checkBtn: {
      padding: sw(1),
    },
  });
