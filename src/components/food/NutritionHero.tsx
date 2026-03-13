import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry, NutritionGoals } from '../../stores/useFoodLogStore';
import { useNutrientGoalStore, type MicroGoalConfig } from '../../stores/useNutrientGoalStore';

/* ─── Micro keys that exist on FoodEntry ─────────────── */

const ENTRY_MICRO_KEYS = new Set([
  'sodium', 'fiber', 'sugar', 'calcium', 'iron', 'potassium', 'magnesium', 'zinc',
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b6', 'vitamin_b12', 'folate',
]);

function formatMicroValue(value: number, unit: string): string {
  if (unit === 'mcg' || unit === 'mg') {
    return value % 1 === 0 ? String(value) : value.toFixed(1);
  }
  return String(Math.round(value));
}

/* ─── Main component ──────────────────────────────────── */

interface Props {
  entries: FoodEntry[];
  goals: NutritionGoals;
}

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

  const enabledSet = useMemo(() => new Set(enabledMacros), [enabledMacros]);

  const macros = useMemo(() => {
    const all = [
      { key: 'protein', label: 'Protein', eaten: totals.protein, goal: goals.protein_goal, color: colors.protein },
      { key: 'carbs', label: 'Carbs', eaten: totals.carbs, goal: goals.carbs_goal, color: colors.carbs },
      { key: 'fat', label: 'Fat', eaten: totals.fat, goal: goals.fat_goal, color: colors.fat },
    ];
    return all.filter((m) => enabledSet.has(m.key));
  }, [totals, goals, colors, enabledSet]);

  // Aggregate micro totals from Consumed entries
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

  const handleOpen = useCallback(() => setExpanded(true), []);
  const handleClose = useCallback(() => setExpanded(false), []);

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={handleOpen} activeOpacity={0.7}>
        {/* Hero row: big calories + stats on the right */}
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <Text style={[styles.heroNumber, isOver && { color: colors.accentRed }]}>
              {totals.calories.toLocaleString()}
            </Text>
            <Text style={styles.heroLabel}>Consumed</Text>
          </View>

          <View style={styles.heroRight}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{goals.calorie_goal.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Goal</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, isOver && { color: colors.accentRed }]}>
                {isOver ? `+${(totals.calories - goals.calorie_goal).toLocaleString()}` : remaining.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, isOver && { color: colors.accentRed }]}>
                {isOver ? 'Over' : 'Left'}
              </Text>
            </View>
          </View>
        </View>

        {/* Macro columns (always visible) */}
        {macros.length > 0 && (
          <View style={styles.macroRow}>
            {macros.map((m) => {
              const progress = Math.min(m.goal > 0 ? m.eaten / m.goal : 0, 1);
              const over = m.eaten > m.goal;
              return (
                <View key={m.key} style={styles.macroCol}>
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
        )}

        {/* Micro tracking dots hint (only if micros are being tracked) */}
        {microGoals.length > 0 && (
          <View style={styles.dotsRow}>
            <View style={styles.dotsWrap}>
              {microGoals.map((g) => (
                <View key={g.key} style={[styles.dot, { backgroundColor: g.color }]} />
              ))}
            </View>
            <Ionicons name="chevron-down" size={ms(14)} color={colors.textTertiary} />
          </View>
        )}
      </TouchableOpacity>

      {/* Expanded detail modal */}
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {/* Calories summary */}
            <View style={styles.sheetHeroRow}>
              <View>
                <Text style={[styles.heroNumber, isOver && { color: colors.accentRed }]}>
                  {totals.calories.toLocaleString()}
                </Text>
                <Text style={styles.heroLabel}>Consumed</Text>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{goals.calorie_goal.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Goal</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, isOver && { color: colors.accentRed }]}>
                    {isOver ? `+${(totals.calories - goals.calorie_goal).toLocaleString()}` : remaining.toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, isOver && { color: colors.accentRed }]}>
                    {isOver ? 'Over' : 'Left'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Macro columns */}
            {macros.length > 0 && (
              <>
                <Text style={styles.sheetSectionLabel}>Macronutrients</Text>
                <View style={styles.macroRow}>
                  {macros.map((m) => {
                    const progress = Math.min(m.goal > 0 ? m.eaten / m.goal : 0, 1);
                    const over = m.eaten > m.goal;
                    return (
                      <View key={m.key} style={styles.macroCol}>
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
                    const over = eaten > g.dailyGoal;
                    return (
                      <View key={g.key} style={styles.microRow}>
                        <View style={[styles.microDot, { backgroundColor: g.color }]} />
                        <Text style={styles.microLabel}>{g.name}</Text>
                        <View style={styles.microBarTrack}>
                          <View
                            style={[
                              styles.microBarFill,
                              { width: `${progress * 100}%`, backgroundColor: over ? colors.accentRed : g.color },
                            ]}
                          />
                        </View>
                        <Text style={[styles.microValue, over && { color: colors.accentRed }]}>
                          {formatMicroValue(eaten, g.unit)}
                        </Text>
                        <Text style={styles.microGoalText}>/ {formatMicroValue(g.dailyGoal, g.unit)} {g.unit}</Text>
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default React.memo(NutritionHero);

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* Compact hero (always visible) */
    container: {
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
      paddingBottom: sw(8),
      gap: sw(14),
    },
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

    /* Tracking dots hint */
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dotsWrap: {
      flexDirection: 'row',
      gap: sw(4),
    },
    dot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },

    /* Modal backdrop + sheet */
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
    },
    sheetHeroRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    sheetSectionLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    /* Macro columns (inside modal) */
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

    /* Micro rows (inside modal) */
    microSection: {
      gap: sw(8),
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
    microGoalText: {
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
