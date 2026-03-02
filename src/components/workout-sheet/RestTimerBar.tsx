import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

/* Self-contained — reads directly from the store so the parent
   never re-renders because of rest-timer state changes. */
function RestTimerBar() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isResting = useActiveWorkoutStore((s) => s.isResting);
  const remaining = useActiveWorkoutStore((s) => s.restRemaining);
  const total = useActiveWorkoutStore((s) => s.restDuration);

  const progress = useSharedValue(remaining / total);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  useEffect(() => {
    progress.value = withTiming(remaining / total, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [remaining]);

  if (!isResting || remaining <= 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Rest</Text>
        <Text style={styles.time}>{formatTime(remaining)}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: '100%', transformOrigin: 'left' }, fillStyle]}
        />
      </View>
    </View>
  );
}

export default React.memo(RestTimerBar);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: sw(16),
    paddingVertical: sw(8),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: sw(6),
  },
  label: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
  },
  time: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
  track: {
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: sw(2),
  },
});
