import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry, NutritionGoals } from '../../stores/useFoodLogStore';
import { useNutrientGoalStore } from '../../stores/useNutrientGoalStore';
import CalorieRing from './CalorieRing';
import MacroBars, { type MacroBarItem } from './MacroBars';
import NutrientDetailOverlay from './NutrientDetailOverlay';
import { sumMacros, sumMicros } from './dayTotals';

interface Props {
  entries: FoodEntry[];
  goals: NutritionGoals;
}

/** Day summary: calorie ring (what's left) beside protein / carbs / fat bars. Tap for the full breakdown. */
function NutritionHero({ entries, goals }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const enabledMacros = useNutrientGoalStore((s) => s.enabledMacros);
  const microGoals = useNutrientGoalStore((s) => s.microGoals);
  const loaded = useNutrientGoalStore((s) => s.loaded);
  const loadConfigs = useNutrientGoalStore((s) => s.loadConfigs);

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

  const totals = useMemo(() => sumMacros(entries), [entries]);

  const macros: MacroBarItem[] = useMemo(() => {
    const enabled = new Set(enabledMacros);
    return [
      { key: 'protein', label: 'Protein', eaten: totals.protein, goal: goals.protein_goal, color: colors.protein },
      { key: 'carbs', label: 'Carbs', eaten: totals.carbs, goal: goals.carbs_goal, color: colors.carbs },
      { key: 'fat', label: 'Fat', eaten: totals.fat, goal: goals.fat_goal, color: colors.fat },
    ].filter((m) => enabled.has(m.key));
  }, [totals, goals, colors, enabledMacros]);

  // Micronutrient totals are only needed while the breakdown is open.
  const microKeys = useMemo(() => microGoals.map((g) => g.key), [microGoals]);
  const microTotals = useMemo(
    () => (expanded ? sumMicros(entries, microKeys) : {}),
    [expanded, entries, microKeys],
  );

  const handleOpen = useCallback(() => setExpanded(true), []);
  const handleClose = useCallback(() => setExpanded(false), []);

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={handleOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${totals.calories} of ${goals.calorie_goal} calories eaten`}
        accessibilityHint="Opens the full nutrition breakdown"
      >
        <View style={styles.row}>
          <View style={styles.ringCol}>
            <CalorieRing eaten={totals.calories} goal={goals.calorie_goal} />
            <Text style={styles.caption}>
              <Text style={styles.captionStrong}>{totals.calories.toLocaleString()}</Text>
              {' eaten · '}
              {goals.calorie_goal.toLocaleString()}
              {' goal'}
            </Text>
          </View>
          {macros.length > 0 && <MacroBars items={macros} />}
        </View>

        <View style={styles.footer}>
          {microGoals.length > 0 && (
            <View style={styles.dots}>
              {microGoals.map((g) => (
                <View key={g.key} style={[styles.dot, { backgroundColor: g.color }]} />
              ))}
            </View>
          )}
          <Text style={styles.footerText}>{microGoals.length > 0 ? 'Micronutrients' : 'Details'}</Text>
          <Ionicons name="chevron-forward" size={ms(12)} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>

      <NutrientDetailOverlay
        visible={expanded}
        onClose={handleClose}
        eaten={totals.calories}
        goal={goals.calorie_goal}
        macros={macros}
        microGoals={microGoals}
        microTotals={microTotals}
      />
    </>
  );
}

export default React.memo(NutritionHero);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: sw(16),
      marginTop: sw(8),
      paddingHorizontal: sw(16),
      paddingTop: sw(16),
      paddingBottom: sw(12),
      borderRadius: sw(20),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(12),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(20),
    },
    ringCol: {
      alignItems: 'center',
      gap: sw(8),
    },
    caption: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    captionStrong: {
      color: colors.textSecondary,
      fontFamily: Fonts.semiBold,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: sw(6),
      paddingTop: sw(10),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    dots: {
      flexDirection: 'row',
      gap: sw(3),
      marginRight: 'auto',
    },
    dot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    footerText: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
  });
