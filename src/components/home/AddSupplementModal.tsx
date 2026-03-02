import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
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

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddSupplementModal({ visible, onClose }: Props) {
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const addConfig = useSupplementStore((s) => s.addSupplementConfig);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [customUnit, setCustomUnit] = useState('mg');

  const activeKeys = useMemo(() => new Set(configs.map((c) => c.key)), [configs]);
  const available = useMemo(
    () => SUPPLEMENT_PRESETS.filter((p) => !activeKeys.has(p.key)),
    [activeKeys],
  );

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
    onClose();
  }, [userId, addConfig, onClose]);

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
    onClose();
  }, [userId, customName, customGoal, customUnit, configs, activeKeys, addConfig, onClose]);

  const resetCustom = () => {
    setCustomName('');
    setCustomGoal('');
    setCustomUnit('mg');
    setShowCustom(false);
  };

  const handleClose = () => {
    resetCustom();
    onClose();
  };

  const canAdd = customName.trim().length > 0 && customGoal.length > 0 && !isNaN(parseFloat(customGoal));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={handleClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Supplement</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={ms(22)} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Presets */}
            {available.map((preset) => (
              <TouchableOpacity
                key={preset.key}
                style={styles.presetRow}
                onPress={() => handleAddPreset(preset)}
                activeOpacity={0.7}
              >
                <View style={[styles.presetIcon, { backgroundColor: preset.color + '15' }]}>
                  <Ionicons name={preset.icon as any} size={ms(16)} color={preset.color} />
                </View>
                <View style={styles.presetInfo}>
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetMeta}>{preset.defaultGoal} {preset.unit}/day</Text>
                </View>
                <Ionicons name="add-circle-outline" size={ms(20)} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}

            {/* Custom section */}
            {!showCustom ? (
              <TouchableOpacity
                style={styles.customToggle}
                onPress={() => setShowCustom(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={ms(18)} color={colors.textSecondary} />
                <Text style={styles.customToggleText}>Custom Supplement</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.customForm}>
                <Text style={styles.customLabel}>Custom Supplement</Text>

                <TextInput
                  style={styles.customInput}
                  placeholder="Name (e.g. Biotin)"
                  placeholderTextColor={colors.textTertiary}
                  value={customName}
                  onChangeText={setCustomName}
                  autoFocus
                />

                <TextInput
                  style={styles.customInput}
                  placeholder="Daily goal"
                  placeholderTextColor={colors.textTertiary}
                  value={customGoal}
                  onChangeText={setCustomGoal}
                  keyboardType="decimal-pad"
                />

                {/* Unit selector */}
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
                  style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
                  onPress={handleAddCustom}
                  activeOpacity={0.7}
                  disabled={!canAdd}
                >
                  <Text style={styles.addBtnText}>Add Supplement</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: sw(20) }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    paddingHorizontal: sw(20),
    paddingBottom: sw(34),
    maxHeight: '70%',
  },
  handleBar: {
    width: sw(36),
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    alignSelf: 'center',
    marginTop: sw(10),
    marginBottom: sw(6),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(12),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  scrollArea: {
    flexGrow: 0,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    paddingVertical: sw(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  presetIcon: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.semiBold,
  },
  presetMeta: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.regular,
  },
  customToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingVertical: sw(16),
  },
  customToggleText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.semiBold,
  },
  customForm: {
    paddingTop: sw(12),
    gap: sw(12),
  },
  customLabel: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.bold,
  },
  customInput: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingHorizontal: sw(14),
    paddingVertical: sw(12),
  },
  unitRow: {
    flexDirection: 'row',
    gap: sw(8),
    flexWrap: 'wrap',
  },
  unitChip: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(8),
    paddingHorizontal: sw(12),
    paddingVertical: sw(6),
  },
  unitChipText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
    marginTop: sw(4),
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.bold,
  },
});
