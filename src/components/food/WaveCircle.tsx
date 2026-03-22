import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  Circle as SkiaCircle,
  Rect as SkiaRect,
  Group,
  Skia,
} from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming } from 'react-native-reanimated';
import { sw, ms } from '../../theme/responsive';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';

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

  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(pct, { duration: 800 });
  }, [pct]);

  // Clip path for liquid fill (circle)
  const clipPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(CX, CY, R);
    return p;
  }, [CX, CY, R]);

  // Progress arc path (starts from top, clockwise)
  const arcPath = useMemo(() => {
    const p = Skia.Path.Make();
    const rect = Skia.XYWHRect(CX - R, CY - R, R * 2, R * 2);
    p.addArc(rect, -90, 360);
    return p;
  }, [CX, CY, R]);

  // Animated fill position (rises from bottom)
  const fillY = useDerivedValue(() => CY + R - anim.value * FILL_H);
  const fillHeight = useDerivedValue(() => anim.value * FILL_H);

  const remaining = Math.max(0, Math.round(goal - current));

  return (
    <View style={[styles.wrapper, { width: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Background circle */}
        <SkiaCircle cx={CX} cy={CY} r={R} color={color + '10'} />
        <SkiaCircle
          cx={CX} cy={CY} r={R}
          style="stroke"
          strokeWidth={STROKE}
          color={color + '30'}
        />

        {/* Liquid fill (clipped to circle) */}
        <Group clip={clipPath}>
          <SkiaRect
            x={CX - R}
            y={fillY}
            width={R * 2}
            height={fillHeight}
            color={color + '35'}
          />
        </Group>

        {/* Progress ring */}
        <SkiaPath
          path={arcPath}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="round"
          color={color}
          start={0}
          end={anim}
        />
      </Canvas>

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
