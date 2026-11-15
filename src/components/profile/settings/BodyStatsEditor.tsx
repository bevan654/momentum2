import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useAuthStore } from '../../../stores/useAuthStore';
import { isPlausibleBodyweight } from '../../../utils/muscleLoad';
import { GoalRow } from './SettingsPrimitives';

/* ─── Body Stats Editor ──────────────────────────────────── */

export function BodyStatsEditor() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [weight, setWeight] = useState(String(profile?.starting_weight || ''));
  const [goalWeight, setGoalWeight] = useState(String(profile?.goal_weight || ''));
  const [age, setAge] = useState(String(profile?.age || ''));
  const [height, setHeight] = useState(String(profile?.height || ''));

  const handleWeightBlur = useCallback(() => {
    const val = parseFloat(weight);
    // Same range as onboarding; a typo here skews strength scores and muscle load
    if (isPlausibleBodyweight(val)) {
      updateProfile({ starting_weight: val });
    } else {
      setWeight(String(profile?.starting_weight || ''));
    }
  }, [weight, profile, updateProfile]);

  const handleGoalWeightBlur = useCallback(() => {
    const val = parseFloat(goalWeight);
    if (isPlausibleBodyweight(val)) {
      updateProfile({ goal_weight: val });
    } else {
      setGoalWeight(String(profile?.goal_weight || ''));
    }
  }, [goalWeight, profile, updateProfile]);

  const handleAgeBlur = useCallback(() => {
    const val = parseInt(age, 10);
    if (!isNaN(val) && val >= 13 && val <= 100) {
      updateProfile({ age: val });
    } else {
      setAge(String(profile?.age || ''));
    }
  }, [age, profile, updateProfile]);

  const handleHeightBlur = useCallback(() => {
    const val = parseFloat(height);
    if (!isNaN(val) && val >= 100 && val <= 250) {
      updateProfile({ height: val });
    } else {
      setHeight(String(profile?.height || ''));
    }
  }, [height, profile, updateProfile]);

  const handleGenderSelect = useCallback((gender: string) => {
    updateProfile({ gender });
  }, [updateProfile]);

  return (
    <View>
      <View style={styles.goalRow}>
        <Text style={styles.fieldLabel}>Gender</Text>
        <View style={styles.genderToggleWrap}>
          <TouchableOpacity
            style={[styles.genderOption, profile?.gender === 'male' && { backgroundColor: colors.accent + '25' }]}
            onPress={() => handleGenderSelect('male')}
            activeOpacity={0.7}
          >
            <Text style={[styles.genderText, profile?.gender === 'male' && { color: colors.accent }]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderOption, profile?.gender === 'female' && { backgroundColor: colors.accent + '25' }]}
            onPress={() => handleGenderSelect('female')}
            activeOpacity={0.7}
          >
            <Text style={[styles.genderText, profile?.gender === 'female' && { color: colors.accent }]}>Female</Text>
          </TouchableOpacity>
        </View>
      </View>
      <GoalRow label="Age" value={age} onChange={setAge} onBlur={handleAgeBlur} unit="yrs" />
      <GoalRow label="Height" value={height} onChange={setHeight} onBlur={handleHeightBlur} unit="cm" />
      <GoalRow label="Starting Weight" value={weight} onChange={setWeight} onBlur={handleWeightBlur} unit="kg" />
      <GoalRow label="Goal Weight" value={goalWeight} onChange={setGoalWeight} onBlur={handleGoalWeightBlur} unit="kg" />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(6),
  },
  genderToggleWrap: {
    flexDirection: 'row' as const,
    gap: sw(6),
  },
  genderOption: {
    paddingHorizontal: sw(14),
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  genderText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
});
