import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useProteinPowderStore, type ProteinPowder } from '../../stores/useProteinPowderStore';
import { useAuthStore } from '../../stores/useAuthStore';
import AddPowderModal from './AddPowderModal';

const POWDER_COLOR = '#86EFAC';

export default function ProteinPowderSettings() {
  const powders = useProteinPowderStore((s) => s.powders);
  const scoopGoal = useProteinPowderStore((s) => s.scoopGoal);
  const updateScoopGoal = useProteinPowderStore((s) => s.updateScoopGoal);
  const deletePowder = useProteinPowderStore((s) => s.deletePowder);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [goalText, setGoalText] = useState(String(scoopGoal || ''));
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPowder, setEditingPowder] = useState<ProteinPowder | null>(null);

  const handleGoalBlur = useCallback(() => {
    if (!userId) return;
    const num = parseInt(goalText, 10);
    if (!isNaN(num) && num >= 0) {
      updateScoopGoal(userId, num);
    } else {
      setGoalText(String(scoopGoal));
    }
  }, [userId, goalText, scoopGoal, updateScoopGoal]);

  const handleEdit = useCallback((powder: ProteinPowder) => {
    setEditingPowder(powder);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((powderId: string) => {
    deletePowder(powderId);
  }, [deletePowder]);

  const handleAddPress = useCallback(() => {
    setEditingPowder(null);
    setModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalVisible(false);
    setEditingPowder(null);
  }, []);

  return (
    <View>
      {/* Scoop goal */}
      <View style={styles.goalRow}>
        <Text style={styles.fieldLabel}>Daily Scoop Goal</Text>
        <View style={styles.goalInputWrap}>
          <TextInput
            style={styles.goalInput}
            value={goalText}
            onChangeText={setGoalText}
            onBlur={handleGoalBlur}
            keyboardType="number-pad"
            placeholderTextColor={colors.textTertiary}
            placeholder="0"
          />
          <Text style={styles.unitText}>scoops</Text>
        </View>
      </View>

      {/* Saved powders */}
      {powders.map((powder) => (
        <View key={powder.id} style={styles.powderRow}>
          <View style={styles.powderIcon}>
            <Ionicons name="nutrition-outline" size={ms(13)} color={POWDER_COLOR} />
          </View>
          <View style={styles.powderInfo}>
            <Text style={styles.powderName} numberOfLines={1}>{powder.name}</Text>
            <Text style={styles.powderMacros}>
              {powder.calories} cal · {powder.protein}g P · {powder.carbs}g C · {powder.fat}g F
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleEdit(powder)} hitSlop={8} style={styles.editBtn}>
            <Ionicons name="create-outline" size={ms(16)} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(powder.id)} hitSlop={8} style={styles.removeBtn}>
            <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Add powder button */}
      <TouchableOpacity
        style={styles.addRow}
        onPress={handleAddPress}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={ms(18)} color={colors.textSecondary} />
        <Text style={styles.addText}>Add Powder</Text>
      </TouchableOpacity>

      <AddPowderModal
        visible={modalVisible}
        onClose={handleModalClose}
        powder={editingPowder}
      />
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(6),
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  goalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  goalInput: {
    width: sw(50),
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
  },
  powderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(10),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  powderIcon: {
    width: sw(26),
    height: sw(26),
    borderRadius: sw(7),
    backgroundColor: POWDER_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powderInfo: {
    flex: 1,
  },
  powderName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  powderMacros: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.regular,
  },
  editBtn: {
    marginRight: sw(4),
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
});
