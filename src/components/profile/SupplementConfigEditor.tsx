import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import {
  useSupplementStore,
  SUPPLEMENT_PRESETS,
  CUSTOM_COLORS,
  nameToKey,
  generateIncrements,
  type SupplementConfig,
} from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';

const UNITS = ['g', 'mg', 'mcg', 'IU', 'ml', 'caps'];

/* ─── Goal Row (per supplement) ──────────────────────── */

interface GoalRowProps {
  config: SupplementConfig;
  onGoalChange: (key: string, value: number) => void;
  onRemove: (key: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function SupplementGoalRow({ config, onGoalChange, onRemove, colors, styles }: GoalRowProps) {
  const [text, setText] = useState(String(config.dailyGoal));

  const handleBlur = useCallback(() => {
    const num = parseFloat(text);
    if (!isNaN(num) && num > 0) {
      onGoalChange(config.key, num);
    } else {
      setText(String(config.dailyGoal));
    }
  }, [text, config.key, config.dailyGoal, onGoalChange]);

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon as any} size={ms(13)} color={config.color} />
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
}

/* ─── Main Editor ────────────────────────────────────── */

export default function SupplementConfigEditor() {
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const addConfig = useSupplementStore((s) => s.addSupplementConfig);
  const removeConfig = useSupplementStore((s) => s.removeSupplementConfig);
  const updateConfig = useSupplementStore((s) => s.updateSupplementConfig);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPresets, setShowPresets] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [customUnit, setCustomUnit] = useState('mg');

  const activeKeys = useMemo(() => new Set(configs.map((c) => c.key)), [configs]);
  const availablePresets = useMemo(
    () => SUPPLEMENT_PRESETS.filter((p) => !activeKeys.has(p.key)),
    [activeKeys],
  );

  const handleGoalChange = useCallback((key: string, value: number) => {
    if (!userId) return;
    updateConfig(userId, key, { dailyGoal: value, increments: generateIncrements(value) });
  }, [userId, updateConfig]);

  const handleRemove = useCallback((key: string) => {
    if (!userId) return;
    removeConfig(userId, key);
  }, [userId, removeConfig]);

  const handleAddPreset = useCallback((preset: typeof SUPPLEMENT_PRESETS[0]) => {
    if (!userId) return;
    const config: SupplementConfig = {
      key: preset.key,
      name: preset.name,
      dailyGoal: preset.defaultGoal,
      unit: preset.unit,
      icon: preset.icon,
      color: preset.color,
      increments: preset.increments,
    };
    addConfig(userId, config);
    setShowPresets(false);
  }, [userId, addConfig]);

  const resetCustom = () => {
    setCustomName('');
    setCustomGoal('');
    setCustomUnit('mg');
    setShowCustom(false);
  };

  const handleAddCustom = useCallback(() => {
    if (!userId) return;
    const name = customName.trim();
    const goal = parseFloat(customGoal);
    if (!name || isNaN(goal) || goal <= 0) return;

    const key = nameToKey(name);
    if (activeKeys.has(key)) return;

    const colorIndex = configs.length % CUSTOM_COLORS.length;
    const config: SupplementConfig = {
      key,
      name,
      dailyGoal: goal,
      unit: customUnit,
      icon: 'medical-outline',
      color: CUSTOM_COLORS[colorIndex],
      increments: generateIncrements(goal),
    };
    addConfig(userId, config);
    resetCustom();
  }, [userId, customName, customGoal, customUnit, configs, activeKeys, addConfig]);

  const canAdd = customName.trim().length > 0 && customGoal.length > 0 && !isNaN(parseFloat(customGoal));

  return (
    <View>
      {/* Active supplements */}
      {configs.map((config) => (
        <SupplementGoalRow
          key={config.key}
          config={config}
          onGoalChange={handleGoalChange}
          onRemove={handleRemove}
          colors={colors}
          styles={styles}
        />
      ))}

      {/* Add supplement */}
      <TouchableOpacity
        style={styles.addRow}
        onPress={() => { setShowPresets(!showPresets); setShowCustom(false); }}
        activeOpacity={0.7}
      >
        <Ionicons
          name={showPresets ? 'chevron-up' : 'add-circle-outline'}
          size={ms(18)}
          color={colors.textSecondary}
        />
        <Text style={styles.addText}>Add Supplement</Text>
      </TouchableOpacity>

      {showPresets && (
        <>
          {availablePresets.map((preset) => (
            <TouchableOpacity
              key={preset.key}
              style={styles.presetRow}
              onPress={() => handleAddPreset(preset)}
              activeOpacity={0.7}
            >
              <View style={[styles.presetIcon, { backgroundColor: preset.color + '15' }]}>
                <Ionicons name={preset.icon as any} size={ms(14)} color={preset.color} />
              </View>
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetDefault}>
                {preset.defaultGoal} {preset.unit}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Custom supplement */}
          {!showCustom ? (
            <TouchableOpacity
              style={styles.customToggle}
              onPress={() => setShowCustom(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={ms(16)} color={colors.textSecondary} />
              <Text style={styles.customToggleText}>Custom Supplement</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.customForm}>
              <TextInput
                style={styles.customInput}
                placeholder="Name (e.g. Biotin)"
                placeholderTextColor={colors.textTertiary}
                value={customName}
                onChangeText={setCustomName}
              />
              <TextInput
                style={styles.customInput}
                placeholder="Daily goal"
                placeholderTextColor={colors.textTertiary}
                value={customGoal}
                onChangeText={setCustomGoal}
                keyboardType="decimal-pad"
              />
              <View style={styles.unitRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitChip,
                      customUnit === u && { backgroundColor: colors.accent + '20', borderColor: colors.accent },
                    ]}
                    onPress={() => setCustomUnit(u)}
                  >
                    <Text style={[styles.unitChipText, customUnit === u && { color: colors.accent }]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.customAddBtn, !canAdd && styles.customAddBtnDisabled]}
                onPress={handleAddCustom}
                activeOpacity={0.7}
                disabled={!canAdd}
              >
                <Text style={styles.customAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
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
  customToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(12),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  customToggleText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  customForm: {
    paddingTop: sw(8),
    gap: sw(10),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  customInput: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(12),
    paddingVertical: sw(10),
  },
  unitRow: {
    flexDirection: 'row',
    gap: sw(6),
    flexWrap: 'wrap',
  },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(6),
    paddingHorizontal: sw(10),
    paddingVertical: sw(5),
  },
  unitChipText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  customAddBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(8),
    paddingVertical: sw(10),
    alignItems: 'center',
  },
  customAddBtnDisabled: {
    opacity: 0.4,
  },
  customAddBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
  },
});
