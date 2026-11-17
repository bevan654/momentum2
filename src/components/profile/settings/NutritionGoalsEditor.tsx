import React, { useState, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useFoodLogStore } from '../../../stores/useFoodLogStore';
import { useSupplementStore } from '../../../stores/useSupplementStore';
import { GoalRow } from './SettingsPrimitives';

/* ─── Nutrition Goals Editor ─────────────────────────────── */

export function NutritionGoalsEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const goals = useFoodLogStore((s) => s.goals);
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const updateSupplementGoals = useSupplementStore((s) => s.updateSupplementGoals);

  const goalsLoaded = useFoodLogStore((s) => s.goalsLoaded);
  const [cal, setCal] = useState(String(goals.calorie_goal));

  // Show the account's goal once it loads (the field starts on the 2000 kcal default).
  useEffect(() => {
    if (userId && !goalsLoaded) useFoodLogStore.getState().fetchGoals(userId);
  }, [userId, goalsLoaded]);
  useEffect(() => {
    setCal(String(goals.calorie_goal));
  }, [goals.calorie_goal]);
  const [waterText, setWaterText] = useState(String(waterGoal));

  const handleCalBlur = useCallback(() => {
    if (!userId) return;
    const num = parseInt(cal, 10);
    // Unchanged, or the real goal hasn't loaded: saving would overwrite it with the default.
    if (num === goals.calorie_goal || !goalsLoaded) {
      setCal(String(goals.calorie_goal));
    } else if (!isNaN(num) && num > 0) {
      updateGoals(userId, { calorie_goal: num });
    } else {
      setCal(String(goals.calorie_goal));
    }
  }, [userId, cal, goals.calorie_goal, goalsLoaded, updateGoals]);

  const handleWaterBlur = useCallback(() => {
    if (!userId) return;
    const val = parseInt(waterText, 10);
    if (!isNaN(val) && val > 0) {
      updateSupplementGoals(userId, { water_goal: val });
    } else {
      setWaterText(String(waterGoal));
    }
  }, [userId, waterText, waterGoal, updateSupplementGoals]);

  return (
    <View>
      <GoalRow label="Calories" value={cal} onChange={setCal} onBlur={handleCalBlur} unit="kcal" />
      <GoalRow label="Water" value={waterText} onChange={setWaterText} onBlur={handleWaterBlur} unit="ml" />
    </View>
  );
}
