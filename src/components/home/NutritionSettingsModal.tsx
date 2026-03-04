import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  Modal, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';

const ANIM_DURATION = 250;
const ANIM_EASING = Easing.out(Easing.cubic);

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NutritionSettingsModal({ visible, onClose }: Props) {
  const goals = useFoodLogStore((s) => s.goals);
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cal, setCal] = useState(String(goals.calorie_goal));
  const [pro, setPro] = useState(String(goals.protein_goal));
  const [carbs, setCarbs] = useState(String(goals.carbs_goal));
  const [fat, setFat] = useState(String(goals.fat_goal));

  // Animation
  const backdropOpacity = useSharedValue(0);
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(sw(30));

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      modalOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      modalTranslateY.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    } else {
      backdropOpacity.value = 0;
      modalOpacity.value = 0;
      modalTranslateY.value = sw(30);
    }
  }, [visible]);

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalAnimStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ translateY: modalTranslateY.value }],
  }));

  // Sync when modal opens
  useEffect(() => {
    if (visible) {
      setCal(String(goals.calorie_goal));
      setPro(String(goals.protein_goal));
      setCarbs(String(goals.carbs_goal));
      setFat(String(goals.fat_goal));
    }
  }, [visible, goals]);

  const save = useCallback((field: string, value: string, setter: (v: string) => void, original: number) => {
    if (!userId) return;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      updateGoals(userId, { [field]: num });
    } else {
      setter(String(original));
    }
  }, [userId, updateGoals]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdropBase} onPress={onClose}>
        <ReAnimated.View style={[styles.backdropFill, backdropAnimStyle]} />
        <KeyboardAvoidingView
          style={styles.centered}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalPressable}>
            <ReAnimated.View style={[styles.modal, modalAnimStyle]}>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                <View style={styles.titleRow}>
                  <View style={styles.titleIcon}>
                    <Ionicons name="restaurant-outline" size={ms(16)} color={colors.accent} />
                  </View>
                  <Text style={styles.title}>Nutrition Goals</Text>
                </View>

                <GoalInputRow
                  label="Calories"
                  value={cal}
                  onChange={setCal}
                  onBlur={() => save('calorie_goal', cal, setCal, goals.calorie_goal)}
                  unit="kcal"
                  colors={colors}
                  styles={styles}
                />
                <GoalInputRow
                  label="Protein"
                  value={pro}
                  onChange={setPro}
                  onBlur={() => save('protein_goal', pro, setPro, goals.protein_goal)}
                  unit="g"
                  colors={colors}
                  styles={styles}
                />
                <GoalInputRow
                  label="Carbs"
                  value={carbs}
                  onChange={setCarbs}
                  onBlur={() => save('carbs_goal', carbs, setCarbs, goals.carbs_goal)}
                  unit="g"
                  colors={colors}
                  styles={styles}
                />
                <GoalInputRow
                  label="Fat"
                  value={fat}
                  onChange={setFat}
                  onBlur={() => save('fat_goal', fat, setFat, goals.fat_goal)}
                  unit="g"
                  colors={colors}
                  styles={styles}
                />

                {/* Done button */}
                <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            </ReAnimated.View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function GoalInputRow({ label, value, onChange, onBlur, unit, colors, styles }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  unit: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.goalRow}>
      <Text style={styles.goalLabel}>{label}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.goalInput}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholderTextColor={colors.textTertiary}
          placeholder="0"
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdropBase: {
    flex: 1,
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPressable: {
    width: '85%',
    maxWidth: sw(340),
    maxHeight: '80%',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(24),
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
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(8),
  },
  goalLabel: {
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
    width: sw(80),
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    padding: sw(10),
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  unitText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    width: sw(30),
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(14),
    alignItems: 'center',
    marginTop: sw(16),
  },
  doneBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
});
