import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import {
  useNutrientGoalStore,
  MACRO_PRESETS,
  type MacroPreset,
} from '../../stores/useNutrientGoalStore';

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState(String(goalValue));

  useEffect(() => {
    setText(String(goalValue));
  }, [goalValue]);

  const handleBlur = useCallback(() => {
    const num = parseInt(text, 10);
    if (isNaN(num) || num <= 0) {
      // Snap to default
      setText(String(preset.defaultGoal));
      onGoalChange(preset.goalField, preset.defaultGoal);
    } else {
      onGoalChange(preset.goalField, num);
    }
  }, [text, preset, onGoalChange]);

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: preset.color + '15' }]}>
        <Ionicons name={preset.icon as any} size={ms(13)} color={preset.color} />
      </View>
      <Text style={styles.label}>{preset.label}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onBlur={handleBlur}
          keyboardType="number-pad"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.unitText}>{preset.unit}</Text>
      </View>
      <TouchableOpacity onPress={() => onRemove(preset.key)} hitSlop={8} style={styles.removeBtn}>
        <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
});

/* ─── Main Editor ────────────────────────────────────── */

export default function MacroGoalEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const goals = useFoodLogStore((s) => s.goals);
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const enabledMacros = useNutrientGoalStore((s) => s.enabledMacros);
  const setEnabledMacros = useNutrientGoalStore((s) => s.setEnabledMacros);
  const loadConfigs = useNutrientGoalStore((s) => s.loadConfigs);
  const loaded = useNutrientGoalStore((s) => s.loaded);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

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
    if (!userId) return;
    updateGoals(userId, { [field]: value });
  }, [userId, updateGoals]);

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

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(8),
    gap: sw(8),
  },
  rowIcon: {
    width: sw(26),
    height: sw(26),
    borderRadius: sw(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  goalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  input: {
    width: sw(70),
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
  unitText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    width: sw(24),
  },
  removeBtn: {
    marginLeft: sw(2),
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(12),
    marginTop: sw(4),
  },
  addText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingVertical: sw(10),
    paddingHorizontal: sw(4),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  presetIcon: {
    width: sw(28),
    height: sw(28),
    borderRadius: sw(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  presetDefault: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
});
