import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useNutritionStore } from '../../stores/useNutritionStore';
import { useNutrientGoalStore } from '../../stores/useNutrientGoalStore';
import { sw, ms } from '../../theme/responsive';
import { formatMicroValue } from '../food/dayTotals';
import CardDetailSheet, { CardDetailHero, CardDetailSectionLabel, CardDetailFooter } from './CardDetailSheet';

interface NutritionTotals {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  totals: NutritionTotals;
}

/** Nutrition card's detail popup: calories, macro columns and micronutrient rows. */
function NutritionDetailModal({ visible, onClose, totals }: Props) {
  return (
    <CardDetailSheet visible={visible} onClose={onClose}>
      <NutritionDetailContent totals={totals} onClose={onClose} />
    </CardDetailSheet>
  );
}

/**
 * Mounted only while the popup is, so today's micronutrients and the nutrient goals are
 * subscribed to here instead of on the always-mounted Home card.
 */
function NutritionDetailContent({ totals, onClose }: { totals: NutritionTotals; onClose: () => void }) {
  const { calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal } = totals;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isOver = calories > calorieGoal && calorieGoal > 0;
  const remaining = Math.max(0, calorieGoal - calories);
  const over = Math.max(0, calories - calorieGoal);

  // Today's, like the rest of Home (the diary's entries are whichever day the Nutrition tab shows).
  const microTotals = useNutritionStore((s) => s.micros);
  const enabledMacros = useNutrientGoalStore((s) => s.enabledMacros);
  const microGoals = useNutrientGoalStore((s) => s.microGoals);

  const enabledSet = useMemo(() => new Set(enabledMacros), [enabledMacros]);

  const macros = useMemo(() => {
    const all = [
      { key: 'protein', label: 'Protein', eaten: Math.round(protein), goal: proteinGoal, color: colors.protein },
      { key: 'carbs', label: 'Carbs', eaten: Math.round(carbs), goal: carbsGoal, color: colors.carbs },
      { key: 'fat', label: 'Fat', eaten: Math.round(fat), goal: fatGoal, color: colors.fat },
    ];
    return all.filter((m) => enabledSet.has(m.key));
  }, [protein, proteinGoal, carbs, carbsGoal, fat, fatGoal, colors, enabledSet]);

  return (
    <>
      {/* Calories summary */}
      <CardDetailHero
        value={calories.toLocaleString()}
        valueColor={isOver ? colors.accentRed : undefined}
        label="Consumed"
        stats={[
          { value: calorieGoal.toLocaleString(), label: 'Goal' },
          {
            value: isOver ? `+${over.toLocaleString()}` : remaining.toLocaleString(),
            label: isOver ? 'Over' : 'Left',
            color: isOver ? colors.accentRed : undefined,
          },
        ]}
        dividerColor={colors.ring.track}
      />

      {/* Macro columns */}
      {macros.length > 0 && (
        <>
          <CardDetailSectionLabel>Macronutrients</CardDetailSectionLabel>
          <View style={styles.macroRow}>
            {macros.map((m) => {
              const progress = Math.min(m.goal > 0 ? m.eaten / m.goal : 0, 1);
              const mOver = m.eaten > m.goal;
              return (
                <View key={m.key} style={styles.macroCol}>
                  <View style={[styles.macroAccent, { backgroundColor: m.color }]} />
                  <View style={styles.macroContent}>
                    <Text style={[styles.macroEaten, mOver && { color: colors.accentRed }]}>
                      {m.eaten}g
                    </Text>
                    <Text style={styles.macroGoal}>/ {m.goal}g {m.label}</Text>
                    <View style={styles.macroBarTrack}>
                      <View
                        style={[
                          styles.macroBarFill,
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
          <CardDetailSectionLabel>Micronutrients</CardDetailSectionLabel>
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

      <CardDetailFooter onClose={onClose} />
    </>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    macroRow: {
      flexDirection: 'row',
      gap: sw(10),
      marginBottom: sw(16),
    },
    macroCol: {
      flex: 1,
      flexDirection: 'row',
      gap: sw(8),
    },
    macroAccent: {
      width: sw(3),
      borderRadius: sw(1.5),
    },
    macroContent: {
      flex: 1,
      gap: sw(2),
    },
    macroEaten: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      letterSpacing: -0.2,
    },
    macroGoal: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },
    macroBarTrack: {
      height: sw(3),
      borderRadius: sw(1.5),
      backgroundColor: colors.ring.track,
      overflow: 'hidden',
      marginTop: sw(2),
    },
    macroBarFill: {
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
  });

export default React.memo(NutritionDetailModal);
