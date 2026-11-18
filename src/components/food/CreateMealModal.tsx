import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore, type FoodCatalogItem, type FoodEntry } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useSavedMealsStore, type MealItem, type SavedMeal } from '../../stores/useSavedMealsStore';
import FoodDetailModal from './FoodDetailModal';
import type { FoodDetailData, MealItemData } from './FoodDetailModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import QuickAddModal from './QuickAddModal';
import AddFoodActions from './AddFoodActions';
import MacroSplitBar from './MacroSplitBar';
import FoodSubScreen from './ui/FoodSubScreen';
import PrimaryActionBar from './ui/PrimaryActionBar';
import RevealTextInput from './ui/RevealTextInput';
import FoodRow from './ui/FoodRow';
import { catalogToDetail } from './foodMapping';
import { findMealConfig } from './groupEntriesByMeal';
import MealFoodPicker from './create-meal/MealFoodPicker';
import { useLogMeal } from './create-meal/useLogMeal';
import { entriesToMealItems, itemFromData, itemTotals, newItemId, updateItemFromData } from './create-meal/mealItems';

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
  /** For screen-level use: Android back only closes this while it returns true (e.g. tab focused). */
  isBackActive?: () => boolean;
  onLogged: () => void;
  initialMeal?: SavedMeal | null;
  /** When editing a logged meal group, pass the group ID */
  editMealGroupId?: string | null;
  /** When editing a logged meal group, pass the group's entries */
  editMealGroupEntries?: FoodEntry[] | null;
}

/* ─── Meal item row (memoized) ─────────────────────────── */

interface MealItemRowProps {
  item: MealItem;
  onPress: (item: MealItem) => void;
  onRemove: (id: string) => void;
  s: ReturnType<typeof createStyles>;
  c: ThemeColors;
}

