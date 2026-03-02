import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  SweepGradient,
  BlurMask,
  vec,
  Skia,
} from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

/* ─── Ring geometry ───────────────────────────────────── */

const RING_SIZE = sw(44);
const RING_STROKE = sw(4);
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;

/* ─── Component ────────────────────────────────────────── */

interface MacroCardProps {
  label: string;
  current: number;
  goal: number;
  color: string;
}

function MacroCard({ label, current, goal, color }: MacroCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const rawProgress = goal > 0 ? current / goal : 0;
  const clampedProgress = Math.min(rawProgress, 1);
  const isOver = rawProgress > 1;
  const displayColor = isOver ? colors.accentRed : color;

  // Animated ring fill
  const animEnd = useSharedValue(0);
  useEffect(() => {
    animEnd.value = withTiming(clampedProgress, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [clampedProgress]);

  // Full circle from top (–90°), clockwise
  const ringPath = useMemo(() => {
    const p = Skia.Path.Make();
    const rect = Skia.XYWHRect(
      RING_STROKE / 2, RING_STROKE / 2,
      RING_SIZE - RING_STROKE, RING_SIZE - RING_STROKE,
    );
    p.addArc(rect, -90, 360);
    return p;
  }, []);

  return (
    <View style={styles.card}>
      {/* Skia ring */}
      <View style={styles.ringWrap}>
        <Canvas style={styles.ringCanvas}>
          {/* Track */}
          <SkiaPath
            path={ringPath}
            style="stroke"
            strokeWidth={RING_STROKE}
            strokeCap="round"
            color={colors.ring.track}
          />
          {/* Glow */}
          <SkiaPath
            path={ringPath}
            style="stroke"
            strokeWidth={RING_STROKE + sw(4)}
            strokeCap="round"
            end={animEnd}
            color={displayColor + '20'}
          >
            <BlurMask blur={sw(6)} style="normal" />
          </SkiaPath>
          {/* Progress fill */}
          <SkiaPath
            path={ringPath}
            style="stroke"
            strokeWidth={RING_STROKE}
            strokeCap="round"
            end={animEnd}
          >
            <SweepGradient
              c={vec(RING_CENTER, RING_CENTER)}
              colors={[displayColor + '60', displayColor, displayColor]}
            />
          </SkiaPath>
        </Canvas>

        {/* Grams inside ring */}
        <View style={styles.ringCenter}>
          <Text style={[styles.ringValue, { color: displayColor }]}>
            {current}
            <Text style={styles.ringUnit}>g</Text>
          </Text>
        </View>
      </View>

      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${clampedProgress * 100}%`,
              backgroundColor: displayColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default React.memo(MacroCard);

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: sw(14),
      paddingTop: sw(10),
      paddingBottom: sw(10),
      paddingHorizontal: sw(8),
      alignItems: 'center',
      ...colors.cardShadow,
    },
    ringWrap: {
      width: RING_SIZE,
      height: RING_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ringCanvas: {
      width: RING_SIZE,
      height: RING_SIZE,
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringValue: {
      fontSize: ms(13),
      lineHeight: ms(16),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    ringUnit: {
      fontSize: ms(9),
      fontFamily: Fonts.regular,
      color: colors.textTertiary,
    },
    label: {
      color: colors.textSecondary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      marginTop: sw(4),
    },
    barTrack: {
      width: '100%',
      height: sw(3),
      backgroundColor: colors.ring.track,
      borderRadius: sw(2),
      marginTop: sw(6),
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: sw(2),
    },
  });
