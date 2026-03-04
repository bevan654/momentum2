import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  Modal, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function WaterSettingsModal({ visible, onClose }: Props) {
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const updateSupplementGoals = useSupplementStore((s) => s.updateSupplementGoals);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [goalText, setGoalText] = useState(String(waterGoal || ''));

  // Sync goalText when modal opens
  React.useEffect(() => {
    if (visible) setGoalText(String(waterGoal || ''));
  }, [visible, waterGoal]);

  const handleGoalBlur = useCallback(() => {
    if (!userId) return;
    const num = parseInt(goalText, 10);
    if (!isNaN(num) && num > 0) {
      updateSupplementGoals(userId, { water_goal: num });
    } else {
      setGoalText(String(waterGoal));
    }
  }, [userId, goalText, waterGoal, updateSupplementGoals]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          style={styles.centered}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modal}>
            <View style={styles.titleRow}>
              <View style={styles.titleIcon}>
                <Ionicons name="water-outline" size={ms(16)} color={colors.water} />
              </View>
              <Text style={styles.title}>Water</Text>
            </View>

            {/* Daily Water Goal */}
            <Text style={styles.sectionLabel}>Daily Water Goal</Text>
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
              <Text style={styles.unitText}>ml</Text>
            </View>

            {/* Done button */}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
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
    backgroundColor: colors.water + '15',
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
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(14),
    alignItems: 'center',
    marginTop: sw(20),
  },
  doneBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
});
