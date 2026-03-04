import React, { useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Canvas,
  Path as SkiaPath,
  BlurMask,
  Skia,
} from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useNutritionStore } from '../../stores/useNutritionStore';
import { sw, ms } from '../../theme/responsive';

/* ─── Hero ring ──────────────────────────────────────── */

const HERO_SIZE = sw(120);
const HERO_STROKE = sw(8);
const GLOW_PAD = sw(16);
const CANVAS_SIZE = HERO_SIZE + GLOW_PAD * 2;
const CANVAS_CENTER = CANVAS_SIZE / 2;
const HERO_R = HERO_SIZE / 2 - HERO_STROKE / 2;

function makeRing(cx: number, cy: number, r: number) {
  const p = Skia.Path.Make();
  p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), -90, 360);
  return p;
}

/* ─── Main component ─────────────────────────────────── */

interface Props {
  onOpenSettings?: () => void;
}

export default function NutritionCard({ onOpenSettings }: Props) {
  const { calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal } =
    useNutritionStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const calProgress = calorieGoal > 0 ? Math.min(calories / calorieGoal, 1) : 0;
  const isOver = calories > calorieGoal && calorieGoal > 0;
  const remaining = Math.max(0, calorieGoal - calories);
  const over = Math.max(0, calories - calorieGoal);

  const heroColor = isOver
    ? colors.accentRed
    : calProgress >= 0.8
      ? colors.accentOrange
      : colors.accent;

  const calEnd = useSharedValue(0);
  useEffect(() => {
    calEnd.value = withTiming(calProgress, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [calProgress]);

  const heroPath = useMemo(() => makeRing(CANVAS_CENTER, CANVAS_CENTER, HERO_R), []);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenSettings?.();
  }, [onOpenSettings]);

  const pFill = proteinGoal > 0 ? Math.min(protein / proteinGoal, 1) : 0;
  const cFill = carbsGoal > 0 ? Math.min(carbs / carbsGoal, 1) : 0;
  const fFill = fatGoal > 0 ? Math.min(fat / fatGoal, 1) : 0;
  const pOver = protein > proteinGoal && proteinGoal > 0;
  const cOver = carbs > carbsGoal && carbsGoal > 0;
  const fOver = fat > fatGoal && fatGoal > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="nutrition-outline" size={ms(13)} color={colors.accent} />
        </View>
        <Text style={styles.title}>Nutrition</Text>
      </View>

      {/* Hero ring */}
      <View style={styles.heroSection}>
        <View style={styles.heroWrap}>
          <Canvas style={styles.heroCanvas} pointerEvents="none">
            <SkiaPath path={heroPath} style="stroke" strokeWidth={HERO_STROKE} strokeCap="round" color={colors.ring.track} />
            <SkiaPath path={heroPath} style="stroke" strokeWidth={HERO_STROKE + sw(10)} strokeCap="round" end={calEnd} color={heroColor + '22'}>
              <BlurMask blur={sw(12)} style="normal" />
            </SkiaPath>
            <SkiaPath path={heroPath} style="stroke" strokeWidth={HERO_STROKE} strokeCap="round" end={calEnd} color={heroColor} />
          </Canvas>

          <View style={styles.heroCenter}>
            <Text style={[styles.calNumber, isOver && { color: colors.accentRed }]}>
              {calories}
            </Text>
            <Text style={styles.calGoal}>/ {calorieGoal}</Text>
            <Text style={[styles.calStatus, isOver && { color: colors.accentRed }]}>
              {isOver ? `${over} over` : `${remaining} left`}
            </Text>
          </View>
        </View>
      </View>

      {/* Macros — simple horizontal bars */}
      <View style={styles.macroSection}>
        {/* Protein */}
        <View style={styles.macroRow}>
          <Text style={[styles.macroLabel, { color: pOver ? colors.accentRed : colors.protein }]}>P</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pFill * 100}%`, backgroundColor: pOver ? colors.accentRed : colors.protein }]} />
          </View>
          <Text style={styles.macroValue}>{protein}<Text style={styles.macroGoal}>/{proteinGoal}</Text></Text>
        </View>

        {/* Carbs */}
        <View style={styles.macroRow}>
          <Text style={[styles.macroLabel, { color: cOver ? colors.accentRed : colors.carbs }]}>C</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${cFill * 100}%`, backgroundColor: cOver ? colors.accentRed : colors.carbs }]} />
          </View>
          <Text style={styles.macroValue}>{carbs}<Text style={styles.macroGoal}>/{carbsGoal}</Text></Text>
        </View>

        {/* Fat */}
        <View style={styles.macroRow}>
          <Text style={[styles.macroLabel, { color: fOver ? colors.accentRed : colors.fat }]}>F</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${fFill * 100}%`, backgroundColor: fOver ? colors.accentRed : colors.fat }]} />
          </View>
          <Text style={styles.macroValue}>{fat}<Text style={styles.macroGoal}>/{fatGoal}</Text></Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: sw(14),
      paddingTop: sw(12),
      paddingBottom: sw(12),
      paddingHorizontal: sw(12),
      alignItems: 'center',
      ...colors.cardShadow,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: sw(6),
      marginBottom: sw(6),
    },
    iconWrap: {
      width: sw(22),
      height: sw(22),
      borderRadius: sw(6),
      backgroundColor: colors.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },
    heroSection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroWrap: {
      width: HERO_SIZE,
      height: HERO_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCanvas: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      margin: -GLOW_PAD,
    },
    heroCenter: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calNumber: {
      color: colors.textPrimary,
      fontSize: ms(24),
      lineHeight: ms(28),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.8,
    },
    calGoal: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    calStatus: {
      color: colors.textSecondary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
      marginTop: sw(1),
    },
    macroSection: {
      alignSelf: 'stretch',
      gap: sw(8),
      marginTop: sw(10),
    },
    macroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    macroLabel: {
      width: sw(14),
      fontSize: ms(12),
      lineHeight: ms(15),
      fontFamily: Fonts.bold,
    },
    barTrack: {
      flex: 1,
      height: sw(6),
      backgroundColor: colors.ring.track,
      borderRadius: sw(2),
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: sw(2),
    },
    macroValue: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      textAlign: 'right',
      minWidth: sw(36),
    },
    macroGoal: {
      color: colors.textTertiary,
      fontFamily: Fonts.regular,
    },
  });
