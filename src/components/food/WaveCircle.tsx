import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, ClipPath, Rect } from 'react-native-svg';
import { sw, ms } from '../../theme/responsive';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  current: number;
  goal: number;
  color: string;
  label: string;
  unit?: string;
  size?: number;
}

function WaveCircle({ current, goal, color, label, unit = 'g', size = sw(70) }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const STROKE = sw(3);
  const R = (size - STROKE * 2) / 2;
  const CX = size / 2;
  const CY = size / 2;
  const FILL_H = size - STROKE * 2;
  const CIRC = 2 * Math.PI * R;

  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(pct, { duration: 800 });
  }, [pct]);

  // Derive SVG values from the animated value
  const fillProps = useAnimatedProps(() => ({
    y: CY + R - anim.value * FILL_H,
    height: anim.value * FILL_H,
  }));

  const strokeProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - anim.value),
  }));

  const remaining = Math.max(0, Math.round(goal - current));

  return (
    <View style={[styles.wrapper, { width: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id={`clip-${label}`}>
            <Circle cx={CX} cy={CY} r={R} />
          </ClipPath>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={CX}
          cy={CY}
          r={R}
          fill={color + '10'}
          stroke={color + '30'}
          strokeWidth={STROKE}
        />

        {/* Liquid fill */}
        <AnimatedRect
          x={CX - R}
          width={R * 2}
          fill={color + '35'}
          clipPath={`url(#clip-${label})`}
          animatedProps={fillProps}
        />

        {/* Progress ring */}
        <AnimatedCircle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          rotation={-90}
          origin={`${CX}, ${CY}`}
          animatedProps={strokeProps}
        />
      </Svg>

      {/* Center text */}
      <View style={[styles.centerText, { width: size, height: size }]}>
        <Text style={[styles.value, { color }]} numberOfLines={1}>
          {Math.round(current)}
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
        <Text style={styles.unitText}>{Math.round(goal)}{unit}</Text>
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default React.memo(WaveCircle);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: sw(4),
  },
  centerText: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: sw(20),
    height: 1,
    marginVertical: sw(1),
  },
  value: {
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.extraBold,
  },
  unitText: {
    color: colors.textTertiary,
    fontSize: ms(8),
    lineHeight: ms(11),
    fontFamily: Fonts.semiBold,
  },
  label: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
  },
});
