import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { formatCountdown } from '../../utils/formatDuration';

const ADJUST_STEP = 15;
const DONE_VISIBLE_MS = 3000;
const FINAL_SECONDS = 10;

/**
 * Thin rest countdown rendered inside an exercise card, directly under the set
 * that started the rest. Reads the timer from the store itself so only this
 * row re-renders on each tick. Shows a short "rest done" line when the rest
 * runs out on its own; renders nothing otherwise.
 */
function RestInlineRow() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isResting = useActiveWorkoutStore((s) => s.isResting);
  const remaining = useActiveWorkoutStore((s) => s.restRemaining);
  const total = useActiveWorkoutStore((s) => s.restTotal);
  const restEndedAt = useActiveWorkoutStore((s) => s.restEndedAt);
  const adjustRest = useActiveWorkoutStore((s) => s.adjustRest);
  const stopRest = useActiveWorkoutStore((s) => s.stopRest);

  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    if (!restEndedAt) return;
    const left = DONE_VISIBLE_MS - (Date.now() - restEndedAt);
    if (left <= 0) return;
    setShowDone(true);
    const t = setTimeout(() => setShowDone(false), left);
    return () => clearTimeout(t);
  }, [restEndedAt]);
  useEffect(() => {
    if (isResting) setShowDone(false);
  }, [isResting]);

  const resting = isResting && remaining > 0;
  const finalStretch = resting && remaining <= FINAL_SECONDS;

  const ratio = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [ratio, progress]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  if (!resting && !showDone) return null;

  if (!resting) {
    return (
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(250)} style={styles.row}>
        <View style={[styles.rule, { backgroundColor: colors.accent + '40' }]} />
        <Ionicons name="checkmark-circle" size={ms(13)} color={colors.accent} />
        <Text style={[styles.label, { color: colors.accent }]}>Rest done — go</Text>
        <View style={[styles.rule, { backgroundColor: colors.accent + '40' }]} />
      </Animated.View>
    );
  }

  const tap = (fn: () => void) => () => {
    Haptics.selectionAsync().catch(() => {});
    fn();
  };
  const tint = finalStretch ? colors.accent : colors.textPrimary;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.row}>
      <Text style={styles.label}>Rest</Text>
      <Text style={[styles.time, { color: tint }]}>{formatCountdown(remaining)}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: tint, width: '100%', transformOrigin: 'left' }, fillStyle]} />
      </View>
      <TouchableOpacity
        style={styles.btn}
        onPress={tap(() => adjustRest(ADJUST_STEP))}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={`Add ${ADJUST_STEP} seconds of rest`}
      >
        <Text style={styles.btnText}>+{ADJUST_STEP}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={tap(stopRest)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Skip rest"
      >
        <Ionicons name="play-skip-forward" size={ms(11)} color={colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default React.memo(RestInlineRow);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingHorizontal: sw(6),
    paddingVertical: sw(5),
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  label: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: {
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
    fontVariant: ['tabular-nums'],
    minWidth: sw(30),
  },
  track: {
    flex: 1,
    height: sw(3),
    borderRadius: sw(2),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: sw(2),
  },
  btn: {
    minWidth: sw(30),
    height: sw(22),
    paddingHorizontal: sw(6),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sw(6),
    backgroundColor: colors.surface,
  },
  btnText: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
    fontVariant: ['tabular-nums'],
  },
});
