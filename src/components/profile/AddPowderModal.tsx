import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useProteinPowderStore, type ProteinPowder } from '../../stores/useProteinPowderStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  powder?: ProteinPowder | null;
}

export default function AddPowderModal({ visible, onClose, powder }: Props) {
  const addPowder = useProteinPowderStore((s) => s.addPowder);
  const updatePowder = useProteinPowderStore((s) => s.updatePowder);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isEditing = !!powder;

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      if (powder) {
        setName(powder.name);
        setCalories(String(powder.calories));
        setProtein(String(powder.protein));
        setCarbs(String(powder.carbs));
        setFat(String(powder.fat));
      } else {
        setName('');
        setCalories('');
        setProtein('');
        setCarbs('');
        setFat('');
      }
    }
  }, [visible, powder]);

  const canSave = name.trim().length > 0
    && calories.length > 0 && !isNaN(Number(calories))
    && protein.length > 0 && !isNaN(Number(protein))
    && carbs.length > 0 && !isNaN(Number(carbs))
    && fat.length > 0 && !isNaN(Number(fat));

  const handleSave = useCallback(() => {
    if (!userId || !canSave) return;

    const data = {
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    };

    if (isEditing && powder) {
      updatePowder(powder.id, data);
    } else {
      addPowder(userId, data);
    }
    onClose();
  }, [userId, canSave, name, calories, protein, carbs, fat, isEditing, powder, addPowder, updatePowder, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{isEditing ? 'Edit Powder' : 'Add Powder'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={ms(22)} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Name (e.g. Gold Standard Whey)"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoFocus={!isEditing}
            />

            <View style={styles.macroRow}>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Calories</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="120"
                  placeholderTextColor={colors.textTertiary}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="25"
                  placeholderTextColor={colors.textTertiary}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="3"
                  placeholderTextColor={colors.textTertiary}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.macroField}>
                <Text style={styles.macroLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  placeholder="2"
                  placeholderTextColor={colors.textTertiary}
                  value={fat}
                  onChangeText={setFat}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={!canSave}
            >
              <Text style={styles.saveBtnText}>{isEditing ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: sw(20) }} />
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
  form: {
    gap: sw(12),
  },
  input: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingHorizontal: sw(14),
    paddingVertical: sw(12),
  },
  macroRow: {
    flexDirection: 'row',
    gap: sw(12),
  },
  macroField: {
    flex: 1,
    gap: sw(4),
  },
  macroLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  macroInput: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingHorizontal: sw(14),
    paddingVertical: sw(12),
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
    marginTop: sw(4),
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.bold,
  },
});
