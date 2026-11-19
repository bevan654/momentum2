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
import GoalEditorRow, { createGoalEditorStyles } from './settings/GoalEditorRow';
import ProteinPowderManager from './settings/ProteinPowderManager';
import { PROTEIN_POWDER_KEY } from '../../stores/useProteinPowderStore';

const UNITS = ['g', 'mg', 'mcg', 'IU', 'ml', 'caps'];

/* ─── Goal Row (per supplement) ──────────────────────── */

const SupplementGoalRow = React.memo(function SupplementGoalRow({ config, onGoalChange, onRemove }: {
  config: SupplementConfig;
  onGoalChange: (key: string, value: number) => void;
  onRemove: (key: string) => void;
}) {
  const commit = useCallback((text: string) => {
    const num = parseFloat(text);
    if (!isNaN(num) && num > 0) {
      onGoalChange(config.key, num);
      return text;
    }
    return String(config.dailyGoal);
  }, [config.key, config.dailyGoal, onGoalChange]);
  const remove = useCallback(() => onRemove(config.key), [onRemove, config.key]);

  return (
    <GoalEditorRow
      icon={config.icon}
      color={config.color}
      label={config.name}
      unit={config.unit}
      value={config.dailyGoal}
      keyboardType="decimal-pad"
      followValue={false}
      onCommit={commit}
      onRemove={remove}
    />
  );
});

/* ─── Main Editor ────────────────────────────────────── */

function SupplementConfigEditor() {
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const addConfig = useSupplementStore((s) => s.addSupplementConfig);
  const removeConfig = useSupplementStore((s) => s.removeSupplementConfig);
  const updateConfig = useSupplementStore((s) => s.updateSupplementConfig);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => ({ ...createGoalEditorStyles(colors), ...createStyles(colors) }), [colors]);
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
        <React.Fragment key={config.key}>
          <SupplementGoalRow
            config={config}
            onGoalChange={handleGoalChange}
            onRemove={handleRemove}
          />
          {/* Protein powder: the user's powders (flavours), each with its macros per serving. */}
          {config.key === PROTEIN_POWDER_KEY && (
            <View style={styles.powders}>
              <Text style={styles.powdersLabel}>My powders</Text>
              <ProteinPowderManager />
            </View>
          )}
        </React.Fragment>
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
                onChangeText={(v) => setCustomGoal(v.replace(',', '.'))}
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
  powders: {
    gap: sw(8),
    paddingBottom: sw(12),
    paddingLeft: sw(8),
  },
  powdersLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

export default React.memo(SupplementConfigEditor);
