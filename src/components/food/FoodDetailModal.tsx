import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  StyleSheet,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { lookupBarcodeUSDA } from '../../utils/barcodeApi';
import type { MealConfig } from '../../stores/useFoodLogStore';

/* ─── Types ────────────────────────────────────────────── */

export interface FoodDetailData {
  name: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  serving_size: number;
  serving_unit: string;
  confidence?: string;
  barcode?: string;
  serving_size_estimated?: boolean;
  vitamin_a?: number | null;
  vitamin_c?: number | null;
  vitamin_d?: number | null;
  vitamin_e?: number | null;
  vitamin_k?: number | null;
  vitamin_b6?: number | null;
  vitamin_b12?: number | null;
  folate?: number | null;
  calcium?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  potassium?: number | null;
  zinc?: number | null;
  sodium?: number | null;
}

/** Data returned by onAddToMeal — per-serving macros + quantity */
export interface MealItemData {
  name: string;
  brand?: string | null;
  food_catalog_id?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  serving_size: number;
  serving_unit: string;
  quantity: number;
}

interface Props {
  visible: boolean;
  food: FoodDetailData | null;
  initialMealSlot: string;
  initialIsPlanned: boolean;
  targetHour?: number;
  onDismiss: () => void;
  onAdded: () => void;
  editEntryId?: string;
  onDelete?: (id: string) => void;
  onFoodSwap?: (food: FoodDetailData) => void;
  /** When set, "Add" button adds to meal instead of logging. Hides meal/date selectors. */
  onAddToMeal?: (item: MealItemData) => void;
}

/* ─── Animation configs (hoisted — zero allocation in worklets) */

const FADE_IN = { duration: 200, easing: Easing.out(Easing.cubic) };
const FADE_OUT = { duration: 150, easing: Easing.in(Easing.cubic) };

/* ─── Static data ──────────────────────────────────────── */

const STATUS_H = StatusBar.currentHeight ?? 0;

