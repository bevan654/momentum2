import React, { useEffect, useRef, useMemo } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function FloatingWorkoutBanner() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const sheetVisible = useActiveWorkoutStore((s) => s.sheetVisible);
  const elapsedSeconds = useActiveWorkoutStore((s) => s.elapsedSeconds);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);

  const shouldShow = isActive && !sheetVisible;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const wasVisible = useRef(false);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (shouldShow && !wasVisible.current) {
      wasVisible.current = true;
      translateY.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(1, { duration: 150 });
    } else if (!shouldShow && wasVisible.current) {
      wasVisible.current = false;
      translateY.value = withTiming(20, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [shouldShow]);

  if (!isActive) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showSheet(); // opens sheet immediately — banner hides via shouldShow flipping false
  };

  return (
    <Animated.View
      style={[styles.wrapper, bannerStyle]}
      pointerEvents={shouldShow ? 'auto' : 'none'}
    >
      <TouchableOpacity style={styles.banner} onPress={handlePress} activeOpacity={0.85}>
        <View style={styles.pulse} />
        <Ionicons name="barbell-outline" size={ms(16)} color={colors.textOnAccent} />
        <Text style={styles.text}>Workout in Progress</Text>
        <Text style={styles.timer}>{formatElapsed(elapsedSeconds)}</Text>
        <Ionicons name="chevron-up" size={ms(16)} color={colors.textOnAccent} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    marginHorizontal: sw(12),
    marginBottom: sw(6),
  },
  banner: {
    backgroundColor: colors.accentGreen,
    borderRadius: sw(14),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
    paddingHorizontal: sw(14),
    gap: sw(8),
    shadowColor: colors.accentGreen,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pulse: {
    width: sw(8),
    height: sw(8),
    borderRadius: sw(4),
    backgroundColor: colors.textOnAccent,
  },
  text: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flex: 1,
  },
  timer: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(20),
    fontVariant: ['tabular-nums'],
  },
});
