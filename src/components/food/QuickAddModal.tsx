import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNutrientGoalStore } from '../../stores/useNutrientGoalStore';
import { useThemeStore } from '../../stores/useThemeStore';
import FoodSubScreen from './ui/FoodSubScreen';
import PrimaryActionBar from './ui/PrimaryActionBar';
import NumberField from './ui/NumberField';
import MacroSplitBar from './MacroSplitBar';
import { findMealConfig } from './groupEntriesByMeal';

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
  onAdded: () => void;
}

const KJ_PER_KCAL = 4.184;

/**
 * Quick add: log calories and macros without picking a food. Calories left blank are
 * worked out from the macros (P and C 4 kcal/g, F 9 kcal/g). Only tracked micros are shown.
 */
export default function QuickAddModal({ visible, mealSlot, targetHour, onDismiss, onAdded }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((st) => st.mode) === 'dark';

  const userId = useAuthStore((st) => st.user?.id);
  const addEntry = useFoodLogStore((st) => st.addEntry);
  const selectedDate = useFoodLogStore((st) => st.selectedDate);
  const mealLabel = useFoodLogStore((st) => findMealConfig(st.mealConfigs, mealSlot)?.label);
  const microGoals = useNutrientGoalStore((st) => st.microGoals);
  const loaded = useNutrientGoalStore((st) => st.loaded);
  const loadConfigs = useNutrientGoalStore((st) => st.loadConfigs);

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [kj, setKj] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [microValues, setMicroValues] = useState<Record<string, string>>({});

  const calRef = useRef<TextInput>(null);
  const proRef = useRef<TextInput>(null);
  const carbRef = useRef<TextInput>(null);
  const fatRef = useRef<TextInput>(null);

  // kcal and kJ stay in sync; calories are always stored as kcal.
  const handleCalChange = useCallback((v: string) => {
    setCalories(v);
    const n = Number(v);
    setKj(v === '' ? '' : Number.isFinite(n) ? String(Math.round(n * KJ_PER_KCAL)) : '');
  }, []);
  const handleKjChange = useCallback((v: string) => {
    setKj(v);
    const n = Number(v);
    setCalories(v === '' ? '' : Number.isFinite(n) ? String(Math.round(n / KJ_PER_KCAL)) : '');
  }, []);

  useEffect(() => {
    if (visible) return;
    setName('');
    setCalories('');
    setKj('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMicroValues({});
  }, [visible]);

  const handleMicroChange = useCallback((key: string, value: string) => {
    setMicroValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const p = Number(protein) || 0;
  const c = Number(carbs) || 0;
  const f = Number(fat) || 0;
  const fromMacros = Math.round(p * 4 + c * 4 + f * 9);
  const entered = Number(calories) || 0;
  // What the screen shows and what gets saved: typed calories, else worked out from macros.
  const previewCal = entered > 0 ? entered : fromMacros;
  const autoCalc = entered <= 0 && fromMacros > 0;
  const canSubmit = entered > 0 || p > 0 || c > 0 || f > 0;

  const handleAdd = useCallback(() => {
    if (!userId || !canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const microFields: Record<string, number | null> = {};
    for (const g of microGoals) {
      const val = Number(microValues[g.key]);
      microFields[g.key] = val > 0 ? val : null;
    }

    addEntry(userId, {
      name: name.trim() || 'Quick Add',
      brand: null,
      calories: previewCal,
      protein: p,
      carbs: c,
      fat: f,
      meal_type: mealSlot,
      quantity: 1,
      serving_size: 1,
      serving_unit: 'serving',
      is_planned: false,
      ...microFields,
    }, targetHour != null ? selectedDate : undefined, targetHour);

    onAdded();
  }, [userId, canSubmit, name, previewCal, p, c, f, mealSlot, targetHour, selectedDate, addEntry, onAdded, microGoals, microValues]);

  return (
    <FoodSubScreen
      visible={visible}
      title="Quick add"
      subtitle={mealLabel ? `to ${mealLabel}` : undefined}
      onBack={onDismiss}
      footer={
        <PrimaryActionBar
          label="Add"
          sublabel={previewCal > 0 ? `${previewCal} kcal` : undefined}
          icon="flash"
          onPress={handleAdd}
          disabled={!canSubmit}
        />
      }
    >
      {/* Summary */}
      <View style={s.hero}>
        <Text style={s.heroNum}>
          {previewCal.toLocaleString()}
          <Text style={s.heroUnit}> kcal</Text>
        </Text>
        <Text style={s.heroHint}>{autoCalc ? 'Worked out from your macros' : 'Enter calories, macros, or both'}</Text>
        <View style={s.heroBar}>
          <MacroSplitBar protein={p} carbs={c} fat={f} showGrams={false} />
        </View>
      </View>

      {/* Name */}
      <View style={s.group}>
        <Text style={s.label}>Name (optional)</Text>
        <TextInput
          style={s.textField}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Snack, protein shake"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="next"
          blurOnSubmit={false}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          onSubmitEditing={() => calRef.current?.focus()}
          accessibilityLabel="Name"
        />
      </View>

      {/* Energy */}
      <View style={s.group}>
        <Text style={s.label}>Energy</Text>
        <View style={s.row}>
          <NumberField ref={calRef} label="Calories" unit="kcal" value={calories} onChangeText={handleCalChange} onSubmitEditing={() => proRef.current?.focus()} />
          <NumberField label="Kilojoules" unit="kJ" value={kj} onChangeText={handleKjChange} onSubmitEditing={() => proRef.current?.focus()} />
        </View>
      </View>

      {/* Macros */}
      <View style={s.group}>
        <Text style={s.label}>Macros</Text>
        <View style={s.row}>
          <NumberField ref={proRef} label="Protein" unit="g" accentColor={colors.protein} value={protein} onChangeText={setProtein} onSubmitEditing={() => carbRef.current?.focus()} />
          <NumberField ref={carbRef} label="Carbs" unit="g" accentColor={colors.carbs} value={carbs} onChangeText={setCarbs} onSubmitEditing={() => fatRef.current?.focus()} />
          <NumberField ref={fatRef} label="Fat" unit="g" accentColor={colors.fat} value={fat} onChangeText={setFat} returnKeyType="done" blurOnSubmit />
        </View>
      </View>

      {/* Tracked micronutrients */}
      {microGoals.length > 0 && (
        <View style={s.group}>
          <Text style={s.label}>Micronutrients</Text>
          <View style={s.microCard}>
            {microGoals.map((g, i) => (
              <View key={g.key} style={[s.microRow, i > 0 && s.microDivider]}>
                <View style={[s.microDot, { backgroundColor: g.color }]} />
                <Text style={s.microLabel} numberOfLines={1}>{g.name}</Text>
                <TextInput
                  style={s.microInput}
                  value={microValues[g.key] || ''}
                  onChangeText={(v) => handleMicroChange(g.key, v.replace(',', '.'))}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  accessibilityLabel={`${g.name} in ${g.unit}`}
                />
                <Text style={s.microUnit}>{g.unit}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </FoodSubScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      alignItems: 'center',
      paddingVertical: sw(10),
      gap: sw(4),
    },
    heroNum: {
      color: colors.textPrimary,
      fontSize: ms(40),
      lineHeight: ms(46),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1,
    },
    heroUnit: {
      color: colors.textTertiary,
      fontSize: ms(16),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0,
    },
    heroHint: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    heroBar: {
      alignSelf: 'stretch',
      marginTop: sw(8),
      paddingHorizontal: sw(40),
    },
    group: {
      gap: sw(8),
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    row: {
      flexDirection: 'row',
      gap: sw(8),
    },
    textField: {
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.medium,
      paddingHorizontal: sw(14),
      height: sw(48),
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    microCard: {
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(14),
    },
    microRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      minHeight: sw(46),
    },
    microDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    microDot: {
      width: sw(7),
      height: sw(7),
      borderRadius: sw(3.5),
    },
    microLabel: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    microInput: {
      minWidth: sw(60),
      textAlign: 'right',
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.semiBold,
      paddingVertical: sw(8),
    },
    microUnit: {
      width: sw(30),
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
    },
  });