const MICROS: { key: string; label: string; unit: string }[] = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'calcium', label: 'Calcium', unit: 'mg' },
  { key: 'iron', label: 'Iron', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'vitamin_a', label: 'Vitamin A', unit: 'mcg' },
  { key: 'vitamin_c', label: 'Vitamin C', unit: 'mg' },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'mcg' },
  { key: 'vitamin_e', label: 'Vitamin E', unit: 'mg' },
  { key: 'vitamin_k', label: 'Vitamin K', unit: 'mcg' },
  { key: 'vitamin_b6', label: 'Vitamin B6', unit: 'mg' },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'mcg' },
  { key: 'folate', label: 'Folate', unit: 'mcg' },
];

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DATE_CHIPS = (() => {
  const chips: { date: string; label: string; sub: string }[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    chips.push({
      date: toDateString(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : days[d.getDay()],
      sub: `${months[d.getMonth()]} ${d.getDate()}`,
    });
  }
  return chips;
})();

const TYPE_OPTIONS: { key: 'log' | 'planned'; label: string; icon: string }[] = [
  { key: 'log', label: 'Log Now', icon: 'add-circle-outline' },
  { key: 'planned', label: 'Planned', icon: 'calendar-outline' },
];

/* ─── Extracted memo sections ──────────────────────────── */

const NameBadge = React.memo(function NameBadge({
  name, brand, confidence, s, colors,
}: {
  name: string; brand?: string | null; confidence?: string;
  s: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  return (
    <View style={s.nameSection}>
      <Text style={s.foodName}>{name}</Text>
      {brand ? <Text style={s.foodBrand}>{brand}</Text> : null}
      {confidence === 'verified' && (
        <View style={s.badge}>
          <Ionicons name="checkmark-circle" size={ms(11)} color={colors.accentGreen} />
          <Text style={[s.badgeText, { color: colors.accentGreen }]}>Verified</Text>
        </View>
      )}
      {confidence === 'user_submitted' && (
        <View style={[s.badge, { backgroundColor: colors.textTertiary + '18' }]}>
          <Ionicons name="person-outline" size={ms(11)} color={colors.textTertiary} />
          <Text style={[s.badgeText, { color: colors.textTertiary }]}>Unverified</Text>
        </View>
      )}
    </View>
  );
});

const MacroChip = React.memo(function MacroChip({
  label, value, color, s,
}: { label: string; value: number; color: string; s: ReturnType<typeof createStyles> }) {
  return (
    <View style={s.macroChip}>
      <View style={[s.macroIndicator, { backgroundColor: color }]} />
      <View style={s.macroChipInner}>
        <Text style={[s.macroChipVal, { color }]}>{value}g</Text>
        <Text style={s.macroChipLabel}>{label}</Text>
      </View>
    </View>
  );
});

const DateChipItem = React.memo(function DateChipItem({
  chip, active, onPress, s,
}: {
  chip: typeof DATE_CHIPS[number]; active: boolean;
  onPress: (date: string) => void;
  s: ReturnType<typeof createStyles>;
}) {
  const handlePress = useCallback(() => onPress(chip.date), [chip.date, onPress]);
  return (
    <Pressable style={[s.dateChip, active && s.dateChipActive]} onPress={handlePress}>
      <Text style={[s.dateChipLabel, active && s.dateChipLabelActive]}>{chip.label}</Text>
      <Text style={[s.dateChipSub, active && s.dateChipSubActive]}>{chip.sub}</Text>
    </Pressable>
  );
});

const MicroRow = React.memo(function MicroRow({
  label, value, unit, last, s,
}: { label: string; value: number; unit: string; last: boolean; s: ReturnType<typeof createStyles> }) {
  return (
    <View style={[s.microRow, last && s.microRowLast]}>
      <Text style={s.microLabel}>{label}</Text>
      <Text style={s.microVal}>{value} {unit}</Text>
    </View>
  );
});

/* ─── Dropdown components ──────────────────────────────── */

const DropdownTrigger = React.memo(function DropdownTrigger({
  icon, label, isOpen, isGreen, onPress, s, colors,
}: {
  icon: string; label: string; isOpen: boolean; isGreen: boolean;
  onPress: () => void; s: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [isOpen]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));

  const bgColor = isGreen
    ? colors.accentGreen + '15'
    : isOpen
      ? colors.surface
      : colors.card;
  const textColor = isGreen ? colors.accentGreen : colors.textPrimary;

  return (
    <Pressable
      style={[s.dropTrigger, { backgroundColor: bgColor }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={ms(14)} color={textColor} />
      <Text style={[s.dropTriggerLabel, { color: textColor }]} numberOfLines={1}>{label}</Text>
      <Animated.View style={chevronStyle}>
        <Ionicons name="chevron-down" size={ms(14)} color={colors.textTertiary} />
      </Animated.View>
    </Pressable>
  );
});

const DropdownPanel = React.memo(function DropdownPanel({
  isOpen, children,
}: {
  isOpen: boolean; children: React.ReactNode;
}) {
  const [contentHeight, setContentHeight] = useState(0);
  const animHeight = useSharedValue(0);
  const animOpacity = useSharedValue(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContentHeight(h);
  }, []);

  useEffect(() => {
    if (isOpen && contentHeight > 0) {
      animHeight.value = withSpring(contentHeight, { damping: 22, stiffness: 280, mass: 0.5 });
      animOpacity.value = withTiming(1, { duration: 180 });
    } else {
      animHeight.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) });
      animOpacity.value = withTiming(0, { duration: 120 });
    }
  }, [isOpen, contentHeight]);

  const wrapStyle = useAnimatedStyle(() => ({
    height: animHeight.value,
    opacity: animOpacity.value,
  }));

  return (
    <Animated.View style={[panelStyles.wrap, wrapStyle]}>
      <View style={panelStyles.inner} onLayout={handleLayout}>
        {children}
      </View>
    </Animated.View>
  );
});

const panelStyles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  inner: { position: 'absolute', width: '100%' },
});

