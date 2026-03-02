import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import WaveCircle from './WaveCircle';
import type { FoodEntry, NutritionGoals } from '../../stores/useFoodLogStore';

interface Props {
  entries: FoodEntry[];
  goals: NutritionGoals;
}

function MacroSummaryCard({ entries, goals }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { eaten, planned } = useMemo(() => {
    let eCal = 0, ePro = 0, eCarb = 0, eFat = 0;
    let pCal = 0, pPro = 0, pCarb = 0, pFat = 0;

    for (const e of entries) {
      if (e.is_planned) {
        pCal += e.calories;
        pPro += e.protein;
        pCarb += e.carbs;
        pFat += e.fat;
      } else {
        eCal += e.calories;
        ePro += e.protein;
        eCarb += e.carbs;
        eFat += e.fat;
      }
    }

    return {
      eaten: { cal: Math.round(eCal), pro: Math.round(ePro), carb: Math.round(eCarb), fat: Math.round(eFat) },
      planned: { cal: Math.round(pCal), pro: Math.round(pPro), carb: Math.round(pCarb), fat: Math.round(pFat) },
    };
  }, [entries]);

  const remaining = Math.max(0, goals.calorie_goal - eaten.cal);
  const progress = goals.calorie_goal > 0 ? Math.min(eaten.cal / goals.calorie_goal, 1) : 0;
  const hasPlanned = planned.cal > 0;

  return (
    <View style={styles.card}>
      {/* Macro circles */}
      <View style={styles.macroRow}>
        <WaveCircle
          current={eaten.pro}
          goal={goals.protein_goal}
          color={colors.protein}
          label="Protein"
        />
        <WaveCircle
          current={eaten.carb}
          goal={goals.carbs_goal}
          color={colors.carbs}
          label="Carbs"
        />
        <WaveCircle
          current={eaten.fat}
          goal={goals.fat_goal}
          color={colors.fat}
          label="Fat"
        />
      </View>
    </View>
  );
}

export default React.memo(MacroSummaryCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(16),
    gap: sw(12),
    ...colors.cardShadow,
  },

  /* Macro circles */
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: sw(4),
  },
});
