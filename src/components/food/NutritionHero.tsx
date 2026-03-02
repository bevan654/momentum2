import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry, NutritionGoals } from '../../stores/useFoodLogStore';

/* ─── Main component ──────────────────────────────────── */

interface Props {
  entries: FoodEntry[];
  goals: NutritionGoals;
}

function NutritionHero({ entries, goals }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const totals = useMemo(() => {
    let cal = 0, protein = 0, carbs = 0, fat = 0;
    for (const e of entries) {
      if (!e.is_planned) {
        cal += e.calories;
        protein += e.protein;
        carbs += e.carbs;
        fat += e.fat;
      }
    }
    return { calories: Math.round(cal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
  }, [entries]);

  const isOver = totals.calories > goals.calorie_goal;
  const remaining = Math.max(0, goals.calorie_goal - totals.calories);

  const macros = useMemo(() => [
    { label: 'Protein', eaten: totals.protein, goal: goals.protein_goal, color: colors.protein },
    { label: 'Carbs', eaten: totals.carbs, goal: goals.carbs_goal, color: colors.carbs },
    { label: 'Fat', eaten: totals.fat, goal: goals.fat_goal, color: colors.fat },
  ], [totals, goals, colors]);

  return (
    <View style={styles.container}>
      {/* Hero row: big calories + stats on the right */}
      <View style={styles.heroRow}>
        <View style={styles.heroLeft}>
          <Text style={[styles.heroNumber, isOver && { color: colors.accentRed }]}>
            {totals.calories.toLocaleString()}
          </Text>
          <Text style={styles.heroLabel}>consumed</Text>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{goals.calorie_goal.toLocaleString()}</Text>
            <Text style={styles.statLabel}>goal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isOver && { color: colors.accentRed }]}>
              {isOver ? `+${(totals.calories - goals.calorie_goal).toLocaleString()}` : remaining.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, isOver && { color: colors.accentRed }]}>
              {isOver ? 'over' : 'left'}
            </Text>
          </View>
        </View>
      </View>

      {/* Macro columns */}
      <View style={styles.macroRow}>
        {macros.map((m) => {
          const progress = Math.min(m.goal > 0 ? m.eaten / m.goal : 0, 1);
          const over = m.eaten > m.goal;
          return (
            <View key={m.label} style={styles.macroCol}>
              <View style={[styles.macroAccent, { backgroundColor: m.color }]} />
              <View style={styles.macroContent}>
                <Text style={[styles.macroEaten, over && { color: colors.accentRed }]}>
                  {m.eaten}g
                </Text>
                <Text style={styles.macroGoal}>/ {m.goal}g {m.label}</Text>
                <View style={styles.macroBarTrack}>
                  <View
                    style={[
                      styles.macroBarFill,
                      { width: `${progress * 100}%`, backgroundColor: over ? colors.accentRed : m.color },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default React.memo(NutritionHero);

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
      paddingBottom: sw(8),
      gap: sw(14),
    },

    /* Hero row */
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    heroLeft: {
      gap: sw(0),
    },
    heroNumber: {
      color: colors.textPrimary,
      fontSize: ms(42),
      lineHeight: ms(46),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1.5,
    },
    heroLabel: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginTop: sw(-2),
    },

    /* Right stats */
    heroRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      marginBottom: sw(4),
    },
    statItem: {
      alignItems: 'flex-end',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
    },
    statLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    statDivider: {
      width: sw(1),
      height: sw(26),
      backgroundColor: colors.ring.track,
    },

    /* Macro columns */
    macroRow: {
      flexDirection: 'row',
      gap: sw(10),
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
  });
