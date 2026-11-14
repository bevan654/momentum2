import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { STATUS_PHRASES } from './macroLensTypes';

type AnimStyle = React.ComponentProps<typeof Animated.View>['style'];

const PulsingDot = React.memo(function PulsingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[dotStyles.dot, style]} />;
});

const dotStyles = StyleSheet.create({
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
    backgroundColor: '#FFF',
  },
});

/** "Identifying food..." state: spinning aperture, cycling status phrase and three pulsing dots. */
function AnalyzingView({ statusIdx, sparkleStyle }: { statusIdx: number; sparkleStyle: AnimStyle }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.analyzeWrap}
    >
      <View style={styles.analyzeIconRing}>
        <Animated.View style={sparkleStyle}>
          <Ionicons name="aperture" size={ms(30)} color="#FFF" />
        </Animated.View>
      </View>
      <Animated.Text
        key={statusIdx}
        entering={FadeIn.duration(280)}
        exiting={FadeOut.duration(220)}
        style={styles.analyzeText}
      >
        {STATUS_PHRASES[statusIdx]}
      </Animated.Text>
      <View style={styles.dotRow}>
        {[0, 1, 2].map((i) => (
          <PulsingDot key={i} delay={i * 180} />
        ))}
      </View>
    </Animated.View>
  );
}

export default React.memo(AnalyzingView);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  analyzeWrap: {
    alignItems: 'center',
    gap: sw(14),
  },
  analyzeIconRing: {
    width: sw(72),
    height: sw(72),
    borderRadius: sw(36),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeText: {
    color: '#FFF',
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  dotRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginTop: sw(2),
  },
});
