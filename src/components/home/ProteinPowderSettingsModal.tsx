import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  Modal, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useProteinPowderStore, type ProteinPowder } from '../../stores/useProteinPowderStore';
import { useAuthStore } from '../../stores/useAuthStore';
import AddPowderModal from '../profile/AddPowderModal';

const POWDER_COLOR = '#86EFAC';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ProteinPowderSettingsModal({ visible, onClose }: Props) {
  const powders = useProteinPowderStore((s) => s.powders);
  const scoopGoal = useProteinPowderStore((s) => s.scoopGoal);
  const updateScoopGoal = useProteinPowderStore((s) => s.updateScoopGoal);
  const deletePowder = useProteinPowderStore((s) => s.deletePowder);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [goalText, setGoalText] = useState(String(scoopGoal || ''));
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingPowder, setEditingPowder] = useState<ProteinPowder | null>(null);

  // Sync goalText when modal opens
  React.useEffect(() => {
    if (visible) setGoalText(String(scoopGoal || ''));
  }, [visible, scoopGoal]);

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
    setAddModalVisible(true);
  }, []);

  const handleDelete = useCallback((powderId: string) => {
    deletePowder(powderId);
  }, [deletePowder]);

  const handleAddPress = useCallback(() => {
    setEditingPowder(null);
    setAddModalVisible(true);
  }, []);

  const handleAddModalClose = useCallback(() => {
    setAddModalVisible(false);
    setEditingPowder(null);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          style={styles.centered}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modal}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={styles.titleRow}>
                <View style={styles.titleIcon}>
                  <Ionicons name="nutrition-outline" size={ms(16)} color={POWDER_COLOR} />
                </View>
                <Text style={styles.title}>Protein Powder</Text>
              </View>

              {/* Daily Scoop Goal */}
              <Text style={styles.sectionLabel}>Daily Scoop Goal</Text>
              <View style={styles.goalRow}>
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

              {/* Saved Powders */}
              <Text style={[styles.sectionLabel, { marginTop: sw(16) }]}>Saved Powders</Text>
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
                  <TouchableOpacity onPress={() => handleDelete(powder.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Powder */}
              <TouchableOpacity
                style={styles.addRow}
                onPress={handleAddPress}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={ms(18)} color={colors.textSecondary} />
                <Text style={styles.addText}>Add Powder</Text>
              </TouchableOpacity>

              {/* Done button */}
              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>

      <AddPowderModal
        visible={addModalVisible}
        onClose={handleAddModalClose}
        powder={editingPowder}
      />
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(24),
    width: '85%',
    maxWidth: sw(340),
    maxHeight: '80%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
    marginBottom: sw(20),
  },
  titleIcon: {
    width: sw(30),
    height: sw(30),
    borderRadius: sw(8),
    backgroundColor: POWDER_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: sw(8),
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  goalInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    padding: sw(12),
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  unitText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  powderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(12),
  },
  addText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(14),
    alignItems: 'center',
    marginTop: sw(8),
  },
  doneBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
});
