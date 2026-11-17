import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import GoalEditorRow, { createGoalEditorStyles } from './settings/GoalEditorRow';
import {
  useNutrientGoalStore,
  MICRO_PRESETS,
  getMicroDefault,
  type MicroGoalConfig,
} from '../../stores/useNutrientGoalStore';

/* ─── Goal Row (per micro) ────────────────────────────── */

const MicroGoalRow = React.memo(function MicroGoalRow({
  config,
  gender,
  onGoalChange,
  onRemove,
}: {
  config: MicroGoalConfig;
  gender?: string | null;
  onGoalChange: (key: string, value: number) => void;
  onRemove: (key: string) => void;
}) {
  const commit = useCallback((text: string) => {
    const num = parseFloat(text);
    if (isNaN(num) || num <= 0) {
      // Snap to RDA default
      const defaultVal = getMicroDefault(config.key, gender);
      onGoalChange(config.key, defaultVal);
      return String(defaultVal);
    }
    onGoalChange(config.key, num);
    return text;
  }, [config.key, gender, onGoalChange]);
  const remove = useCallback(() => onRemove(config.key), [onRemove, config.key]);

  return (
    <GoalEditorRow
      icon="flask-outline"
      color={config.color}
      label={config.name}
      unit={config.unit}
      value={config.dailyGoal}
      keyboardType="decimal-pad"
      unitWidth={sw(28)}
      onCommit={commit}
      onRemove={remove}
    />
  );
});

/* ─── Main Editor ────────────────────────────────────── */

function MicroGoalEditor() {
  const profile = useAuthStore((s) => s.profile);
  const microGoals = useNutrientGoalStore((s) => s.microGoals);
  const addMicroGoal = useNutrientGoalStore((s) => s.addMicroGoal);
  const removeMicroGoal = useNutrientGoalStore((s) => s.removeMicroGoal);
  const updateMicroGoal = useNutrientGoalStore((s) => s.updateMicroGoal);
  const loadConfigs = useNutrientGoalStore((s) => s.loadConfigs);
  const loaded = useNutrientGoalStore((s) => s.loaded);
  const colors = useColors();
  const styles = useMemo(() => ({ ...createGoalEditorStyles(colors), ...createStyles(colors) }), [colors]);
  const [showPresets, setShowPresets] = useState(false);

  const gender = profile?.gender;

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

  const activeKeys = useMemo(() => new Set(microGoals.map((g) => g.key)), [microGoals]);
  const availablePresets = useMemo(
    () => MICRO_PRESETS.filter((p) => !activeKeys.has(p.key)),
    [activeKeys],
  );

  const handleGoalChange = useCallback((key: string, value: number) => {
    updateMicroGoal(key, value);
  }, [updateMicroGoal]);

  const handleRemove = useCallback((key: string) => {
    removeMicroGoal(key);
  }, [removeMicroGoal]);

  const handleAddPreset = useCallback((preset: typeof MICRO_PRESETS[number]) => {
    const defaultGoal = gender === 'female' ? preset.defaultFemale : preset.defaultMale;
    const config: MicroGoalConfig = {
      key: preset.key,
      name: preset.name,
      dailyGoal: defaultGoal,
      unit: preset.unit,
      color: preset.color,
    };
    addMicroGoal(config);
    setShowPresets(false);
  }, [gender, addMicroGoal]);

  return (
    <View>
      {microGoals.map((config) => (
        <MicroGoalRow
          key={config.key}
          config={config}
          gender={gender}
          onGoalChange={handleGoalChange}
          onRemove={handleRemove}
        />
      ))}

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
        <Text style={styles.addText}>Add Micronutrient</Text>
      </TouchableOpacity>

      {showPresets && (
        <>
          {availablePresets.map((preset) => {
            const defaultGoal = gender === 'female' ? preset.defaultFemale : preset.defaultMale;
            return (
              <TouchableOpacity
                key={preset.key}
                style={styles.presetRow}
                onPress={() => handleAddPreset(preset)}
                activeOpacity={0.7}
              >
                <View style={[styles.presetIcon, { backgroundColor: preset.color + '15' }]}>
                  <Ionicons name="flask-outline" size={ms(14)} color={preset.color} />
                </View>
                <Text style={styles.presetName}>{preset.name}</Text>
                <Text style={styles.presetDefault}>
                  {defaultGoal} {preset.unit}
                </Text>
              </TouchableOpacity>
            );
          })}

          {availablePresets.length === 0 && (
            <Text style={styles.emptyText}>All micronutrients added</Text>
          )}
        </>
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    paddingVertical: sw(12),
  },
});

export default React.memo(MicroGoalEditor);
