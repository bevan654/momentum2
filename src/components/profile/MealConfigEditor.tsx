import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore, MealConfig } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';

export default function MealConfigEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const mealConfigs = useFoodLogStore((s) => s.mealConfigs);
  const updateMealConfig = useFoodLogStore((s) => s.updateMealConfig);
  const deleteMealConfig = useFoodLogStore((s) => s.deleteMealConfig);
  const addMealConfig = useFoodLogStore((s) => s.addMealConfig);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleToggle = useCallback((meal: MealConfig) => {
    updateMealConfig(meal.id, { enabled: !meal.enabled });
  }, [updateMealConfig]);

  const handleLabelChange = useCallback((meal: MealConfig, label: string) => {
    if (label.trim().length > 0) {
      updateMealConfig(meal.id, { label: label.trim() });
    }
  }, [updateMealConfig]);

  const handleTimeChange = useCallback((meal: MealConfig, time: string) => {
    // Basic HH:MM validation
    if (/^\d{2}:\d{2}$/.test(time)) {
      updateMealConfig(meal.id, { time_start: time });
    }
  }, [updateMealConfig]);

  const handleDelete = useCallback((mealId: string) => {
    deleteMealConfig(mealId);
  }, [deleteMealConfig]);

  const handleAdd = useCallback(() => {
    if (!userId) return;
    const nextOrder = mealConfigs.length;
    addMealConfig(userId, {
      slot: `custom_${Date.now()}`,
      label: 'New Meal',
      icon: 'restaurant-outline',
      time_start: '12:00',
      enabled: true,
      sort_order: nextOrder,
    });
  }, [userId, mealConfigs.length, addMealConfig]);

  return (
    <View>
      {mealConfigs.map((meal) => (
        <MealRow
          key={meal.id}
          meal={meal}
          onToggle={handleToggle}
          onLabelChange={handleLabelChange}
          onTimeChange={handleTimeChange}
          onDelete={handleDelete}
        />
      ))}
      <TouchableOpacity style={styles.addRow} onPress={handleAdd} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={ms(20)} color={colors.accent} />
        <Text style={styles.addText}>Add Meal</Text>
      </TouchableOpacity>
    </View>
  );
}

function MealRow({
  meal,
  onToggle,
  onLabelChange,
  onTimeChange,
  onDelete,
}: {
  meal: MealConfig;
  onToggle: (meal: MealConfig) => void;
  onLabelChange: (meal: MealConfig, label: string) => void;
  onTimeChange: (meal: MealConfig, time: string) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState(meal.label);
  const [time, setTime] = useState(meal.time_start);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.mealRow}>
      <Switch
        value={meal.enabled}
        onValueChange={() => onToggle(meal)}
        trackColor={{ false: colors.cardBorder, true: colors.accentGreen }}
        thumbColor={colors.textOnAccent}
      />
      <TextInput
        style={styles.labelInput}
        value={label}
        onChangeText={setLabel}
        onBlur={() => onLabelChange(meal, label)}
        placeholderTextColor={colors.textTertiary}
      />
      <TextInput
        style={styles.timeInput}
        value={time}
        onChangeText={setTime}
        onBlur={() => onTimeChange(meal, time)}
        placeholderTextColor={colors.textTertiary}
        keyboardType="numbers-and-punctuation"
      />
      <TouchableOpacity onPress={() => onDelete(meal.id)} hitSlop={8}>
        <Ionicons name="trash-outline" size={ms(18)} color={colors.accentRed} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(8),
    gap: sw(10),
  },
  labelInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(6),
  },
  timeInput: {
    width: sw(60),
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(8),
    paddingVertical: sw(6),
    textAlign: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(12),
  },
  addText: {
    color: colors.accent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
});
