import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useNutritionStore } from '../../stores/useNutritionStore';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useWeightStore } from '../../stores/useWeightStore';
import { sw, ms } from '../../theme/responsive';

const DROPLET_ML = 250;

export default function NutritionCard() {
  const { calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal } =
    useNutritionStore();
  const { water, waterGoal, addWater, undoLastWater } = useSupplementStore();
  const supplementConfigs = useSupplementStore((s) => s.supplementConfigs);
  const supplementTotals = useSupplementStore((s) => s.supplementTotals);
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const resetSupplement = useSupplementStore((s) => s.resetSupplement);
  const currentWeight = useWeightStore((s) => s.current);
  const weightTrend = useWeightStore((s) => s.trend);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isOver = calories > calorieGoal && calorieGoal > 0;
  const remaining = Math.max(0, calorieGoal - calories);
  const over = Math.max(0, calories - calorieGoal);
  const calProgress = calorieGoal > 0 ? Math.min(calories / calorieGoal, 1) : 0;

  const totalDroplets = Math.max(Math.round(waterGoal / DROPLET_ML), 1);
  const filledDroplets = Math.min(Math.floor(water / DROPLET_ML), totalDroplets);

  const handleAddWater = useCallback(() => {
    if (!userId || filledDroplets >= totalDroplets) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addWater(userId, DROPLET_ML);
  }, [userId, filledDroplets, totalDroplets, addWater]);

  const handleUndoWater = useCallback(() => {
    if (!userId || water <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastWater(userId);
  }, [userId, water, undoLastWater]);

  const handleAddSupplement = useCallback((key: string, amount: number) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addSupplement(userId, key, amount);
  }, [userId, addSupplement]);

  const handleResetSupplement = useCallback((key: string) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetSupplement(userId, key);
  }, [userId, resetSupplement]);

  const calColor = isOver ? colors.accentRed : colors.accent;

  const weightDirection = weightTrend != null && currentWeight != null
    ? (currentWeight > weightTrend ? 'up' : currentWeight < weightTrend ? 'down' : 'flat')
    : 'flat';
  const weightTrendIcon = weightDirection === 'up' ? 'caret-up' : weightDirection === 'down' ? 'caret-down' : 'remove';
  const weightTrendColor = weightDirection === 'up' ? colors.accentRed : weightDirection === 'down' ? colors.accentGreen : colors.textTertiary;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Nutrition</Text>
      {/* Calories — big number */}
      <View style={styles.calRow}>
        <Text style={[styles.calNumber, { color: calColor }]}>{calories}</Text>
        <View style={styles.calMeta}>
          <Text style={styles.calLabel}>
            {isOver ? `${over} over` : `${remaining} left`}
          </Text>
          <Text style={styles.calGoal}>of {calorieGoal} cal</Text>
        </View>
      </View>

      {/* Calorie bar */}
      <View style={styles.calTrack}>
        <View style={[styles.calFill, { width: `${calProgress * 100}%`, backgroundColor: calColor }]} />
      </View>

      {/* Macros — inline row */}
      <View style={styles.macroRow}>
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: colors.protein }]} />
          <Text style={styles.macroLabel}>P</Text>
          <Text style={styles.macroValue}>{protein}<Text style={styles.macroGoal}>/{proteinGoal}g</Text></Text>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: colors.carbs }]} />
          <Text style={styles.macroLabel}>C</Text>
          <Text style={styles.macroValue}>{carbs}<Text style={styles.macroGoal}>/{carbsGoal}g</Text></Text>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <View style={[styles.macroDot, { backgroundColor: colors.fat }]} />
          <Text style={styles.macroLabel}>F</Text>
          <Text style={styles.macroValue}>{fat}<Text style={styles.macroGoal}>/{fatGoal}g</Text></Text>
        </View>
      </View>

      {/* Bottom row: Water + Supplements + Weight */}
      <View style={styles.bottomSection}>
        {/* Water */}
        <View style={styles.bottomItem}>
          <View style={styles.waterRow}>
            <TouchableOpacity style={styles.waterBtn} onPress={handleUndoWater} activeOpacity={0.7}>
              <Ionicons name="remove" size={ms(14)} color={water > 0 ? colors.water : colors.textTertiary + '30'} />
            </TouchableOpacity>
            <View style={styles.waterGrid}>
              {Array.from({ length: totalDroplets }, (_, i) => (
                <Ionicons
                  key={i}
                  name={i < filledDroplets ? 'water' : 'water-outline'}
                  size={ms(10)}
                  color={i < filledDroplets ? colors.water : colors.textTertiary + '30'}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.waterBtn} onPress={handleAddWater} activeOpacity={0.7}>
              <Ionicons name="add" size={ms(14)} color={filledDroplets < totalDroplets ? colors.water : colors.textTertiary + '30'} />
            </TouchableOpacity>
          </View>
          <Text style={styles.bottomLabel}>{water}/{waterGoal}ml</Text>
        </View>

        {/* Supplements */}
        {supplementConfigs.map((config) => {
          const total = supplementTotals[config.key] || 0;
          const complete = total >= config.dailyGoal;
          return (
            <View key={config.key} style={styles.bottomItem}>
              <View style={styles.suppRow}>
                <Ionicons name={config.icon as any} size={ms(12)} color={config.color} />
                <Text style={styles.suppValue}>{total}<Text style={styles.suppGoal}>/{config.dailyGoal}{config.unit}</Text></Text>
                {complete && <Ionicons name="checkmark-circle" size={ms(11)} color={config.color} />}
              </View>
              {!complete && (
                <View style={styles.suppButtons}>
                  {config.increments.map((inc) => (
                    <TouchableOpacity
                      key={inc}
                      onPress={() => handleAddSupplement(config.key, inc)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.suppBtnText, { color: config.color }]}>+{inc >= 1000 ? `${inc / 1000}k` : inc}</Text>
                    </TouchableOpacity>
                  ))}
                  {total > 0 && (
                    <TouchableOpacity onPress={() => handleResetSupplement(config.key)} activeOpacity={0.7}>
                      <Ionicons name="arrow-undo" size={ms(10)} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Weight */}
        {currentWeight != null && (
          <View style={styles.bottomItem}>
            <View style={styles.weightRow}>
              <Text style={styles.weightValue}>{currentWeight.toFixed(1)}</Text>
              <Text style={styles.weightUnit}>kg</Text>
              <Ionicons name={weightTrendIcon as any} size={ms(10)} color={weightTrendColor} />
            </View>
            <Text style={styles.bottomLabel}>weight</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(10),
    gap: sw(8),
    ...colors.cardShadow,
  },

  title: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* Calories */
  calRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(8),
  },
  calNumber: {
    fontSize: ms(28),
    lineHeight: ms(32),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  calMeta: {
    gap: sw(1),
  },
  calLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  calGoal: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  calTrack: {
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  calFill: {
    height: '100%',
    borderRadius: sw(2),
  },

  /* Macros */
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  macroDot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  macroGoal: {
    color: colors.textTertiary,
    fontFamily: Fonts.regular,
    fontSize: ms(10),
  },
  macroDivider: {
    width: 1,
    height: sw(12),
    backgroundColor: colors.cardBorder,
    marginHorizontal: sw(6),
  },

  /* Bottom section */
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: sw(6),
    gap: sw(10),
  },
  bottomItem: {
    alignItems: 'center',
    gap: sw(2),
  },
  bottomLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
  },

  /* Water */
  waterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterBtn: {
    paddingHorizontal: sw(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(2),
  },

  /* Supplements */
  suppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
  },
  suppValue: {
    color: colors.textPrimary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  suppGoal: {
    color: colors.textTertiary,
    fontFamily: Fonts.regular,
    fontSize: ms(9),
  },
  suppButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  suppBtnText: {
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
  },

  /* Weight */
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(2),
  },
  weightValue: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  weightUnit: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
  },
});