const DropdownOption = React.memo(function DropdownOption({
  icon, label, active, onPress, s, colors,
}: {
  icon: string; label: string; active: boolean;
  onPress: () => void; s: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  return (
    <Pressable
      style={[s.dropOption, active && { backgroundColor: colors.accent + '12' }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={ms(16)} color={active ? colors.accent : colors.textSecondary} />
      <Text style={[s.dropOptionLabel, active && { color: colors.accent }]}>{label}</Text>
      {active && <Ionicons name="checkmark" size={ms(16)} color={colors.accent} />}
    </Pressable>
  );
});

const SelectorRow = React.memo(function SelectorRow({
  mealConfigs, mealSlot, isPlanned,
  onMealSelect, onTypeSelect, s, colors,
}: {
  mealConfigs: MealConfig[]; mealSlot: string; isPlanned: boolean;
  onMealSelect: (slot: string) => void; onTypeSelect: (planned: boolean) => void;
  s: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  const [openDropdown, setOpenDropdown] = useState<'meal' | 'type' | null>(null);

  const activeMealLabel = useMemo(
    () => mealConfigs.find((mc) => mc.slot === mealSlot)?.label ?? 'Meal',
    [mealConfigs, mealSlot],
  );
  const activeMealIcon = useMemo(
    () => mealConfigs.find((mc) => mc.slot === mealSlot)?.icon ?? 'restaurant-outline',
    [mealConfigs, mealSlot],
  );

  const toggleMeal = useCallback(() => {
    setOpenDropdown((prev) => (prev === 'meal' ? null : 'meal'));
  }, []);
  const toggleType = useCallback(() => {
    setOpenDropdown((prev) => (prev === 'type' ? null : 'type'));
  }, []);

  const handleMealPick = useCallback((slot: string) => {
    onMealSelect(slot);
    setOpenDropdown(null);
  }, [onMealSelect]);

  const handleTypePick = useCallback((planned: boolean) => {
    onTypeSelect(planned);
    setOpenDropdown(null);
  }, [onTypeSelect]);

  const mealCallbacks = useMemo(
    () => mealConfigs.map((mc) => () => handleMealPick(mc.slot)),
    [mealConfigs, handleMealPick],
  );

  const pickLogNow = useCallback(() => handleTypePick(false), [handleTypePick]);
  const pickPlanned = useCallback(() => handleTypePick(true), [handleTypePick]);

  return (
    <View style={s.selectorContainer}>
      <View style={s.selectorRow}>
        <DropdownTrigger
          icon={activeMealIcon}
          label={activeMealLabel}
          isOpen={openDropdown === 'meal'}
          isGreen={false}
          onPress={toggleMeal}
          s={s} colors={colors}
        />
        <DropdownTrigger
          icon={isPlanned ? 'calendar-outline' : 'add-circle-outline'}
          label={isPlanned ? 'Planned' : 'Log Now'}
          isOpen={openDropdown === 'type'}
          isGreen={isPlanned}
          onPress={toggleType}
          s={s} colors={colors}
        />
      </View>

      <DropdownPanel isOpen={openDropdown === 'meal'}>
        <View style={s.dropPanel}>
          {mealConfigs.map((mc, i) => (
            <DropdownOption
              key={mc.slot}
              icon={mc.icon}
              label={mc.label}
              active={mealSlot === mc.slot}
              onPress={mealCallbacks[i]}
              s={s} colors={colors}
            />
          ))}
        </View>
      </DropdownPanel>

      <DropdownPanel isOpen={openDropdown === 'type'}>
        <View style={s.dropPanel}>
          <DropdownOption
            icon={TYPE_OPTIONS[0].icon}
            label={TYPE_OPTIONS[0].label}
            active={!isPlanned}
            onPress={pickLogNow}
            s={s} colors={colors}
          />
          <DropdownOption
            icon={TYPE_OPTIONS[1].icon}
            label={TYPE_OPTIONS[1].label}
            active={isPlanned}
            onPress={pickPlanned}
            s={s} colors={colors}
          />
        </View>
      </DropdownPanel>
    </View>
  );
});

const DateSection = React.memo(function DateSection({
  isPlanned, targetDate, onDateSelect, s,
}: {
  isPlanned: boolean; targetDate: string;
  onDateSelect: (date: string) => void;
  s: ReturnType<typeof createStyles>;
}) {
  return (
    <DropdownPanel isOpen={isPlanned}>
      <View style={s.dateSectionWrap}>
        <Text style={s.secTitle}>Date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateRow}
        >
          {DATE_CHIPS.map((chip) => (
            <DateChipItem
              key={chip.date} chip={chip}
              active={targetDate === chip.date}
              onPress={onDateSelect} s={s}
            />
          ))}
        </ScrollView>
      </View>
    </DropdownPanel>
  );
});

/* ─── Main component ───────────────────────────────────── */

export default function FoodDetailModal({
  visible, food, initialMealSlot, initialIsPlanned,
  targetHour, onDismiss, onAdded, editEntryId, onDelete, onFoodSwap,
  onAddToMeal,
}: Props) {
  const isMealMode = !!onAddToMeal;
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  /* ── Retain last food so exit animation renders content ── */
  const foodRef = useRef(food);
  if (food) foodRef.current = food;
  const displayFood = foodRef.current;

  /* ── Fade + scale animation (pure UI-thread) ──────────── */
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible && food ? 1 : 0, visible && food ? FADE_IN : FADE_OUT);
  }, [visible, !!food]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  /* ── Store ─────────────────────────────────────────── */
  const mealConfigs = useFoodLogStore((st) => st.mealConfigs);
  const addEntry = useFoodLogStore((st) => st.addEntry);
  const updateEntry = useFoodLogStore((st) => st.updateEntry);
  const userId = useAuthStore((st) => st.user?.id);
  const selectedDate = useFoodLogStore((st) => st.selectedDate);

  /* ── State ─────────────────────────────────────────── */
  const [mealSlot, setMealSlot] = useState(initialMealSlot);
  const [quantity, setQuantity] = useState('1');
  const [servingSize, setServingSize] = useState('');
  const [isPlanned, setIsPlanned] = useState(initialIsPlanned);
  const [targetDate, setTargetDate] = useState(selectedDate);
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

  /* ── Focus pop animations ───────────────────────── */
  const nameScale = useSharedValue(1);
  const calScale = useSharedValue(1);
  const proScale = useSharedValue(1);
  const carbScale = useSharedValue(1);
  const fatScale = useSharedValue(1);

  const popIn = useCallback((sv: typeof calScale) => () => {
    sv.value = withSpring(1.08, { damping: 12, stiffness: 400, mass: 0.4 });
  }, []);
  const popOut = useCallback((sv: typeof calScale) => () => {
    sv.value = withSpring(1, { damping: 14, stiffness: 300, mass: 0.4 });
  }, []);

  const namePopStyle = useAnimatedStyle(() => ({ transform: [{ scale: nameScale.value }] }));
  const calPopStyle = useAnimatedStyle(() => ({ transform: [{ scale: calScale.value }] }));
  const proPopStyle = useAnimatedStyle(() => ({ transform: [{ scale: proScale.value }] }));
  const carbPopStyle = useAnimatedStyle(() => ({ transform: [{ scale: carbScale.value }] }));
  const fatPopStyle = useAnimatedStyle(() => ({ transform: [{ scale: fatScale.value }] }));

  /* ── Reset ─────────────────────────────────────────── */
  useEffect(() => {
    if (food) {
      setMealSlot(initialMealSlot);
      setQuantity('1');
      setServingSize(String(food.serving_size));
      setIsPlanned(initialIsPlanned);
      setTargetDate(selectedDate);
      setAltSource('off');
      setAltLoading(false);
      setCustomName(food.name);
      setCustomBrand(food.brand || '');
      setCustomCal(String(Math.round(food.calories)));
      setCustomPro(String(Math.round(food.protein * 10) / 10));
      setCustomCarb(String(Math.round(food.carbs * 10) / 10));
      setCustomFat(String(Math.round(food.fat * 10) / 10));
      macroManualRef.current = false;
    }
  }, [food, initialMealSlot, initialIsPlanned]);

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
    setCustomCal(String(Math.round(food.calories * scale)));
    setCustomPro(String(Math.round(food.protein * scale * 10) / 10));
    setCustomCarb(String(Math.round(food.carbs * scale * 10) / 10));
    setCustomFat(String(Math.round(food.fat * scale * 10) / 10));
  }, [food, scale]);

  const scaled = useMemo(() => ({
    cal: Number(customCal) || 0,
    pro: Number(customPro) || 0,
    carb: Number(customCarb) || 0,
    fat: Number(customFat) || 0,
  }), [customCal, customPro, customCarb, customFat]);

  const handleMacroEdit = useCallback((setter: (v: string) => void) => (val: string) => {
    macroManualRef.current = true;
    setter(val);
  }, []);

  const microData = useMemo(() => {
    if (!food) return [];
    return MICROS
      .filter((m) => { const v = (food as any)[m.key]; return v != null && v > 0; })
      .map((m) => ({
        key: m.key,
        label: m.label,
        unit: m.unit,
        value: Math.round(((food as any)[m.key] as number) * scale * 10) / 10,
      }));
  }, [food, scale]);

  /* ── Stable callbacks ──────────────────────────────── */
  const handleTypeSelect = useCallback((planned: boolean) => setIsPlanned(planned), []);

  const handleAdd = useCallback(() => {
    if (!food) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const qty = Number(quantity) || 1;
    const ss = Number(servingSize) || food.serving_size;

    // Meal mode — return per-serving data instead of logging
    if (onAddToMeal) {
      onAddToMeal({
        name: customName.trim() || food.name,
        brand: customBrand.trim() || food.brand,
        food_catalog_id: food.food_catalog_id,
        calories: Math.round(scaled.cal / qty * 10) / 10,
        protein: Math.round(scaled.pro / qty * 10) / 10,
        carbs: Math.round(scaled.carb / qty * 10) / 10,
        fat: Math.round(scaled.fat / qty * 10) / 10,
        fiber: food.fiber != null ? Math.round(food.fiber * (ss / food.serving_size) * 10) / 10 : null,
        sugar: food.sugar != null ? Math.round(food.sugar * (ss / food.serving_size) * 10) / 10 : null,
        serving_size: ss,
        serving_unit: food.serving_unit,
        quantity: qty,
      });
      return;
    }

    if (!userId) return;
    const data = {
      name: customName.trim() || food.name, calories: scaled.cal, protein: scaled.pro,
      carbs: scaled.carb, fat: scaled.fat, meal_type: mealSlot,
      brand: customBrand.trim() || null, food_catalog_id: food.food_catalog_id,
      serving_size: ss, serving_unit: food.serving_unit, quantity: qty,
      fiber: food.fiber != null ? Math.round(food.fiber * scale * 10) / 10 : null,
      sugar: food.sugar != null ? Math.round(food.sugar * scale * 10) / 10 : null,
      is_planned: isPlanned,
    };
    if (editEntryId) { updateEntry(editEntryId, data); }
    else {
      let dateArg: string | undefined;
      if (isPlanned) dateArg = targetDate;
      else if (targetHour != null) dateArg = selectedDate;
      addEntry(userId, data, dateArg, targetHour);
    }
    onAdded();
  }, [userId, food, quantity, servingSize, mealSlot, isPlanned, targetDate, targetHour, selectedDate, scaled, scale, customName, customBrand, addEntry, updateEntry, editEntryId, onAdded, onAddToMeal]);

  const handleDelete = useCallback(() => {
    if (!editEntryId || !onDelete) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(editEntryId);
  }, [editEntryId, onDelete]);

  const btnLabel = useMemo(() => {
    if (isMealMode) return 'Add to Meal';
    if (editEntryId) return 'Update Entry';
    if (isPlanned) return `Plan for ${DATE_CHIPS.find((c) => c.date === targetDate)?.label || 'Today'}`;
    return 'Add to Log';
  }, [editEntryId, isPlanned, targetDate]);

  const btnIcon = editEntryId ? 'checkmark-circle-outline' as const
    : isPlanned ? 'calendar-outline' as const
    : 'add-circle-outline' as const;

  /* ── Render ────────────────────────────────────────── */
  if (!displayFood) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.overlay, animStyle]} collapsable={false}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={onDismiss} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={ms(20)} color={colors.textSecondary} />
          </Pressable>
          <Text style={s.headerTitle}>{editEntryId ? 'Edit Entry' : 'Add to Log'}</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scrollPad}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
        >
          {/* Name */}
          <Animated.View style={[s.nameSection, namePopStyle]}>
            <TextInput
              style={s.foodNameInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Food name"
              placeholderTextColor={colors.textTertiary + '50'}
              onFocus={popIn(nameScale)}
              onBlur={popOut(nameScale)}
              returnKeyType="next"
            />
            <TextInput
              style={s.foodBrandInput}
              value={customBrand}
              onChangeText={setCustomBrand}
              placeholder="Brand (optional)"
              placeholderTextColor={colors.textTertiary + '40'}
              onFocus={popIn(nameScale)}
              onBlur={popOut(nameScale)}
              returnKeyType="done"
            />
            {displayFood.confidence === 'verified' && (
              <View style={s.badge}>
                <Ionicons name="checkmark-circle" size={ms(11)} color={colors.accentGreen} />
                <Text style={[s.badgeText, { color: colors.accentGreen }]}>Verified</Text>
              </View>
            )}
            {displayFood.confidence === 'user_submitted' && (
              <View style={[s.badge, { backgroundColor: colors.textTertiary + '18' }]}>
                <Ionicons name="person-outline" size={ms(11)} color={colors.textTertiary} />
                <Text style={[s.badgeText, { color: colors.textTertiary }]}>Unverified</Text>
              </View>
            )}
          </Animated.View>

          {/* Alt source */}
          {displayFood.barcode && onFoodSwap && (
            <Pressable style={s.altBtn} onPress={handleAltSource} disabled={altLoading}>
              <Ionicons name="swap-horizontal" size={ms(14)} color={colors.accent} />
              <Text style={s.altBtnText}>
                {altLoading ? 'Loading...' : altSource === 'off' ? 'Try USDA data' : 'Switch to Open Food Facts'}
              </Text>
            </Pressable>
          )}

          {/* Calories */}
          <Animated.View style={[s.calRow, calPopStyle]}>
            <TextInput
              style={s.calNum}
              value={customCal}
              onChangeText={handleMacroEdit(setCustomCal)}
              keyboardType="numeric"
              onFocus={popIn(calScale)}
              onBlur={popOut(calScale)}
            />
            <Text style={s.calUnit}>kcal</Text>
          </Animated.View>

          {/* Macros */}
          <View style={s.macroRow}>
            <Animated.View style={[s.macroChip, proPopStyle]}>
              <View style={[s.macroIndicator, { backgroundColor: colors.protein }]} />
              <View style={s.macroChipInner}>
                <TextInput
                  style={[s.macroChipInput, { color: colors.protein }]}
                  value={customPro}
                  onChangeText={handleMacroEdit(setCustomPro)}
                  keyboardType="numeric"
                      onFocus={popIn(proScale)}
                  onBlur={popOut(proScale)}
                />
                <Text style={s.macroChipLabel}>Protein</Text>
              </View>
            </Animated.View>
            <Animated.View style={[s.macroChip, carbPopStyle]}>
              <View style={[s.macroIndicator, { backgroundColor: colors.carbs }]} />
              <View style={s.macroChipInner}>
                <TextInput
                  style={[s.macroChipInput, { color: colors.carbs }]}
                  value={customCarb}
                  onChangeText={handleMacroEdit(setCustomCarb)}
                  keyboardType="numeric"
                      onFocus={popIn(carbScale)}
                  onBlur={popOut(carbScale)}
                />
                <Text style={s.macroChipLabel}>Carbs</Text>
              </View>
            </Animated.View>
            <Animated.View style={[s.macroChip, fatPopStyle]}>
              <View style={[s.macroIndicator, { backgroundColor: colors.fat }]} />
              <View style={s.macroChipInner}>
                <TextInput
                  style={[s.macroChipInput, { color: colors.fat }]}
                  value={customFat}
                  onChangeText={handleMacroEdit(setCustomFat)}
                  keyboardType="numeric"
                      onFocus={popIn(fatScale)}
                  onBlur={popOut(fatScale)}
                />
                <Text style={s.macroChipLabel}>Fat</Text>
              </View>
            </Animated.View>
          </View>

          {/* Serving */}
          <Text style={s.secTitle}>Serving</Text>
          {displayFood.serving_size_estimated && (
            <View style={s.warnBanner}>
              <Ionicons name="alert-circle-outline" size={ms(14)} color={colors.accentOrange} />
              <Text style={s.warnText}>Enter the serving size from the label</Text>
            </View>
          )}
          <View style={s.servRow}>
            <View style={s.servField}>
              <Text style={s.servLabel}>Qty</Text>
              <TextInput
                style={s.servInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />
            </View>
            <Text style={s.servX}>{'\u00D7'}</Text>
            <View style={s.servField}>
              <Text style={s.servLabel}>{displayFood.serving_unit}</Text>
              <TextInput
                style={[s.servInput, displayFood.serving_size_estimated && s.servInputWarn]}
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Selector Row (Meal + Type dropdowns) — hidden in meal mode */}
          {!editEntryId && !isMealMode && (
            <SelectorRow
              mealConfigs={mealConfigs}
              mealSlot={mealSlot}
              isPlanned={isPlanned}
              onMealSelect={setMealSlot}
              onTypeSelect={handleTypeSelect}
              s={s} colors={colors}
            />
          )}

          {/* Date chips — visible when Planned, hidden in meal mode */}
          {!editEntryId && !isMealMode && (
            <DateSection
              isPlanned={isPlanned}
              targetDate={targetDate}
              onDateSelect={setTargetDate}
              s={s}
            />
          )}

          {/* Micros */}
          {microData.length > 0 && (
            <>
              <Text style={s.secTitle}>Micronutrients</Text>
              <View style={s.microCard}>
                {microData.map((m, i) => (
                  <MicroRow
                    key={m.key} label={m.label} value={m.value}
                    unit={m.unit} last={i === microData.length - 1} s={s}
                  />
                ))}
              </View>
            </>
          )}

          <View style={s.bottomSpacer} />
        </ScrollView>

        {/* Bottom bar */}
        <View style={s.bottomBar}>
          {editEntryId && onDelete && (
            <Pressable style={s.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={ms(20)} color={colors.accentRed} />
            </Pressable>
          )}
          <Pressable
            style={[s.addBtn, isPlanned && !editEntryId && s.addBtnPlanned]}
            onPress={handleAdd}
          >
            <Ionicons name={btnIcon} size={ms(20)} color={colors.textOnAccent} />
            <Text style={s.addBtnText}>{btnLabel}</Text>
            <Text style={s.addBtnCal}>{scaled.cal} cal</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (c: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.background,
    paddingTop: Platform.OS === 'android' ? STATUS_H + sw(8) : sw(60),
  },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: sw(12), marginBottom: sw(8) },
  backBtn: {
    width: sw(36), height: sw(36), borderRadius: sw(12),
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, color: c.textPrimary, fontSize: ms(18), lineHeight: ms(24),
    fontFamily: Fonts.bold, textAlign: 'center', letterSpacing: -0.3,
  },
  headerSpacer: { width: sw(36) },

  scrollPad: { paddingHorizontal: sw(20) },

  /* Name */
  nameSection: { alignItems: 'center', gap: sw(4), marginBottom: sw(12) },
  foodName: {
    color: c.textPrimary, fontSize: ms(20), lineHeight: ms(26),
    fontFamily: Fonts.extraBold, textAlign: 'center', letterSpacing: -0.3,
  },
  foodNameInput: {
    color: c.textPrimary, fontSize: ms(20), lineHeight: ms(26),
    fontFamily: Fonts.extraBold, textAlign: 'center', letterSpacing: -0.3,
    padding: 0, width: '100%',
  },
  foodBrand: { color: c.textSecondary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.medium },
  foodBrandInput: {
    color: c.textSecondary, fontSize: ms(13), lineHeight: ms(18),
    fontFamily: Fonts.medium, textAlign: 'center', padding: 0, width: '100%',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: sw(4),
    backgroundColor: c.accentGreen + '15', borderRadius: sw(8),
    paddingHorizontal: sw(8), paddingVertical: sw(3),
  },
  badgeText: { fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.bold },

  altBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    gap: sw(6), paddingHorizontal: sw(12), paddingVertical: sw(6),
    borderRadius: sw(8), backgroundColor: c.accent + '12', marginBottom: sw(12),
  },
  altBtnText: { color: c.accent, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium },

  /* Calories */
  calRow: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'center', gap: sw(6), marginBottom: sw(12),
  },
  calNum: {
    color: c.textPrimary, fontSize: ms(42), lineHeight: ms(48),
    fontFamily: Fonts.extraBold, letterSpacing: -1,
    padding: 0, textAlign: 'center', minWidth: sw(80),
  },
  calUnit: { color: c.textTertiary, fontSize: ms(14), lineHeight: ms(20), fontFamily: Fonts.semiBold },

  /* Macros */
  macroRow: { flexDirection: 'row', gap: sw(8), marginBottom: sw(20) },
  macroChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: sw(8),
    backgroundColor: c.card, borderRadius: sw(12),
    paddingVertical: sw(10), paddingHorizontal: sw(10),
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.surface,
  },
  macroIndicator: { width: sw(4), height: sw(28), borderRadius: sw(2) },
  macroChipInner: { flex: 1 },
  macroChipVal: { fontSize: ms(15), lineHeight: ms(20), fontFamily: Fonts.bold },
  macroChipInput: {
    fontSize: ms(15), lineHeight: ms(20), fontFamily: Fonts.bold, padding: 0,
  },
  macroChipLabel: { color: c.textTertiary, fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.medium },

  /* Section titles */
  secTitle: {
    color: c.textSecondary, fontSize: ms(11), lineHeight: ms(15),
    fontFamily: Fonts.bold, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: sw(8), marginTop: sw(4),
  },

  /* Serving */
  servRow: { flexDirection: 'row', alignItems: 'center', gap: sw(10), marginBottom: sw(16) },
  servField: { flex: 1, gap: sw(4) },
  servLabel: {
    color: c.textTertiary, fontSize: ms(10), lineHeight: ms(14),
    fontFamily: Fonts.semiBold, textAlign: 'center',
  },
  servInput: {
    backgroundColor: c.card, borderRadius: sw(12),
    paddingHorizontal: sw(14), paddingVertical: sw(12),
    color: c.textPrimary, fontSize: ms(16), lineHeight: ms(22),
    fontFamily: Fonts.bold, textAlign: 'center',
  },
  servInputWarn: { borderWidth: 1.5, borderColor: c.accentOrange },
  servX: {
    color: c.textTertiary, fontSize: ms(16), lineHeight: ms(22),
    fontFamily: Fonts.semiBold, marginTop: sw(16),
  },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: sw(6),
    backgroundColor: c.accentOrange + '15', borderRadius: sw(8),
    paddingHorizontal: sw(10), paddingVertical: sw(8), marginBottom: sw(10),
  },
  warnText: {
    flex: 1, color: c.accentOrange, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.semiBold,
  },

  /* Selector row */
  selectorContainer: { marginBottom: sw(8) },
  selectorRow: { flexDirection: 'row', gap: sw(8), marginBottom: sw(4) },

  /* Dropdown trigger */
  dropTrigger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: sw(6),
    paddingHorizontal: sw(12), paddingVertical: sw(10),
    borderRadius: sw(10), backgroundColor: c.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.surface,
  },
  dropTriggerLabel: {
    flex: 1, color: c.textPrimary, fontSize: ms(13), lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },

  /* Dropdown panel */
  dropPanel: {
    backgroundColor: c.card, borderRadius: sw(10),
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.surface,
    marginTop: sw(4), paddingVertical: sw(2),
  },

  /* Dropdown option */
  dropOption: {
    flexDirection: 'row', alignItems: 'center', gap: sw(10),
    paddingHorizontal: sw(12), paddingVertical: sw(10),
    borderRadius: sw(8), marginHorizontal: sw(4), marginVertical: sw(1),
  },
  dropOptionLabel: {
    flex: 1, color: c.textPrimary, fontSize: ms(13), lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },

  /* Date section wrapper */
  dateSectionWrap: { paddingBottom: sw(4) },

  /* Date chips */
  dateRow: { gap: sw(8), paddingRight: sw(4), marginBottom: sw(8) },
  dateChip: {
    alignItems: 'center', paddingHorizontal: sw(14), paddingVertical: sw(10),
    borderRadius: sw(12), backgroundColor: c.card, minWidth: sw(60),
  },
  dateChipActive: { backgroundColor: c.accentGreen },
  dateChipLabel: { color: c.textPrimary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.bold },
  dateChipLabelActive: { color: c.textOnAccent },
  dateChipSub: { color: c.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, marginTop: sw(2) },
  dateChipSubActive: { color: 'rgba(255,255,255,0.7)' },

  /* Micros */
  microCard: { backgroundColor: c.card, borderRadius: sw(14), paddingVertical: sw(4), paddingHorizontal: sw(14) },
  microRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: sw(9), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.surface,
  },
  microRowLast: { borderBottomWidth: 0 },
  microLabel: { color: c.textSecondary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.medium },
  microVal: { color: c.textPrimary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.semiBold },

  bottomSpacer: { height: sw(80) },

  /* Bottom bar */
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: sw(20), paddingVertical: sw(12), paddingBottom: sw(16),
    gap: sw(10), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.surface,
  },
  deleteBtn: {
    width: sw(52), height: sw(52), borderRadius: sw(14),
    backgroundColor: c.accentRed + '15', alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    flex: 1, flexDirection: 'row', backgroundColor: c.accent,
    borderRadius: sw(14), paddingVertical: sw(16),
    alignItems: 'center', justifyContent: 'center', gap: sw(8),
  },
  addBtnPlanned: { backgroundColor: c.accentGreen },
  addBtnText: { color: c.textOnAccent, fontSize: ms(16), lineHeight: ms(22), fontFamily: Fonts.bold },
  addBtnCal: { color: 'rgba(255,255,255,0.7)', fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.semiBold },
});
