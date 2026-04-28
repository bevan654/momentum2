import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw } from '../theme/responsive';

const AnimatedG = Animated.createAnimatedComponent(G);

// Native viewBox: 210 x 90 (the M-mark only). Display width 220 → ~94px tall.
const LOGO_W = sw(220);
const LOGO_H = LOGO_W * (90 / 210);

type TriDef = {
  d: string;
  ox: number;       // entrance offset X (in viewBox units → scaled visually)
  oy: number;
  delay: number;    // ms
};

const TRIS: TriDef[] = [
  { d: 'M70.4037 44.1774H23.4633L0 88.3549H46.9266L70.4037 44.1774Z',          ox: -180, oy:  120, delay: 100 },
  { d: 'M70.4033 44.1774H117.344L140.807 88.3549H93.8666L70.4033 44.1774Z',     ox: -100, oy:  120, delay: 220 },
  { d: 'M46.9268 0H93.8671L117.344 44.1775H70.4038L46.9268 0Z',                  ox:  -60, oy: -140, delay: 340 },
  { d: 'M138.883 44.1774H185.823L209.286 88.3549H162.36L138.883 44.1774Z',       ox:  100, oy:  120, delay: 460 },
  { d: 'M115.419 0H162.36L185.823 44.1775H138.883L115.419 0Z',                   ox:   60, oy: -140, delay: 580 },
  { d: 'M161.989 0H115.048L91.585 44.1775H138.512L161.989 0Z',                   ox:    0, oy: -160, delay: 700 },
];

const ENTRANCE_DURATION = 1100;
const FLASH_DURATION = 450;

function Triangle({ tri }: { tri: TriDef }) {
  const progress = useSharedValue(0); // 0 → 1 entrance
  const flash = useSharedValue(1);    // brightness multiplier (1 = normal)

  useEffect(() => {
    progress.value = withDelay(
      tri.delay,
      withTiming(1, { duration: ENTRANCE_DURATION, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
    // Flash sequence kicks in just before entrance settles
    flash.value = withDelay(
      tri.delay + ENTRANCE_DURATION - FLASH_DURATION + 200,
      withSequence(
        withTiming(2.6, { duration: 60 }),
        withTiming(1.1, { duration: 80 }),
        withTiming(2.0, { duration: 80 }),
        withTiming(1.0, { duration: 120 }),
      ),
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const tx = tri.ox * (1 - progress.value);
    const ty = tri.oy * (1 - progress.value);
    const sc = 0.7 + 0.3 * progress.value;
    const op = Math.min(progress.value * 3, 1);
    return {
      opacity: op,
      x: tx,
      y: ty,
      scale: sc,
      originX: 105, // viewBox center
      originY: 45,
    } as any;
  });

  const flashStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (flash.value - 1) / 1.6),
  }));

  return (
    <>
      <AnimatedG animatedProps={animatedProps}>
        <Path d={tri.d} fill="url(#mGrad)" />
      </AnimatedG>
      {/* White overlay path used to fake a brightness flash */}
      <AnimatedG animatedProps={animatedProps} style={flashStyle}>
        <Path d={tri.d} fill="#ffffff" />
      </AnimatedG>
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0.25);
  useEffect(() => {
    v.value = withDelay(
      1900 + delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.8 + 0.35 * v.value }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export default function LoadingScreen() {
  const colors = useColors();
  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: colors.background }],
    [colors.background],
  );

  return (
    <View style={containerStyle}>
      <View style={{ width: LOGO_W, height: LOGO_H }}>
        <Svg width={LOGO_W} height={LOGO_H} viewBox="0 0 210 90">
          <Defs>
            <LinearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF5050" />
              <Stop offset="1" stopColor="#B81414" />
            </LinearGradient>
          </Defs>
          {TRIS.map((tri, i) => (
            <Triangle key={i} tri={tri} />
          ))}
        </Svg>
      </View>

      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={180} />
        <Dot delay={360} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: sw(10),
    marginTop: sw(40),
  },
  dot: {
    width: sw(8),
    height: sw(8),
    borderRadius: sw(4),
    backgroundColor: '#FF5050',
  },
});