const MealItemRow = React.memo(function MealItemRow({ item, onPress, onRemove, s, c }: MealItemRowProps) {
  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handleRemove = useCallback(() => onRemove(item.id), [item.id, onRemove]);
  const serving = `${Math.round(item.serving_size * 10) / 10} ${item.serving_unit} × ${item.quantity}`;
  return (
    <FoodRow
      name={item.name}
      subtitle={item.brand ? `${item.brand} · ${serving}` : serving}
      calories={item.calories * item.quantity}
      protein={item.protein * item.quantity}
      carbs={item.carbs * item.quantity}
      fat={item.fat * item.quantity}
      onPress={handlePress}
      accessibilityHint="Edit the amount or values"
      trailing={(
        <Pressable onPress={handleRemove} hitSlop={8} style={s.removeBtn} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`}>
          <Ionicons name="close" size={ms(14)} color={c.textTertiary} />
        </Pressable>
      )}
    />
  );
});

/* ─── Main component ───────────────────────────────────── */

/**
 * Make a meal: build a meal from searched, scanned or quick-added foods, then log it (one
 * meal group in the diary) and/or save it for later. Also edits a saved meal or a logged one.
 */
function CreateMealModal({
  visible, mealSlot, targetHour, onDismiss, isBackActive, onLogged, initialMeal,
  editMealGroupId, editMealGroupEntries,
}: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((st) => st.mode) === 'dark';

  const userId = useAuthStore((st) => st.user?.id);
  const mealLabel = useFoodLogStore((st) => findMealConfig(st.mealConfigs, mealSlot)?.label);
  const saveMeal = useSavedMealsStore((st) => st.saveMeal);
  const updateMeal = useSavedMealsStore((st) => st.updateMeal);

  /* ── The meal being built ───────────────────────────── */
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      // Closed (the Nutrition screen keeps this mounted): nothing stays open for next time.
      setDetailFood(null);
      setEditingItemId(null);
      setScannerVisible(false);
      setQuickAddVisible(false);
      setScanNotice(null);
      return;
    }
    if (editMealGroupEntries && editMealGroupEntries.length > 0) {
      setMealName(editMealGroupEntries[0].meal_group_name || '');
      setItems(entriesToMealItems(editMealGroupEntries));
      setEditingMealId(null);
    } else if (initialMeal) {
      setMealName(initialMeal.name);
      setItems([...initialMeal.items]);
      setEditingMealId(initialMeal.id);
    } else {
      setMealName('');
      setItems([]);
      setEditingMealId(null);
    }
  }, [visible, initialMeal, editMealGroupEntries]);

  /* ── Child screens ──────────────────────────────────── */
  const [detailFood, setDetailFood] = useState<FoodDetailData | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  /** Bumped after each add, so the search clears for the next food. */
  const [clearSignal, setClearSignal] = useState(0);

  const openDetail = useCallback((food: FoodDetailData, item?: MealItem) => {
    setEditingItemId(item?.id ?? null);
    setDetailQuantity(item?.quantity || 1);
    setDetailFood(food);
  }, []);

  const handleSelectFood = useCallback((item: FoodCatalogItem) => openDetail(catalogToDetail(item)), [openDetail]);

  const handleEditItem = useCallback((item: MealItem) => {
    openDetail({
      name: item.name,
      brand: item.brand,
      food_catalog_id: item.food_catalog_id,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      ...item.micros,
      serving_size: item.serving_size,
      serving_unit: item.serving_unit,
    }, item);
  }, [openDetail]);

  const handleDetailDismiss = useCallback(() => {
    setDetailFood(null);
    setEditingItemId(null);
  }, []);

  const addItem = useCallback((data: MealItemData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => [...prev, itemFromData(data)]);
    setClearSignal((n) => n + 1);
  }, []);

  const handleDetailAddToMeal = useCallback((data: MealItemData) => {
    if (editingItemId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setItems((prev) => prev.map((i) => (i.id === editingItemId ? updateItemFromData(i, data) : i)));
    } else {
      addItem(data);
    }
    handleDetailDismiss();
  }, [editingItemId, addItem, handleDetailDismiss]);

  /* ── Scan a barcode ─────────────────────────────────── */
  const handleOpenScanner = useCallback(() => { setScanNotice(null); setScannerVisible(true); }, []);
  const handleScanDismiss = useCallback(() => setScannerVisible(false), []);
  const handleScanFound = useCallback((food: FoodDetailData) => {
    setScannerVisible(false);
    openDetail(food);
  }, [openDetail]);
  const handleScanNotFound = useCallback((_barcode: string, failed?: boolean) => {
    setScannerVisible(false);
    setScanNotice(failed
      ? "Couldn't look up that barcode. Check your connection and try again."
      : 'Product not found. Search for it, or use Quick add.');
  }, []);

  /* ── Quick add ──────────────────────────────────────── */
  const handleOpenQuickAdd = useCallback(() => { setScanNotice(null); setQuickAddVisible(true); }, []);
  const handleQuickAddDismiss = useCallback(() => setQuickAddVisible(false), []);
  const handleQuickItem = useCallback((data: MealItemData) => {
    addItem(data);
    setQuickAddVisible(false);
  }, [addItem]);

  /* ── Saved meals and removing ───────────────────────── */
  const handleAddSavedMeal = useCallback((meal: SavedMeal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setItems((prev) => [...prev, ...meal.items.map((item) => ({ ...item, id: newItemId() }))]);
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const totals = useMemo(() => itemTotals(items), [items]);

  /* ── Save for later ─────────────────────────────────── */
  // Ignores a second tap while the first save runs, so a meal can't be saved twice.
  const savingRef = useRef(false);
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    const name = mealName.trim();
    if (!name) {
      Alert.alert('Meal Name', 'Please enter a name for your meal.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('No Items', 'Add at least one food item to your meal.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    savingRef.current = true;
    try {
      if (editingMealId) {
        await updateMeal(editingMealId, name, items);
      } else {
        setEditingMealId(await saveMeal(name, items));
      }
    } finally {
      savingRef.current = false;
    }
    Alert.alert('Saved', `"${name}" has been saved.`);
  }, [mealName, items, editingMealId, saveMeal, updateMeal]);

  /* ── Log ────────────────────────────────────────────── */
  const logMeal = useLogMeal({ userId, mealSlot, targetHour, editMealGroupId, editMealGroupEntries, onLogged });
  const handleLog = useCallback(() => { logMeal(items, mealName); }, [logMeal, items, mealName]);

  const isEditingGroup = !!editMealGroupId;
  const title = isEditingGroup ? 'Edit logged meal' : editingMealId ? 'Edit meal' : 'Make a meal';
  const itemCount = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

  const saveButton = useMemo(() => (
    <Pressable
      onPress={handleSave}
      hitSlop={8}
      style={({ pressed }) => [s.saveBtn, pressed && s.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Save meal for later"
    >
      <Ionicons name="bookmark-outline" size={ms(18)} color={colors.accent} />
    </Pressable>
  ), [handleSave, s, colors.accent]);

  return (
    <>
      <FoodSubScreen
        visible={visible}
        title={title}
        subtitle={mealLabel ? `to ${mealLabel}` : undefined}
        onBack={onDismiss}
        isBackActive={isBackActive}
        right={saveButton}
        footer={(
          <PrimaryActionBar
            label={isEditingGroup ? 'Update meal' : 'Log meal'}
            sublabel={items.length > 0 ? `${itemCount} · ${totals.calories} kcal` : undefined}
            icon="add-circle-outline"
            onPress={handleLog}
            disabled={items.length === 0}
          />
        )}
      >
        {/* The shared rows and search bar have their own side margins: let them use the full width. */}
        <View style={s.bleed}>
          <View style={s.padded}>
            <RevealTextInput
              style={s.nameInput}
              placeholder="Meal name (e.g. Chicken rice bowl)"
              placeholderTextColor={colors.textTertiary}
              value={mealName}
              onChangeText={setMealName}
              returnKeyType="done"
              keyboardAppearance={isDark ? 'dark' : 'light'}
              accessibilityLabel="Meal name"
            />
          </View>

          {items.length > 0 && (
            <View style={s.hero}>
              <Text style={s.heroNum}>
                {totals.calories.toLocaleString()}
                <Text style={s.heroUnit}> kcal</Text>
              </Text>
              <View style={s.heroBar}>
                <MacroSplitBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
              </View>
            </View>
          )}

          <Text style={[s.label, s.padded]}>Items ({items.length})</Text>
          {items.length === 0 ? (
            <View style={s.emptyItems}>
              <Ionicons name="nutrition-outline" size={ms(24)} color={colors.textTertiary} />
              <Text style={s.emptyItemsText}>Search, scan or quick add foods below</Text>
            </View>
          ) : (
            <View style={s.rows}>
              {items.map((item) => (
                <MealItemRow key={item.id} item={item} onPress={handleEditItem} onRemove={handleRemoveItem} s={s} c={colors} />
              ))}
            </View>
          )}

          <Text style={[s.label, s.padded, s.addLabel]}>Add foods</Text>
          <AddFoodActions onScan={handleOpenScanner} onQuickAdd={handleOpenQuickAdd} />
          {!!scanNotice && (
            <View style={s.banner}>
              <Ionicons name="alert-circle-outline" size={ms(15)} color={colors.accentOrange} />
              <Text style={s.bannerText}>{scanNotice}</Text>
              <Pressable onPress={() => setScanNotice(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
                <Ionicons name="close" size={ms(15)} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}
          {visible && (
            <MealFoodPicker onSelectFood={handleSelectFood} onAddSavedMeal={handleAddSavedMeal} clearSignal={clearSignal} />
          )}
        </View>
      </FoodSubScreen>

      {!!detailFood && (
        <FoodDetailModal
          visible
          food={detailFood}
          initialMealSlot={mealSlot}
          initialIsPlanned={false}
          initialQuantity={editingItemId ? detailQuantity : 1}
          onDismiss={handleDetailDismiss}
          onAdded={handleDetailDismiss}
          onAddToMeal={handleDetailAddToMeal}
          onFoodSwap={setDetailFood}
          isBackActive={isBackActive}
        />
      )}
      {quickAddVisible && (
        <QuickAddModal
          visible
          mealSlot={mealSlot}
          subtitle="to your meal"
          onDismiss={handleQuickAddDismiss}
          onAdded={handleQuickAddDismiss}
          onSubmitItem={handleQuickItem}
        />
      )}
      {scannerVisible && (
        <BarcodeScannerModal
          visible
          onDismiss={handleScanDismiss}
          onFoodFound={handleScanFound}
          onNotFound={handleScanNotFound}
        />
      )}
    </>
  );
}

export default React.memo(CreateMealModal);

/* ─── Styles ───────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  bleed: {
    marginHorizontal: -sw(16),
    gap: sw(12),
  },
  padded: {
    marginHorizontal: sw(16),
  },
  pressed: {
    opacity: 0.6,
  },
  saveBtn: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(18),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
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
  hero: {
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(4),
  },
  heroNum: {
    color: colors.textPrimary,
    fontSize: ms(34),
    lineHeight: ms(40),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  heroUnit: {
    color: colors.textTertiary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0,
  },
  heroBar: {
    alignSelf: 'stretch',
    paddingHorizontal: sw(56),
  },
  label: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addLabel: {
    marginTop: sw(8),
  },
  rows: {
    gap: sw(8),
  },
  emptyItems: {
    alignItems: 'center',
    gap: sw(6),
    paddingVertical: sw(18),
    marginHorizontal: sw(16),
    borderRadius: sw(16),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
  },
  emptyItemsText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(17),
    fontFamily: Fonts.medium,
  },
  removeBtn: {
    width: sw(30),
    height: sw(30),
    borderRadius: sw(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginHorizontal: sw(16),
    paddingHorizontal: sw(12),
    paddingVertical: sw(10),
    borderRadius: sw(12),
    borderWidth: 1,
    backgroundColor: colors.accentOrange + '1A',
    borderColor: colors.accentOrange + '40',
  },
  bannerText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(17),
    fontFamily: Fonts.medium,
  },
});
