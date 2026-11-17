import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { lookupBarcodeUSDA } from '../../utils/barcodeApi';
import { useNutrientGoalStore } from '../../stores/useNutrientGoalStore';
import { useThemeStore } from '../../stores/useThemeStore';
import FoodSubScreen from './ui/FoodSubScreen';
import PrimaryActionBar from './ui/PrimaryActionBar';
import NumberField from './ui/NumberField';
import MacroSplitBar from './MacroSplitBar';
import FoodLogOptions, { buildDateChips } from './FoodLogOptions';
import FoodNameCard from './FoodNameCard';
import MicroEditor from './MicroEditor';
import { findMealConfig } from './groupEntriesByMeal';

import { MICROS, type FoodDetailData, type MealItemData } from './foodDetailTypes';

export type { FoodDetailData, MealItemData } from './foodDetailTypes';

interface Props {
  visible: boolean;
  food: FoodDetailData | null;
  initialMealSlot: string;
  initialIsPlanned: boolean;
  /** Quantity to start from when editing an existing entry or meal item (default 1). */
  initialQuantity?: number;
  targetHour?: number;
  onDismiss: () => void;
  onAdded: () => void;
  /** For screen-level use: Android back only closes this while it returns true (e.g. tab focused). */
  isBackActive?: () => boolean;
  /** Space under the action button when the keyboard is closed (pass a small value above a tab bar). */
  bottomInset?: number;
  editEntryId?: string;
  onDelete?: (id: string) => void;
  onFoodSwap?: (food: FoodDetailData) => void;
  /** When set, "Add" button adds to meal instead of logging. Hides meal/date selectors. */
  onAddToMeal?: (item: MealItemData) => void;
}

/* ─── Main component ───────────────────────────────────── */

/**
 * Food detail: adjust serving, calories, macros and micros, then log it (now or planned),
 * update an existing entry, or (meal mode) return it to Make a meal.
 */
