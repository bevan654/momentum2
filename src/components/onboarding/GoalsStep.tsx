import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import UnitInput from './UnitInput';
import type { Recommendation } from './onboardingPlan';

interface Props {
  recommendation: Recommendation | null;
  goalWeight: string;
  onGoalWeightChange: (value: string) => void;
  calories: string;
  onCaloriesChange: (value: string) => void;
  protein: string;
  onProteinChange: (value: string) => void;
  carbs: string;
  onCarbsChange: (value: string) => void;
  fat: string;
  onFatChange: (value: string) => void;
  water: string;
  onWaterChange: (value: string) => void;
  creatine: string;
  onCreatineChange: (value: string) => void;
}

interface GoalField {
  label: string;
  unit: string;
  value: string;
  setter: (value: string) => void;
  kb: KeyboardTypeOptions;
  max: number;
}

/** Onboarding step 2: goal weight, calorie/macro and water/creatine targets. */
function GoalsStep({
  recommendation, goalWeight, onGoalWeightChange,
  calories, onCaloriesChange, protein, onProteinChange, carbs, onCarbsChange, fat, onFatChange,
  water, onWaterChange, creatine, onCreatineChange,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderGoalFields = (fields: GoalField[]) =>
    fields.map((item) => (
      <View key={item.label} style={styles.goalItem}>
        <Text style={styles.goalLabel}>{item.label}</Text>
        <UnitInput
          goal
          value={item.value}
          onChangeText={item.setter}
          keyboardType={item.kb}
          maxLength={item.max}
          unit={item.unit}
        />
      </View>
    ));

  return (
    <View style={styles.detailsStack}>
      {recommendation && (
        <View style={styles.recBanner}>
          <Ionicons
            name={
              recommendation.mode === 'cut'
                ? 'trending-down'
                : recommendation.mode === 'bulk'
                ? 'trending-up'
                : 'remove'
            }
            size={ms(18)}
            color={colors.accent}
          />
          <Text style={styles.recBannerText}>
            {recommendation.mode === 'cut'
              ? 'Cutting plan — calorie deficit to reach your goal weight.'
              : recommendation.mode === 'bulk'
              ? 'Lean bulk plan — calorie surplus to reach your goal weight.'
              : 'Maintenance plan — calories balanced for your current weight.'}
          </Text>
        </View>
      )}

      <View>
        <Text style={styles.sectionHeading}>Body</Text>
        <View style={styles.goalsGrid}>
          <View style={styles.goalItem}>
            <Text style={styles.goalLabel}>Goal weight</Text>
            <UnitInput
              goal
              placeholder="e.g. 72"
              value={goalWeight}
              onChangeText={onGoalWeightChange}
              keyboardType="decimal-pad"
              maxLength={5}
              unit="kg"
            />
          </View>
        </View>
      </View>

      <View>
        <Text style={styles.sectionHeading}>Nutrition</Text>
        <View style={styles.goalsGrid}>
          {renderGoalFields([
            { label: 'Calories', unit: 'kcal', value: calories, setter: onCaloriesChange, kb: 'number-pad', max: 5 },
            { label: 'Protein', unit: 'g', value: protein, setter: onProteinChange, kb: 'number-pad', max: 5 },
            { label: 'Carbs', unit: 'g', value: carbs, setter: onCarbsChange, kb: 'number-pad', max: 5 },
            { label: 'Fat', unit: 'g', value: fat, setter: onFatChange, kb: 'number-pad', max: 5 },
          ])}
        </View>
      </View>

      <View>
        <Text style={styles.sectionHeading}>Supplements</Text>
        <View style={styles.goalsGrid}>
          {renderGoalFields([
            { label: 'Water', unit: 'ml', value: water, setter: onWaterChange, kb: 'number-pad', max: 6 },
            { label: 'Creatine', unit: 'g', value: creatine, setter: onCreatineChange, kb: 'decimal-pad', max: 4 },
          ])}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    detailsStack: {
      gap: sw(20),
    },

    /* ─── Recommendation banner ────────────────────────────── */
    recBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      padding: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    recBannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },

    /* ─── Goal fields ──────────────────────────────────────── */
    sectionHeading: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      marginBottom: sw(12),
    },
    goalsGrid: {
      gap: sw(14),
    },
    goalItem: {
      gap: sw(6),
    },
    goalLabel: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
  });

export default memo(GoalsStep);
