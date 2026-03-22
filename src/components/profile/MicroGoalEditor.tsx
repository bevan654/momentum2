import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState(String(config.dailyGoal));

  useEffect(() => {
    setText(String(config.dailyGoal));
  }, [config.dailyGoal]);

  const handleBlur = useCallback(() => {
    const num = parseFloat(text);
    if (isNaN(num) || num <= 0) {
      // Snap to RDA default
      const defaultVal = getMicroDefault(config.key, gender);
      setText(String(defaultVal));
      onGoalChange(config.key, defaultVal);
    } else {
      onGoalChange(config.key, num);
    }
  }, [text, config.key, gender, onGoalChange]);

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: config.color + '15' }]}>
        <Ionicons name="flask-outline" size={ms(13)} color={config.color} />
      </View>
      <Text style={styles.label}>{config.name}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onBlur={handleBlur}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.unitText}>{config.unit}</Text>
      </View>
      <TouchableOpacity onPress={() => onRemove(config.key)} hitSlop={8} style={styles.removeBtn}>
        <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
});

/* ─── Main Editor ────────────────────────────────────── */

export default function MicroGoalEditor() {
  const profile = useAuthStore((s) => s.profile);
  const microGoals = useNutrientGoalStore((s) => s.microGoals);
  const addMicroGoal = useNutrientGoalStore((s) => s.addMicroGoal);
  const removeMicroGoal = useNutrientGoalStore((s) => s.removeMicroGoal);
  const updateMicroGoal = useNutrientGoalStore((s) => s.updateMicroGoal);
  const loadConfigs = useNutrientGoalStore((s) => s.loadConfigs);
  const loaded = useNutrientGoalStore((s) => s.loaded);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    width: sw(28),
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
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    paddingVertical: sw(12),
  },
});
