import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { ms } from '../../theme/responsive';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import {
  useNutrientGoalStore,
  MACRO_PRESETS,
  type MacroPreset,
} from '../../stores/useNutrientGoalStore';
import GoalEditorRow, { createGoalEditorStyles } from './settings/GoalEditorRow';

/* ─── Goal Row (per macro) ────────────────────────────── */

const MacroGoalRow = React.memo(function MacroGoalRow({
  preset,
  goalValue,
  onGoalChange,
  onRemove,
}: {
  preset: MacroPreset;
  goalValue: number;
  onGoalChange: (field: string, value: number) => void;
  onRemove: (key: string) => void;
}) {
  const commit = useCallback((text: string) => {
    const num = parseInt(text, 10);
    if (isNaN(num) || num <= 0) {
      // Snap to default
      onGoalChange(preset.goalField, preset.defaultGoal);
      return String(preset.defaultGoal);
    }
    onGoalChange(preset.goalField, num);
    return text;
  }, [preset, onGoalChange]);
  const remove = useCallback(() => onRemove(preset.key), [onRemove, preset.key]);

  return (
    <GoalEditorRow
      icon={preset.icon}
      color={preset.color}
      label={preset.label}
      unit={preset.unit}
      value={goalValue}
      keyboardType="number-pad"
      onCommit={commit}
      onRemove={remove}
    />
  );
});

/* ─── Main Editor ────────────────────────────────────── */

function MacroGoalEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const goals = useFoodLogStore((s) => s.goals);
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const goalsLoaded = useFoodLogStore((s) => s.goalsLoaded);
  const enabledMacros = useNutrientGoalStore((s) => s.enabledMacros);
  const setEnabledMacros = useNutrientGoalStore((s) => s.setEnabledMacros);
  const loadConfigs = useNutrientGoalStore((s) => s.loadConfigs);
  const loaded = useNutrientGoalStore((s) => s.loaded);
  const colors = useColors();
  const styles = useMemo(() => createGoalEditorStyles(colors), [colors]);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

  // Until the account's goals load, the rows show defaults: load them now.
  useEffect(() => {
    if (userId && !goalsLoaded) useFoodLogStore.getState().fetchGoals(userId);
  }, [userId, goalsLoaded]);

  const enabledSet = useMemo(() => new Set(enabledMacros), [enabledMacros]);
  const activePresets = useMemo(() => MACRO_PRESETS.filter((p) => enabledSet.has(p.key)), [enabledSet]);
  const availablePresets = useMemo(() => MACRO_PRESETS.filter((p) => !enabledSet.has(p.key)), [enabledSet]);

  const getGoalValue = useCallback((key: string) => {
    switch (key) {
      case 'protein': return goals.protein_goal;
      case 'carbs': return goals.carbs_goal;
      case 'fat': return goals.fat_goal;
      default: return 0;
    }
  }, [goals]);

  const handleGoalChange = useCallback((field: string, value: number) => {
    // Not loaded yet: saving would replace the account's goal with the default on screen.
    if (!userId || !goalsLoaded) return;
    if (goals[field as keyof typeof goals] === value) return;
    updateGoals(userId, { [field]: value });
  }, [userId, goalsLoaded, goals, updateGoals]);

  const handleRemove = useCallback((key: string) => {
    setEnabledMacros(enabledMacros.filter((k) => k !== key));
    setShowPresets(false);
  }, [enabledMacros, setEnabledMacros]);

  const handleAdd = useCallback((preset: MacroPreset) => {
    setEnabledMacros([...enabledMacros, preset.key]);
    // If the current goal in DB is 0, set to default
    if (!userId) return;
    const currentVal = getGoalValue(preset.key);
    if (!currentVal || currentVal <= 0) {
      updateGoals(userId, { [preset.goalField]: preset.defaultGoal });
    }
    setShowPresets(false);
  }, [enabledMacros, setEnabledMacros, userId, getGoalValue, updateGoals]);

  return (
    <View>
      {activePresets.map((preset) => (
        <MacroGoalRow
          key={preset.key}
          preset={preset}
          goalValue={getGoalValue(preset.key)}
          onGoalChange={handleGoalChange}
          onRemove={handleRemove}
        />
      ))}

      {availablePresets.length > 0 && (
        <TouchableOpacity
          style={styles.addRow}
          onPress={() => setShowPresets(!showPresets)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPresets ? 'chevron-up' : 'add-circle-outline'}
            size={ms(18)}
            color={colors.textSecondary}
          />
          <Text style={styles.addText}>Add Macro</Text>
        </TouchableOpacity>
      )}

      {showPresets && availablePresets.map((preset) => (
        <TouchableOpacity
          key={preset.key}
          style={styles.presetRow}
          onPress={() => handleAdd(preset)}
          activeOpacity={0.7}
        >
          <View style={[styles.presetIcon, { backgroundColor: preset.color + '15' }]}>
            <Ionicons name={preset.icon as any} size={ms(14)} color={preset.color} />
          </View>
          <Text style={styles.presetName}>{preset.label}</Text>
          <Text style={styles.presetDefault}>
            {getGoalValue(preset.key) || preset.defaultGoal} {preset.unit}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default React.memo(MacroGoalEditor);
