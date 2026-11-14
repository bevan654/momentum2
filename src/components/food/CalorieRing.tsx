import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, BlurMask, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

const SIZE = sw(124);
const STROKE = sw(10);
const GLOW_PAD = sw(14);
const CANVAS = SIZE + GLOW_PAD * 2;
const CENTER = CANVAS / 2;
const RADIUS = SIZE / 2 - STROKE / 2;

interface Props {
  eaten: number;
  goal: number;
}

/** Calorie ring: fills as calories are eaten, with what's left (or over) in the middle. */
function CalorieRing({ eaten, goal }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progress = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const isOver = goal > 0 && eaten > goal;
  const color = isOver ? colors.accentRed : progress >= 0.9 ? colors.accentOrange : colors.accent;

  const end = useSharedValue(0);
  useEffect(() => {
    end.value = withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(CENTER - RADIUS, CENTER - RADIUS, RADIUS * 2, RADIUS * 2), -90, 360);
    return p;
  }, []);

  const value = isOver ? eaten - goal : Math.max(0, goal - eaten);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Canvas style={styles.canvas}>
        <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colors.ring.track} />
        <Path path={path} style="stroke" strokeWidth={STROKE + sw(8)} strokeCap="round" end={end} color={color + '26'}>
          <BlurMask blur={sw(10)} style="normal" />
        </Path>
        <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" end={end} color={color} />
      </Canvas>
      <View style={styles.center}>
        <Text style={[styles.value, isOver && styles.over]} numberOfLines={1} adjustsFontSizeToFit>
          {value.toLocaleString()}
        </Text>
        <Text style={[styles.label, isOver && styles.over]}>{isOver ? 'kcal over' : 'kcal left'}</Text>
      </View>
    </View>
  );
}

export default React.memo(CalorieRing);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      width: SIZE,
      height: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    canvas: {
      position: 'absolute',
      width: CANVAS,
      height: CANVAS,
      left: -GLOW_PAD,
      top: -GLOW_PAD,
    },
    center: {
      alignItems: 'center',
      paddingHorizontal: sw(14),
    },
    value: {
      color: colors.textPrimary,
      fontSize: ms(28),
      lineHeight: ms(32),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1,
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    over: {
      color: colors.accentRed,
    },
  });
