import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
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
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useNutrientGoalStore } from '../../stores/useNutrientGoalStore';
import { sw, ms } from '../../theme/responsive';

/* ─── Micro keys that exist on FoodEntry ─────────────── */

const ENTRY_MICRO_KEYS = new Set([
  'caffeine', 'sodium', 'fiber', 'sugar', 'calcium', 'iron', 'potassium', 'magnesium', 'zinc',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b6', 'vitamin_b12', 'folate',
]);

function formatMicroValue(value: number, unit: string): string {
  if (unit === 'mcg' || unit === 'mg') {
    return value % 1 === 0 ? String(value) : value.toFixed(1);
  }
  return String(Math.round(value));
}

/* ─── Hero ring ───────────���──────────────────────────── */

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

/* ─── Main component ─────────���───────────────────────── */

export default function NutritionCard() {
  const { calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal } =
    useNutritionStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [expanded, setExpanded] = useState(false);
  const handleOpen = useCallback(() => setExpanded(true), []);
  const handleClose = useCallback(() => setExpanded(false), []);

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

  const pFill = proteinGoal > 0 ? Math.min(protein / proteinGoal, 1) : 0;
  const cFill = carbsGoal > 0 ? Math.min(carbs / carbsGoal, 1) : 0;
  const fFill = fatGoal > 0 ? Math.min(fat / fatGoal, 1) : 0;
  const pOver = protein > proteinGoal && proteinGoal > 0;
  const cOver = carbs > carbsGoal && carbsGoal > 0;
  const fOver = fat > fatGoal && fatGoal > 0;

  /* ─── Modal data ─────────────────────────────────────── */

  const entries = useFoodLogStore((s) => s.entries);
  const enabledMacros = useNutrientGoalStore((s) => s.enabledMacros);
  const microGoals = useNutrientGoalStore((s) => s.microGoals);
  const loaded = useNutrientGoalStore((s) => s.loaded);
  const loadConfigs = useNutrientGoalStore((s) => s.loadConfigs);

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

  const enabledSet = useMemo(() => new Set(enabledMacros), [enabledMacros]);

  const macros = useMemo(() => {
    const all = [
      { key: 'protein', label: 'Protein', eaten: Math.round(protein), goal: proteinGoal, color: colors.protein },
      { key: 'carbs', label: 'Carbs', eaten: Math.round(carbs), goal: carbsGoal, color: colors.carbs },
      { key: 'fat', label: 'Fat', eaten: Math.round(fat), goal: fatGoal, color: colors.fat },
    ];
    return all.filter((m) => enabledSet.has(m.key));
  }, [protein, proteinGoal, carbs, carbsGoal, fat, fatGoal, colors, enabledSet]);

  const microTotals = useMemo(() => {
    if (microGoals.length === 0) return {};
    const sums: Record<string, number> = {};
    for (const e of entries) {
      if (e.is_planned) continue;
      for (const g of microGoals) {
        if (!ENTRY_MICRO_KEYS.has(g.key)) continue;
        const val = (e as any)[g.key];
        if (val != null) {
          sums[g.key] = (sums[g.key] || 0) + Number(val);
        }
      }
    }
    return sums;
  }, [entries, microGoals]);

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={handleOpen} activeOpacity={0.7}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="nutrition-outline" size={ms(13)} color={colors.accent} />
          </View>
          <Text style={styles.title}>Nutrition</Text>
        </View>

        {/* Hero ring */}
        <View style={styles.heroSection} pointerEvents="none">
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
            <Text style={styles.macroValue}>{protein}<Text style={styles.macroGoalText}>/{proteinGoal}</Text></Text>
          </View>

          {/* Carbs */}
          <View style={styles.macroRow}>
            <Text style={[styles.macroLabel, { color: cOver ? colors.accentRed : colors.carbs }]}>C</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${cFill * 100}%`, backgroundColor: cOver ? colors.accentRed : colors.carbs }]} />
            </View>
            <Text style={styles.macroValue}>{carbs}<Text style={styles.macroGoalText}>/{carbsGoal}</Text></Text>
          </View>

          {/* Fat */}
          <View style={styles.macroRow}>
            <Text style={[styles.macroLabel, { color: fOver ? colors.accentRed : colors.fat }]}>F</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${fFill * 100}%`, backgroundColor: fOver ? colors.accentRed : colors.fat }]} />
            </View>
            <Text style={styles.macroValue}>{fat}<Text style={styles.macroGoalText}>/{fatGoal}</Text></Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded detail modal */}
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Calories summary */}
              <View style={styles.sheetHeroRow}>
                <View>
                  <Text style={[styles.sheetHeroNumber, isOver && { color: colors.accentRed }]}>
                    {calories.toLocaleString()}
                  </Text>
                  <Text style={styles.sheetHeroLabel}>Consumed</Text>
                </View>
                <View style={styles.sheetHeroRight}>
                  <View style={styles.sheetStatItem}>
                    <Text style={styles.sheetStatValue}>{calorieGoal.toLocaleString()}</Text>
                    <Text style={styles.sheetStatLabel}>Goal</Text>
                  </View>
                  <View style={styles.sheetStatDivider} />
                  <View style={styles.sheetStatItem}>
                    <Text style={[styles.sheetStatValue, isOver && { color: colors.accentRed }]}>
                      {isOver ? `+${over.toLocaleString()}` : remaining.toLocaleString()}
                    </Text>
                    <Text style={[styles.sheetStatLabel, isOver && { color: colors.accentRed }]}>
                      {isOver ? 'Over' : 'Left'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Macro columns */}
              {macros.length > 0 && (
                <>
                  <Text style={styles.sheetSectionLabel}>Macronutrients</Text>
                  <View style={styles.sheetMacroRow}>
                    {macros.map((m) => {
                      const progress = Math.min(m.goal > 0 ? m.eaten / m.goal : 0, 1);
                      const mOver = m.eaten > m.goal;
                      return (
                        <View key={m.key} style={styles.sheetMacroCol}>
                          <View style={[styles.sheetMacroAccent, { backgroundColor: m.color }]} />
                          <View style={styles.sheetMacroContent}>
                            <Text style={[styles.sheetMacroEaten, mOver && { color: colors.accentRed }]}>
                              {m.eaten}g
                            </Text>
                            <Text style={styles.sheetMacroGoal}>/ {m.goal}g {m.label}</Text>
                            <View style={styles.sheetMacroBarTrack}>
                              <View
                                style={[
                                  styles.sheetMacroBarFill,
                                  { width: `${progress * 100}%`, backgroundColor: mOver ? colors.accentRed : m.color },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Micro rows */}
              {microGoals.length > 0 && (
                <>
                  <Text style={styles.sheetSectionLabel}>Micronutrients</Text>
                  <View style={styles.microSection}>
                    {microGoals.map((g) => {
                      const eaten = microTotals[g.key] || 0;
                      const progress = Math.min(g.dailyGoal > 0 ? eaten / g.dailyGoal : 0, 1);
                      const mOver = eaten > g.dailyGoal;
                      return (
                        <View key={g.key} style={styles.microRow}>
                          <View style={[styles.microDot, { backgroundColor: g.color }]} />
                          <Text style={styles.microLabel}>{g.name}</Text>
                          <View style={styles.microBarTrack}>
                            <View
                              style={[
                                styles.microBarFill,
                                { width: `${progress * 100}%`, backgroundColor: mOver ? colors.accentRed : g.color },
                              ]}
                            />
                          </View>
                          <Text style={[styles.microValue, mOver && { color: colors.accentRed }]}>
                            {formatMicroValue(eaten, g.unit)}
                          </Text>
                          <Text style={styles.microGoalDetail}>/ {formatMicroValue(g.dailyGoal, g.unit)} {g.unit}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Close button */}
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.closeBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ─── Styles ──────���───────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingTop: sw(12),
      paddingBottom: sw(12),
      paddingHorizontal: sw(12),
      alignItems: 'center',
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
    macroGoalText: {
      color: colors.textTertiary,
      fontFamily: Fonts.regular,
    },

    /* ─── Modal ──────────────────────────────────────────── */
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      paddingHorizontal: sw(20),
    },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      padding: sw(20),
      gap: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      maxHeight: '80%',
    },
    sheetHeroRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: sw(16),
    },
    sheetHeroNumber: {
      color: colors.textPrimary,
      fontSize: ms(42),
      lineHeight: ms(46),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1.5,
    },
    sheetHeroLabel: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginTop: sw(-2),
    },
    sheetHeroRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      marginBottom: sw(4),
    },
    sheetStatItem: {
      alignItems: 'flex-end',
    },
    sheetStatValue: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
    },
    sheetStatLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    sheetStatDivider: {
      width: sw(1),
      height: sw(26),
      backgroundColor: colors.ring.track,
    },
    sheetSectionLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: sw(8),
    },
    sheetMacroRow: {
      flexDirection: 'row',
      gap: sw(10),
      marginBottom: sw(16),
    },
    sheetMacroCol: {
      flex: 1,
      flexDirection: 'row',
      gap: sw(8),
    },
    sheetMacroAccent: {
      width: sw(3),
      borderRadius: sw(1.5),
    },
    sheetMacroContent: {
      flex: 1,
      gap: sw(2),
    },
    sheetMacroEaten: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      letterSpacing: -0.2,
    },
    sheetMacroGoal: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },
    sheetMacroBarTrack: {
      height: sw(3),
      borderRadius: sw(1.5),
      backgroundColor: colors.ring.track,
      overflow: 'hidden',
      marginTop: sw(2),
    },
    sheetMacroBarFill: {
      height: '100%',
      borderRadius: sw(1.5),
    },

    /* Micro rows */
    microSection: {
      gap: sw(8),
      marginBottom: sw(16),
    },
    microRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    microDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    microLabel: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      width: sw(72),
    },
    microBarTrack: {
      flex: 1,
      height: sw(3),
      borderRadius: sw(1.5),
      backgroundColor: colors.ring.track,
      overflow: 'hidden',
    },
    microBarFill: {
      height: '100%',
      borderRadius: sw(1.5),
    },
    microValue: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textAlign: 'right',
      minWidth: sw(32),
    },
    microGoalDetail: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
      width: sw(58),
    },

    /* Close button */
    closeBtn: {
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      paddingVertical: sw(12),
      alignItems: 'center',
      marginTop: sw(4),
    },
    closeBtnText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
  });
