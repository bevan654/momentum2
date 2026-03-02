import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { sw } from '../../theme/responsive';

const PARTICLE_COUNT = 32;
const BURST_DURATION = 400;
const FALL_DURATION = 1400;

const DEFAULT_COLORS = [
  '#FFD700', // gold
  '#FFA500', // orange
  '#FF6B6B', // coral
  '#4ECDC4', // teal
  '#45B7D1', // sky
  '#F7DC6F', // yellow
  '#BB8FCE', // lavender
  '#82E0AA', // mint
  '#FFFFFF', // white
];

interface Particle {
  color: string;
  size: number;
  delay: number;
  endX: number;
  peakY: number;
  endY: number;
  rotation: number;
  isRect: boolean;
}

function ConfettiPiece({ p }: { p: Particle }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    // Horizontal: drift outward
    translateX.value = withDelay(
      p.delay,
      withTiming(p.endX, {
        duration: BURST_DURATION + FALL_DURATION,
        easing: Easing.out(Easing.quad),
      }),
    );

    // Vertical: burst UP then arc DOWN (two-phase)
    translateY.value = withDelay(
      p.delay,
      withSequence(
        withTiming(-p.peakY, {
          duration: BURST_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(p.endY, {
          duration: FALL_DURATION,
          easing: Easing.in(Easing.quad),
        }),
      ),
    );

    // Rotation
    rotate.value = withDelay(
      p.delay,
      withTiming(p.rotation, {
        duration: BURST_DURATION + FALL_DURATION,
        easing: Easing.out(Easing.quad),
      }),
    );

    // Opacity: instant on, hold, fade out in final 40%
    opacity.value = withDelay(
      p.delay,
      withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(1, { duration: BURST_DURATION + FALL_DURATION * 0.6 }),
        withTiming(0, { duration: FALL_DURATION * 0.4 }),
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: p.size,
          height: p.isRect ? p.size * 2.5 : p.size,
          backgroundColor: p.color,
          borderRadius: p.isRect ? 1 : p.size / 2,
        },
        style,
      ]}
    />
  );
}

interface Props {
  colors?: string[];
}

export default function Confetti({ colors = DEFAULT_COLORS }: Props) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 0.6 + 0.4; // 0.4–1.0

      return {
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 4 + 3,
        delay: Math.random() * 150,
        endX: Math.cos(angle) * (80 + Math.random() * 100) * velocity,
        peakY: 60 + Math.random() * 100 * velocity,
        endY: 120 + Math.random() * 200,
        rotation: (Math.random() - 0.5) * 720,
        isRect: Math.random() > 0.4,
      };
    });
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiPiece key={i} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: sw(46),
    left: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 100,
  },
});