function FoodDetailModal({
  visible, food, initialMealSlot, initialIsPlanned, initialQuantity,
  targetHour, onDismiss, onAdded, isBackActive, bottomInset, editEntryId, onDelete, onFoodSwap,
  onAddToMeal,
}: Props) {
  const isMealMode = !!onAddToMeal;
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((st) => st.mode) === 'dark';

  /* ── Store ─────────────────────────────────────────── */
  const mealConfigs = useFoodLogStore((st) => st.mealConfigs);
  const addEntry = useFoodLogStore((st) => st.addEntry);
  const updateEntry = useFoodLogStore((st) => st.updateEntry);
  const userId = useAuthStore((st) => st.user?.id);
  const selectedDate = useFoodLogStore((st) => st.selectedDate);
  const microGoals = useNutrientGoalStore((st) => st.microGoals);

  /* ── State ─────────────────────────────────────────── */
  const [mealSlot, setMealSlot] = useState(initialMealSlot);
  const [quantity, setQuantity] = useState('1');
  const [servingSize, setServingSize] = useState('');
  const [isPlanned, setIsPlanned] = useState(initialIsPlanned);
  const [targetDate, setTargetDate] = useState(selectedDate);
  // Plan-ahead days, rebuilt each time the screen opens so "Today" stays right.
  const dateChips = useMemo(() => buildDateChips(), [visible]);
  const [altLoading, setAltLoading] = useState(false);
  const [altSource, setAltSource] = useState<'off' | 'usda'>('off');

  /* ── Editable name / brand ─────────────────────── */
  const [customName, setCustomName] = useState('');
  const [customBrand, setCustomBrand] = useState('');

  /* ── Editable macro overrides ────────────────────── */
  const [customCal, setCustomCal] = useState('');
  const [customPro, setCustomPro] = useState('');
  const [customCarb, setCustomCarb] = useState('');
  const [customFat, setCustomFat] = useState('');
  const macroManualRef = useRef(false);

  /* ── Energy unit toggle (kcal ↔ kJ) ────────────── */
  const [energyUnit, setEnergyUnit] = useState<'kcal' | 'kj'>('kcal');
  const [displayEnergy, setDisplayEnergy] = useState('');

  const handleToggleUnit = useCallback(() => {
    setEnergyUnit((prev) => {
      const next = prev === 'kcal' ? 'kj' : 'kcal';
      const n = Number(prev === 'kcal' ? customCal : displayEnergy);
      if (next === 'kj') {
        setDisplayEnergy(Number.isFinite(n) && n > 0 ? String(Math.round(n * 4.184)) : '');
      } else {
        // kj → kcal: convert displayEnergy back
        const kjVal = Number(displayEnergy);
        const kcal = Number.isFinite(kjVal) && kjVal > 0 ? Math.round(kjVal / 4.184) : 0;
        setCustomCal(kcal > 0 ? String(kcal) : '');
        macroManualRef.current = true;
      }
      return next;
    });
  }, [customCal, displayEnergy]);

  const handleEnergyChange = useCallback((v: string) => {
    macroManualRef.current = true;
    if (energyUnit === 'kcal') {
      setCustomCal(v);
    } else {
      setDisplayEnergy(v);
      const n = Number(v);
      setCustomCal(Number.isFinite(n) && n > 0 ? String(Math.round(n / 4.184)) : '');
    }
  }, [energyUnit]);

  /* ── Editable micro overrides ────────────────────── */
  const [customMicros, setCustomMicros] = useState<Record<string, string>>({});
  const microManualRef = useRef(false);

  /* ── Reset ─────────────────────────────────────────── */
  // Reset every time the screen opens, so reopening the same entry drops unsaved edits.
  useEffect(() => {
    if (food && visible) {
      // Fill the fields already scaled to the starting quantity: when the same entry is
      // reopened, neither `food` nor the scale changes, so the scale effect won't re-run.
      const q = initialQuantity && initialQuantity > 0 ? initialQuantity : 1;
      // When logging something new, use the user's own enabled meal slot (e.g. meal_1 "Breakfast")
      // if the caller passed a generic one. Editing keeps the entry's saved meal untouched.
      const enabledMeals = useFoodLogStore.getState().mealConfigs.filter((c) => c.enabled);
      setMealSlot(!editEntryId && !onAddToMeal
        ? findMealConfig(enabledMeals, initialMealSlot)?.slot ?? initialMealSlot
        : initialMealSlot);
      setQuantity(String(q));
      setServingSize(String(food.serving_size));
      setIsPlanned(initialIsPlanned);
      setTargetDate(selectedDate);
      setAltSource('off');
      setAltLoading(false);
      setCustomName(food.name);
      setCustomBrand(food.brand || '');
      setCustomCal(String(Math.round(food.calories * q)));
      setEnergyUnit('kcal');
      setDisplayEnergy('');
      setCustomPro(String(Math.round(food.protein * q * 10) / 10));
      setCustomCarb(String(Math.round(food.carbs * q * 10) / 10));
      setCustomFat(String(Math.round(food.fat * q * 10) / 10));
      macroManualRef.current = false;
      // Initialize micro overrides
      const initMicros: Record<string, string> = {};
      for (const m of MICROS) {
        const v = (food as any)[m.key];
        if (v != null) initMicros[m.key] = String(Math.round(Number(v) * q * 10) / 10);
      }
      setCustomMicros(initMicros);
      microManualRef.current = false;

    }
  }, [food, visible, initialMealSlot, initialIsPlanned, initialQuantity]);

  /* ── Alt source ────────────────────────────────────── */
  const handleAltSource = useCallback(async () => {
    if (!food?.barcode || !onFoodSwap) return;
    setAltLoading(true);
    try {
      if (altSource === 'off') {
        const { found, food: f } = await lookupBarcodeUSDA(food.barcode);
        if (found && f) { setAltSource('usda'); onFoodSwap(f); }
      } else {
        const { lookupBarcode } = await import('../../utils/barcodeApi');
        const { found, food: f } = await lookupBarcode(food.barcode);
        if (found && f) { setAltSource('off'); onFoodSwap(f); }
      }
    } catch { /* silent */ } finally { setAltLoading(false); }
  }, [food?.barcode, onFoodSwap, altSource]);

  /* ── Computed ──────────────────────────────────────── */
  const scale = useMemo(() => {
    if (!food) return 1;
    const qty = Number(quantity) || 1;
    const ss = Number(servingSize) || food.serving_size;
    return (qty * ss) / food.serving_size;
  }, [food, quantity, servingSize]);

  // Update macro fields when scale changes (unless user manually edited)
  useEffect(() => {
    if (!food || macroManualRef.current) return;
    const kcal = Math.round(food.calories * scale);
    setCustomCal(String(kcal));
    if (energyUnit === 'kj') setDisplayEnergy(String(Math.round(kcal * 4.184)));
    setCustomPro(String(Math.round(food.protein * scale * 10) / 10));
    setCustomCarb(String(Math.round(food.carbs * scale * 10) / 10));
    setCustomFat(String(Math.round(food.fat * scale * 10) / 10));
  }, [food, scale]);

  // Update micro fields when scale changes (unless user manually edited)
  useEffect(() => {
    if (!food || microManualRef.current) return;
    const updated: Record<string, string> = {};
    for (const m of MICROS) {
      const v = (food as any)[m.key];
      if (v != null) updated[m.key] = String(Math.round(Number(v) * scale * 10) / 10);
    }
    setCustomMicros(updated);
  }, [food, scale]);

  const scaled = useMemo(() => ({
    cal: Number(customCal) || 0,
    pro: Number(customPro) || 0,
    carb: Number(customCarb) || 0,
    fat: Number(customFat) || 0,
  }), [customCal, customPro, customCarb, customFat]);

  // Typing a macro by hand stops serving changes from overwriting it.
  const macroHandlers = useMemo(() => {
    const make = (setter: (v: string) => void) => (val: string) => {
      macroManualRef.current = true;
      setter(val);
    };
    return { pro: make(setCustomPro), carb: make(setCustomCarb), fat: make(setCustomFat) };
  }, []);

  const handleMicroChange = useCallback((key: string, val: string) => {
    microManualRef.current = true;
    setCustomMicros((prev) => ({ ...prev, [key]: val }));
  }, []);

  const microData = useMemo(() => {
    if (!food) return [];
    // When editing, show all tracked micros (from settings) so the user can add values
    // For new entries, only show micros that already have values on the food
    const trackedKeys = new Set(microGoals.map((g) => g.key));
    return MICROS
      .filter((m) => {
        const v = (food as any)[m.key];
        const hasValue = v != null && v > 0;
        const hasCustomValue = customMicros[m.key] != null && customMicros[m.key] !== '' && Number(customMicros[m.key]) > 0;
        return hasValue || hasCustomValue || trackedKeys.has(m.key);
      })
      .map((m) => ({
        key: m.key,
        label: m.label,
        unit: m.unit,
        value: customMicros[m.key] ?? ((food as any)[m.key] != null
          ? String(Math.round(((food as any)[m.key] as number) * scale * 10) / 10)
          : ''),
      }));
  }, [food, scale, customMicros, editEntryId, microGoals]);

  /* ── Stable callbacks ──────────────────────────────── */
  const handleTypeSelect = useCallback((planned: boolean) => setIsPlanned(planned), []);

  const handleAdd = useCallback(() => {
    if (!food) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const qty = Number(quantity) || 1;
    const ss = Number(servingSize) || food.serving_size;

    // Meal mode — return per-serving data instead of logging
    if (onAddToMeal) {
      // A typed fiber/sugar value is the total for this amount (like the log path); per serving = / qty
      const perServing = (key: 'fiber' | 'sugar'): number | null => {
        const typed = customMicros[key];
        if (typed != null && typed !== '') {
          const n = Number(typed);
          return Number.isFinite(n) ? Math.round((n / qty) * 10) / 10 : null;
        }
        const base = food[key];
        return base != null ? Math.round(base * (ss / food.serving_size) * 10) / 10 : null;
      };
      onAddToMeal({
        name: customName.trim() || food.name,
        brand: customBrand.trim() || food.brand,
        food_catalog_id: food.food_catalog_id,
        calories: Math.round(scaled.cal / qty * 10) / 10,
        protein: Math.round(scaled.pro / qty * 10) / 10,
        carbs: Math.round(scaled.carb / qty * 10) / 10,
        fat: Math.round(scaled.fat / qty * 10) / 10,
        fiber: perServing('fiber'),
        sugar: perServing('sugar'),
        serving_size: ss,
        serving_unit: food.serving_unit,
        quantity: qty,
      });
      return;
    }

    if (!userId) return;
    // Build micro fields from customMicros
    const microFields: Record<string, number | null> = {};
    for (const m of MICROS) {
      const v = customMicros[m.key];
      if (v != null && v !== '') {
        const n = Number(v);
        microFields[m.key] = Number.isFinite(n) ? n : null;
      } else {
        microFields[m.key] = (food as any)[m.key] != null ? Math.round(((food as any)[m.key] as number) * scale * 10) / 10 : null;
      }
    }
    const data = {
      name: customName.trim() || food.name, calories: scaled.cal, protein: scaled.pro,
      carbs: scaled.carb, fat: scaled.fat, meal_type: mealSlot,
      brand: customBrand.trim() || null, food_catalog_id: food.food_catalog_id,
      serving_size: ss, serving_unit: food.serving_unit, quantity: qty,
      fiber: microFields.fiber,
      sugar: microFields.sugar,
      is_planned: isPlanned,
      ...microFields,
    };
    if (editEntryId) { updateEntry(editEntryId, data); }
    else {
      let dateArg: string | undefined;
      if (isPlanned) dateArg = targetDate;
      else if (targetHour != null) dateArg = selectedDate;
      addEntry(userId, data, dateArg, targetHour);
    }
    onAdded();
  }, [userId, food, quantity, servingSize, mealSlot, isPlanned, targetDate, targetHour, selectedDate, scaled, scale, customName, customBrand, customMicros, addEntry, updateEntry, editEntryId, onAdded, onAddToMeal]);

  const handleDelete = useCallback(() => {
    if (!editEntryId || !onDelete) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(editEntryId);
  }, [editEntryId, onDelete]);

  const btnLabel = useMemo(() => {
    if (isMealMode) return 'Add to Meal';
    if (editEntryId) return 'Update Entry';
    if (isPlanned) return `Plan for ${dateChips.find((c) => c.date === targetDate)?.label || 'Today'}`;
    return 'Add to Log';
  }, [isMealMode, editEntryId, isPlanned, targetDate, dateChips]);

  const btnIcon = editEntryId ? 'checkmark-circle-outline' as const
    : isPlanned ? 'calendar-outline' as const
    : 'add-circle-outline' as const;

  /* ── Render ────────────────────────────────────────── */
  if (!food) return null;

  const title = isMealMode ? 'Add to meal' : editEntryId ? 'Edit food' : 'Add food';

  return (
    <FoodSubScreen
      visible={visible}
      title={title}
      onBack={onDismiss}
      isBackActive={isBackActive}
      bottomInset={bottomInset}
      footer={
        <PrimaryActionBar
          label={btnLabel}
          sublabel={`${scaled.cal} kcal`}
          icon={btnIcon}
          onPress={handleAdd}
          tone={isPlanned && !editEntryId && !isMealMode ? 'planned' : 'accent'}
          secondary={editEntryId && onDelete ? { icon: 'trash-outline', onPress: handleDelete, label: 'Delete entry', destructive: true } : undefined}
        />
      }
    >
      {/* Name, brand, source */}
      <FoodNameCard
        name={customName}
        onNameChange={setCustomName}
        brand={customBrand}
        onBrandChange={setCustomBrand}
        confidence={food.confidence}
        altSource={food.barcode && onFoodSwap ? altSource : null}
        altLoading={altLoading}
        onAltSource={handleAltSource}
      />

      {/* Energy */}
      <View style={[s.card, s.energyCard]}>
        <View style={s.energyRow}>
          <TextInput
            style={s.energyInput}
            value={energyUnit === 'kcal' ? customCal : displayEnergy}
            onChangeText={(v) => handleEnergyChange(v.replace(',', '.'))}
            keyboardType="numeric"
            keyboardAppearance={isDark ? 'dark' : 'light'}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={`Energy in ${energyUnit === 'kcal' ? 'calories' : 'kilojoules'}`}
          />
          <Pressable
            onPress={handleToggleUnit}
            hitSlop={10}
            style={s.unitPill}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${energyUnit === 'kcal' ? 'kilojoules' : 'calories'}`}
          >
            <Text style={s.unitText}>{energyUnit === 'kcal' ? 'kcal' : 'kJ'}</Text>
            <Ionicons name="swap-vertical" size={ms(11)} color={colors.textTertiary} />
          </Pressable>
        </View>
        <MacroSplitBar protein={scaled.pro} carbs={scaled.carb} fat={scaled.fat} showGrams={false} />
      </View>

      {/* Macros */}
      <View style={s.row}>
        <NumberField label="Protein" unit="g" accentColor={colors.protein} value={customPro} onChangeText={macroHandlers.pro} returnKeyType="done" blurOnSubmit />
        <NumberField label="Carbs" unit="g" accentColor={colors.carbs} value={customCarb} onChangeText={macroHandlers.carb} returnKeyType="done" blurOnSubmit />
        <NumberField label="Fat" unit="g" accentColor={colors.fat} value={customFat} onChangeText={macroHandlers.fat} returnKeyType="done" blurOnSubmit />
      </View>

      {/* Serving */}
      <View style={s.group}>
        <Text style={s.label}>Serving</Text>
        {food.serving_size_estimated && (
          <View style={s.warn}>
            <Ionicons name="alert-circle-outline" size={ms(15)} color={colors.accentOrange} />
            <Text style={s.warnText}>Serving size is a guess. Enter the one on the label.</Text>
          </View>
        )}
        <View style={s.row}>
          <NumberField label="Quantity" value={quantity} onChangeText={setQuantity} returnKeyType="done" blurOnSubmit />
          <View style={s.times}><Text style={s.timesText}>×</Text></View>
          <NumberField label="Serving size" unit={food.serving_unit} value={servingSize} onChangeText={setServingSize} returnKeyType="done" blurOnSubmit />
        </View>
      </View>

      {/* Meal + now/planned (not when editing or building a meal) */}
      {!editEntryId && !isMealMode && (
        <FoodLogOptions
          meals={mealConfigs}
          mealSlot={mealSlot}
          onMealSelect={setMealSlot}
          isPlanned={isPlanned}
          onPlannedChange={handleTypeSelect}
          dateChips={dateChips}
          targetDate={targetDate}
          onDateSelect={setTargetDate}
        />
      )}

      {/* Micronutrients */}
      <MicroEditor rows={microData} onChange={handleMicroChange} />
    </FoodSubScreen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: sw(14),
      borderRadius: sw(18),
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      gap: sw(6),
    },
    energyCard: {
      alignItems: 'stretch',
      gap: sw(12),
      paddingVertical: sw(16),
    },
    energyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
    },
    energyInput: {
      minWidth: sw(80),
      textAlign: 'center',
      color: c.textPrimary,
      fontSize: ms(40),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1,
      padding: 0,
    },
    unitPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
      borderRadius: sw(999),
      backgroundColor: c.surface,
    },
    unitText: {
      color: c.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
    row: {
      flexDirection: 'row',
      gap: sw(8),
      alignItems: 'stretch',
    },
    group: {
      gap: sw(8),
    },
    label: {
      color: c.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    warn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingHorizontal: sw(12),
      paddingVertical: sw(10),
      borderRadius: sw(12),
      backgroundColor: c.accentOrange + '1A',
      borderWidth: 1,
      borderColor: c.accentOrange + '40',
    },
    warnText: {
      flex: 1,
      color: c.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(17),
      fontFamily: Fonts.medium,
    },
    times: {
      justifyContent: 'center',
    },
    timesText: {
      color: c.textTertiary,
      fontSize: ms(16),
      fontFamily: Fonts.semiBold,
    },
  });

export default React.memo(FoodDetailModal);
