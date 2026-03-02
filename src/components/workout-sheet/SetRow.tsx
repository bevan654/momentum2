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

interface Props {
  index: number;
  set: ActiveSet;
  prevSet: { kg: number; reps: number } | null;
  onUpdate: (field: 'kg' | 'reps', value: string) => void;
  onToggle: () => void;
  onCycleSetType: () => void;
  onDelete: (() => void) | null;
  onInputFocus?: (y: number) => void;
}

/* ── Helpers ───────────────────────────────────────────── */

function formatPrev(prevSet: { kg: number; reps: number } | null): string {
  if (!prevSet) return '—';
  return `${prevSet.kg}×${prevSet.reps}`;
}

/* ── Component ─────────────────────────────────────────── */

function SetRow({ index, set, prevSet, onUpdate, onToggle, onCycleSetType, onDelete, onInputFocus }: Props) {
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

  const flashOverlayStyle = useAnimatedStyle(() => ({
    backgroundColor: colors.accentGreen,
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

  const fireComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleRef.current();
  }, []);

  const fireDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDeleteRef.current?.();
  }, []);

  /* ── Gesture Handler pan ─────────────────────────── */

  const canDelete = !!onDelete;

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-10, 10])
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
            completed && styles.rowCompleted,
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
            {completed ? (
              <Ionicons name="checkmark" size={ms(14)} color={colors.accentGreen} />
            ) : (
              <Text style={[styles.setNumText, { color: typeConfig.color }]}>
                {typeConfig.label || (index + 1).toString()}
              </Text>
            )}
          </Pressable>

          {/* Previous performance */}
          <View style={styles.prevContainer}>
            <Text
              style={[styles.prevText, completed && styles.prevTextCompleted]}
              numberOfLines={1}
            >
              {formatPrev(prevSet)}
            </Text>
          </View>

          {/* KG input */}
          <View style={[styles.inputContainer, completed && styles.inputContainerCompleted]}>
            <TextInput
              ref={kgRef}
              style={[styles.input, completed && styles.inputTextCompleted]}
              value={localKg}
              onChangeText={(v) => { setLocalKg(v); onUpdate('kg', v); }}
              onFocus={() => handleFocus(kgRef, localKg)}
              onBlur={() => { if (localKg !== set.kg) onUpdate('kg', localKg); }}
              placeholder="—"
              placeholderTextColor={colors.textTertiary + '50'}
              keyboardType="decimal-pad"
              editable={!completed}
            />
          </View>

          {/* REPS input */}
          <View style={[styles.inputContainer, completed && styles.inputContainerCompleted]}>
            <TextInput
              ref={repsRef}
              style={[styles.input, completed && styles.inputTextCompleted]}
              value={localReps}
              onChangeText={(v) => { setLocalReps(v); onUpdate('reps', v); }}
              onFocus={() => handleFocus(repsRef, localReps)}
              onBlur={() => { if (localReps !== set.reps) onUpdate('reps', localReps); }}
              placeholder="—"
              placeholderTextColor={colors.textTertiary + '50'}
              keyboardType="number-pad"
              editable={!completed}
            />
          </View>

          {/* Complete / uncomplete toggle */}
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(); }} style={styles.checkBtn} activeOpacity={0.6}>
            <Ionicons
              name={completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={ms(22)}
              color={completed ? colors.accentGreen : colors.textTertiary + '60'}
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
      fontSize: ms(12),
      fontFamily: Fonts.bold,
      lineHeight: ms(16),
      textAlign: 'center',
    },

    /* ── Previous ────────────────────────────────────── */
    prevContainer: {
      width: sw(46),
      alignItems: 'center',
    },
    prevText: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(15),
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
      fontSize: ms(14),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(18),
      textAlign: 'center',
    },
    inputTextCompleted: {
      color: colors.accentGreen,
    },

    /* ── Check button ────────────────────────────────── */
    checkBtn: {
      padding: sw(1),
    },
  });
