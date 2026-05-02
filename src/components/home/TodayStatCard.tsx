import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useNutritionStore } from '../../stores/useNutritionStore';

function formatNumber(n: number) {
  return n.toLocaleString('en-US');
}

// DEV_OVERRIDE: set to numbers to preview, null = use real data.
// 1800 kcal split ~30P/40C/30F.
const __DEV_CALORIES_OVERRIDE__: number | null = 1800;
const __DEV_PROTEIN_OVERRIDE__: number | null = 135;
const __DEV_CARBS_OVERRIDE__: number | null = 180;
const __DEV_FAT_OVERRIDE__: number | null = 60;

interface StatRowProps {
  value: number;
  label: string;
  target?: number;
  targetUnit?: string;
}

function StatRow({ value, label, target, targetUnit }: StatRowProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statRow}>
      <View style={styles.statLeft}>
        <Text style={styles.statValue}>{formatNumber(value)}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      {target != null && (
        <View style={styles.statRight}>
          <View style={styles.targetRow}>
            <View style={styles.targetDot} />
            <Text style={styles.targetWord}>Target</Text>
          </View>
          <Text style={styles.targetValue}>{formatNumber(target)}</Text>
          {targetUnit && <Text style={styles.targetUnit}>{targetUnit}</Text>}
        </View>
      )}
    </View>
  );
}

function TodayStatCard() {
  const realCalories = useNutritionStore((s) => s.calories);
  const realProtein = useNutritionStore((s) => s.protein);
  const realCarbs = useNutritionStore((s) => s.carbs);
  const realFat = useNutritionStore((s) => s.fat);
  const calories = __DEV_CALORIES_OVERRIDE__ ?? realCalories;
  const protein = __DEV_PROTEIN_OVERRIDE__ ?? realProtein;
  const carbs = __DEV_CARBS_OVERRIDE__ ?? realCarbs;
  const fat = __DEV_FAT_OVERRIDE__ ?? realFat;
  const calorieGoal = useNutritionStore((s) => s.calorieGoal);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const effectiveGoal = calorieGoal > 0 ? calorieGoal : 2000;
  const progress = Math.min(calories / effectiveGoal, 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Nutrition</Text>
      <View style={styles.bodyRow}>
        <StatRow value={calories} label="CALORIES" />
        <View style={styles.macroCol}>
          <View style={styles.macro}>
            <Text style={styles.macroKey}>P</Text>
            <Text style={styles.macroValue}>{Math.round(protein)}<Text style={styles.macroUnit}> g</Text></Text>
          </View>
          <View style={styles.macro}>
            <Text style={styles.macroKey}>C</Text>
            <Text style={styles.macroValue}>{Math.round(carbs)}<Text style={styles.macroUnit}> g</Text></Text>
          </View>
          <View style={styles.macro}>
            <Text style={styles.macroKey}>F</Text>
            <Text style={styles.macroValue}>{Math.round(fat)}<Text style={styles.macroUnit}> g</Text></Text>
          </View>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

export default React.memo(TodayStatCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1.5,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(14),
    justifyContent: 'space-between',
    gap: sw(12),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: sw(16),
  },
  statLeft: {
    // no flex — hug content so target sits next to the value, not at the far edge
  },
  statValue: {
    color: colors.textPrimary,
    fontFamily: Fonts.extraBold,
    fontSize: ms(26),
    lineHeight: ms(30),
    letterSpacing: -0.6,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
    marginTop: sw(2),
  },
  statRight: {
    alignItems: 'flex-end',
    gap: sw(2),
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  targetDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.accent,
  },
  targetWord: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
  },
  targetValue: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  targetUnit: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: sw(8),
  },
  macroCol: {
    alignItems: 'flex-end',
    gap: sw(2),
  },
  macro: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(4),
  },
  macroKey: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
  },
  macroValue: {
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    textAlign: 'right',
    minWidth: sw(40),
    fontVariant: ['tabular-nums'],
  },
  macroUnit: {
    color: colors.textPrimary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  progressTrack: {
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: sw(2),
  },
});
