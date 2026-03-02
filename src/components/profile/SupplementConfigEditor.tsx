import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';

export default function SupplementConfigEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const creatineGoal = useSupplementStore((s) => s.creatineGoal);
  const updateSupplementGoals = useSupplementStore((s) => s.updateSupplementGoals);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [waterText, setWaterText] = useState(String(waterGoal));
  const [creatineText, setCreatineText] = useState(String(creatineGoal));

  const handleWaterBlur = useCallback(() => {
    if (!userId) return;
    const val = parseInt(waterText, 10);
    if (!isNaN(val) && val > 0) {
      updateSupplementGoals(userId, { water_goal: val });
    } else {
      setWaterText(String(waterGoal));
    }
  }, [userId, waterText, waterGoal, updateSupplementGoals]);

  const handleCreatineBlur = useCallback(() => {
    if (!userId) return;
    const val = parseFloat(creatineText);
    if (!isNaN(val) && val > 0) {
      updateSupplementGoals(userId, { creatine_goal: val });
    } else {
      setCreatineText(String(creatineGoal));
    }
  }, [userId, creatineText, creatineGoal, updateSupplementGoals]);

  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>Water Goal (ml)</Text>
        <TextInput
          style={styles.input}
          value={waterText}
          onChangeText={setWaterText}
          onBlur={handleWaterBlur}
          keyboardType="number-pad"
          placeholderTextColor={colors.textTertiary}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Creatine Goal (g)</Text>
        <TextInput
          style={styles.input}
          value={creatineText}
          onChangeText={setCreatineText}
          onBlur={handleCreatineBlur}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textTertiary}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(10),
  },
  label: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  input: {
    width: sw(80),
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(6),
    textAlign: 'center',
  },
});
