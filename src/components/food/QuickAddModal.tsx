import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
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
import { sanitizeDecimal } from './decimalInput';
import RevealTextInput from './ui/RevealTextInput';
import type { MealItemData } from './foodDetailTypes';

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
  onAdded: () => void;
  /**
   * Make a meal: return the food as a meal item (values for one serving, plus how many)
   * instead of logging it to the diary.
   */
  onSubmitItem?: (item: MealItemData) => void;
  /** Overrides the "to Breakfast" subtitle (e.g. "to your meal"). */
  subtitle?: string;
}

const KJ_PER_KCAL = 4.184;

/** Units a quick add can be logged in. "serving" counts servings; the rest are an amount. */
const SERVING_UNITS = ['serving', 'g', 'ml', 'oz', 'cup'] as const;
type ServingUnit = (typeof SERVING_UNITS)[number];
const DEFAULT_AMOUNT: Record<ServingUnit, string> = { serving: '1', g: '100', ml: '250', oz: '1', cup: '1' };

/**
 * Quick add: log calories and macros without picking a food. Calories left blank are
 * worked out from the macros (P and C 4 kcal/g, F 9 kcal/g). Only tracked micros are shown.
 */
function QuickAddModal({ visible, mealSlot, targetHour, onDismiss, onAdded, onSubmitItem, subtitle }: Props) {
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
  const [servingUnit, setServingUnit] = useState<ServingUnit>('serving');
  const [amount, setAmount] = useState(DEFAULT_AMOUNT.serving);
  /** How many servings to log in one go (typed, so any number works). */
  const [count, setCount] = useState('1');
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
    setServingUnit('serving');
    setAmount(DEFAULT_AMOUNT.serving);
    setCount('1');
    setCalories('');
    setKj('');
    setProtein('');
    setCarbs('');
    setFat('');
    setMicroValues({});
  }, [visible]);

  // Switching unit starts from a typical amount (1 serving, 100 g, 250 ml...).
  const handleUnitChange = useCallback((unit: ServingUnit) => {
    Haptics.selectionAsync();
    setServingUnit(unit);
    setAmount(DEFAULT_AMOUNT[unit]);
  }, []);

  const handleMicroChange = useCallback((key: string, value: string) => {
    setMicroValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const p = Number(protein) || 0;
  const c = Number(carbs) || 0;
  const f = Number(fat) || 0;
  const fromMacros = Math.round(p * 4 + c * 4 + f * 9);
  const entered = Number(calories) || 0;
  // One serving: typed calories, else worked out from macros.
  const perServingCal = entered > 0 ? entered : fromMacros;
  const autoCalc = entered <= 0 && fromMacros > 0;
  const multiplier = Number(count) > 0 ? Number(count) : 1;
  // What the screen shows and what gets saved: one serving × how many.
  const previewCal = Math.round(perServingCal * multiplier);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  // A "serving" is one serving; other units have a size (250 ml, 100 g...).
  const amountNum = servingUnit === 'serving' ? 1 : Number(amount) > 0 ? Number(amount) : 1;
  const canSubmit = entered > 0 || p > 0 || c > 0 || f > 0;

  const handleAdd = useCallback(() => {
    if (!canSubmit) return;
    if (onSubmitItem) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // A meal item holds one serving's values and a quantity; the meal multiplies them out.
      // Fiber and sugar have their own fields; the rest of the tracked nutrients go in micros.
      const micros: Record<string, number | null> = {};
      let fiber: number | null = null;
      let sugar: number | null = null;
      for (const g of microGoals) {
        const val = Number(microValues[g.key]);
        const v = val > 0 ? round1(val) : null;
        if (g.key === 'fiber') fiber = v;
        else if (g.key === 'sugar') sugar = v;
        else micros[g.key] = v;
      }
      onSubmitItem({
        name: name.trim() || 'Quick add',
        brand: null,
        food_catalog_id: null,
        calories: perServingCal,
        protein: round1(p),
        carbs: round1(c),
        fat: round1(f),
        fiber,
        sugar,
        micros,
        serving_size: amountNum,
        serving_unit: servingUnit,
        quantity: multiplier,
      });
      return;
    }
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const microFields: Record<string, number | null> = {};
    for (const g of microGoals) {
      const val = Number(microValues[g.key]);
      microFields[g.key] = val > 0 ? round1(val * multiplier) : null;
    }

    addEntry(userId, {
      name: name.trim() || 'Quick Add',
      brand: null,
      // The values typed are for one serving; the entry holds the totals for all of them.
      calories: previewCal,
      protein: round1(p * multiplier),
      carbs: round1(c * multiplier),
      fat: round1(f * multiplier),
      meal_type: mealSlot,
      // e.g. 2 × 250 ml = quantity 2 of a 250 ml serving; 3 servings = quantity 3 of "1 serving".
      quantity: multiplier,
      serving_size: amountNum,
      serving_unit: servingUnit,
      is_planned: false,
      ...microFields,
    }, targetHour != null ? selectedDate : undefined, targetHour);

    onAdded();
  }, [userId, canSubmit, name, previewCal, perServingCal, p, c, f, mealSlot, targetHour, selectedDate, addEntry, onAdded, onSubmitItem, microGoals, microValues, servingUnit, amountNum, multiplier]);

  return (
    <FoodSubScreen
      visible={visible}
      title="Quick add"
      subtitle={subtitle ?? (mealLabel ? `to ${mealLabel}` : undefined)}
      onBack={onDismiss}
      footer={
        <PrimaryActionBar
          label={onSubmitItem ? 'Add to meal' : 'Add'}
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
        <Text style={s.heroHint}>
          {multiplier > 1 && perServingCal > 0
            ? `${multiplier} × ${perServingCal.toLocaleString()} kcal${autoCalc ? ', from your macros' : ''}`
            : autoCalc ? 'Worked out from your macros' : 'Enter calories, macros, or both'}
        </Text>
        <View style={s.heroBar}>
          <MacroSplitBar protein={p * multiplier} carbs={c * multiplier} fat={f * multiplier} showGrams={false} />
        </View>
      </View>

      {/* Name */}
      <View style={s.group}>
        <Text style={s.label}>Name (optional)</Text>
        <RevealTextInput
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

      {/* Serving */}
      <View style={s.group}>
        <Text style={s.label}>Amount</Text>
        <View style={s.unitRow} accessibilityRole="radiogroup">
          {SERVING_UNITS.map((u) => {
            const active = u === servingUnit;
            return (
              <Pressable
                key={u}
                style={[s.unitChip, active && s.unitChipActive]}
                onPress={() => handleUnitChange(u)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={u === 'serving' ? 'Servings' : u}
              >
                <Text style={[s.unitText, active && s.unitTextActive]}>{u === 'serving' ? 'Servings' : u}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.row}>
          <NumberField
            label={servingUnit === 'serving' ? 'Servings' : 'How many'}
            unit={servingUnit === 'serving' ? undefined : '×'}
            value={count}
            onChangeText={setCount}
            onSubmitEditing={() => calRef.current?.focus()}
          />
          {servingUnit !== 'serving' && (
            <NumberField
              label="One serving is"
              unit={servingUnit}
              value={amount}
              onChangeText={setAmount}
              onSubmitEditing={() => calRef.current?.focus()}
            />
          )}
        </View>
        <Text style={s.hint}>
          Enter calories and macros for one {servingUnit === 'serving' ? 'serving' : `${amount || DEFAULT_AMOUNT[servingUnit]} ${servingUnit}`}
          {multiplier > 1 ? `; they're multiplied by ${multiplier}.` : '.'}
        </Text>
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
                <RevealTextInput
                  style={s.microInput}
                  value={microValues[g.key] || ''}
                  onChangeText={(v) => handleMicroChange(g.key, sanitizeDecimal(v))}
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
    unitRow: {
      flexDirection: 'row',
      gap: sw(6),
    },
    unitChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: sw(8),
      borderRadius: sw(10),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    unitChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    unitText: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    unitTextActive: {
      color: colors.textOnAccent,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
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

export default React.memo(QuickAddModal);
