import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNutritionStore } from '../../stores/useNutritionStore';
import { useSavedMealsStore, type MealItem, type SavedMeal } from '../../stores/useSavedMealsStore';
import { useFavouritesStore } from '../../stores/useFavouritesStore';
import { supabase } from '../../lib/supabase';
import type { FoodCatalogItem, FoodEntry } from '../../stores/useFoodLogStore';
import FoodDetailModal from './FoodDetailModal';
import type { FoodDetailData, MealItemData } from './FoodDetailModal';

/* ─── Props ────────────────────────────────────────────── */

function generateGroupId(): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${hex()}-${hex()}${hex()}${hex()}`;
}

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
  onLogged: () => void;
  initialMeal?: SavedMeal | null;
  /** When editing a logged meal group, pass the group ID */
  editMealGroupId?: string | null;
  /** When editing a logged meal group, pass the group's entries */
  editMealGroupEntries?: FoodEntry[] | null;
}

/* ─── Animation configs (hoisted — zero allocation in worklets) */

const FADE_IN = { duration: 200, easing: Easing.out(Easing.cubic) };
const FADE_OUT = { duration: 150, easing: Easing.in(Easing.cubic) };

/* ─── Meal item row (memoized) ─────────────────────────── */

interface MealItemRowProps {
  item: MealItem;
  onPress: (item: MealItem) => void;
  onRemove: (id: string) => void;
  s: ReturnType<typeof createStyles>;
  c: ThemeColors;
}

const MealItemRow = React.memo(function MealItemRow({
  item, onPress, onRemove, s, c,
}: MealItemRowProps) {
  const totalCal = Math.round(item.calories * item.quantity);
  const totalP = Math.round(item.protein * item.quantity);
  const totalC = Math.round(item.carbs * item.quantity);
  const totalF = Math.round(item.fat * item.quantity);

  return (
    <TouchableOpacity style={s.itemCard} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={s.itemTop}>
        <View style={s.itemInfo}>
          <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
          {item.brand ? <Text style={s.itemBrand} numberOfLines={1}>{item.brand}</Text> : null}
          <Text style={s.itemServing}>{item.serving_size}{item.serving_unit} × {item.quantity}</Text>
        </View>
        <View style={s.catalogRight}>
          <Text style={s.itemCalBig}>{totalCal}</Text>
          <Text style={s.itemCalUnit}>kcal</Text>
        </View>
        <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={8} style={s.removeBtn}>
          <Ionicons name="close" size={ms(14)} color={c.textTertiary} />
        </TouchableOpacity>
      </View>
      <View style={s.itemBottom}>
        <View style={s.itemMacros}>
          <Text style={[s.itemMacro, { color: c.protein }]}>P {totalP}g</Text>
          <Text style={[s.itemMacro, { color: c.carbs }]}>C {totalC}g</Text>
          <Text style={[s.itemMacro, { color: c.fat }]}>F {totalF}g</Text>
        </View>
        <Ionicons name="create-outline" size={ms(14)} color={c.textTertiary} />
      </View>
    </TouchableOpacity>
  );
});

/* ─── Catalog row (search result) ──────────────────────── */

interface CatalogRowProps {
  item: FoodCatalogItem;
  onSelect: (item: FoodCatalogItem) => void;
  s: ReturnType<typeof createStyles>;
  c: ThemeColors;
}

const CatalogRow = React.memo(function CatalogRow({ item, onSelect, s, c }: CatalogRowProps) {
  return (
    <TouchableOpacity style={s.catalogRow} onPress={() => onSelect(item)} activeOpacity={0.7}>
      <View style={s.catalogInfo}>
        <Text style={s.catalogName} numberOfLines={1}>{item.name}</Text>
        {item.brand ? <Text style={s.catalogBrand} numberOfLines={1}>{item.brand}</Text> : null}
        <View style={s.catalogMacros}>
          <Text style={[s.catalogMacro, { color: c.protein }]}>P {Math.round(item.protein)}</Text>
          <Text style={[s.catalogMacro, { color: c.carbs }]}>C {Math.round(item.carbs)}</Text>
          <Text style={[s.catalogMacro, { color: c.fat }]}>F {Math.round(item.fat)}</Text>
          <Text style={s.catalogServing}>{item.serving_size}{item.serving_unit}</Text>
        </View>
      </View>
      <View style={s.catalogRight}>
        <Text style={s.catalogCals}>{Math.round(item.calories)}</Text>
        <Text style={s.catalogCalUnit}>kcal</Text>
      </View>
      <Ionicons name="add-circle" size={ms(22)} color={c.accent} />
    </TouchableOpacity>
  );
});

/* ─── Main component ───────────────────────────────────── */

export default function CreateMealModal({
  visible, mealSlot, targetHour, onDismiss, onLogged, initialMeal,
  editMealGroupId, editMealGroupEntries,
}: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  /* ── Fade + scale (pure UI-thread) ────────────────────── */
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, visible ? FADE_IN : FADE_OUT);
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  /* ── Store selectors ────────────────────────────────── */
  const userId = useAuthStore((st) => st.user?.id);
  const selectedDate = useFoodLogStore((st) => st.selectedDate);
  const catalogResults = useFoodLogStore((st) => st.catalogResults);
  const catalogLoading = useFoodLogStore((st) => st.catalogLoading);
  const searchCatalog = useFoodLogStore((st) => st.searchCatalog);
  const clearSearch = useFoodLogStore((st) => st.clearSearch);
  const fetchDayEntries = useFoodLogStore((st) => st.fetchDayEntries);
  const recentFoods = useFoodLogStore((st) => st.recentFoods);
  const popularFoods = useFoodLogStore((st) => st.popularFoods);
  const fetchDefaultFoods = useFoodLogStore((st) => st.fetchDefaultFoods);

  const savedMeals = useSavedMealsStore((st) => st.meals);
  const loadSavedMeals = useSavedMealsStore((st) => st.loadMeals);
  const saveMeal = useSavedMealsStore((st) => st.saveMeal);
  const updateMeal = useSavedMealsStore((st) => st.updateMeal);

  const favourites = useFavouritesStore((st) => st.favourites);
  const loadFavourites = useFavouritesStore((st) => st.loadFavourites);

  /* ── Local state ────────────────────────────────────── */
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [defaultTab, setDefaultTab] = useState<'popular' | 'recent' | 'favourites' | 'meals'>('popular');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Initialize from saved meal OR logged meal group ── */
  useEffect(() => {
    if (visible && editMealGroupEntries && editMealGroupEntries.length > 0) {
      // Editing a logged meal group — convert FoodEntry[] → MealItem[]
      setMealName(editMealGroupEntries[0].meal_group_name || '');
      setItems(editMealGroupEntries.map((e) => {
        const qty = e.quantity || 1;
        return {
          id: `item-${e.id}`,
          name: e.name,
          brand: e.brand,
          food_catalog_id: e.food_catalog_id,
          calories: e.calories / qty,
          protein: e.protein / qty,
          carbs: e.carbs / qty,
          fat: e.fat / qty,
          fiber: e.fiber != null ? e.fiber / qty : null,
          sugar: e.sugar != null ? e.sugar / qty : null,
          serving_size: e.serving_size || 1,
          serving_unit: e.serving_unit || 'serving',
          quantity: qty,
        };
      }));
      setEditingMealId(null);
    } else if (visible && initialMeal) {
      setMealName(initialMeal.name);
      setItems([...initialMeal.items]);
      setEditingMealId(initialMeal.id);
    } else if (visible) {
      setMealName('');
      setItems([]);
      setEditingMealId(null);
    }
  }, [visible, initialMeal, editMealGroupEntries]);

  /* ── Load defaults on open ──────────────────────────── */
  useEffect(() => {
    if (visible && userId) fetchDefaultFoods(userId);
    if (visible) { loadFavourites(); loadSavedMeals(); }
  }, [visible, userId]);

  /* ── Reset on close ─────────────────────────────────── */
  useEffect(() => {
    if (!visible) {
      setQuery('');
      clearSearch();
      setDetailVisible(false);
      setDetailFood(null);
      setEditingItemId(null);
      setDefaultTab('popular');
    }
  }, [visible]);

  /* ── Search ─────────────────────────────────────────── */
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchCatalog(text), 300);
  }, [searchCatalog]);

  /* ── Detail modal state (for configuring serving before add) ── */
  const [detailFood, setDetailFood] = useState<FoodDetailData | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  /* ── Select catalog item → open detail modal ─────────── */
  const handleSelectItem = useCallback((item: FoodCatalogItem) => {
    setEditingItemId(null);
    setDetailFood({
      name: item.name,
      brand: item.brand,
      food_catalog_id: item.food_catalog_id || null,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      serving_size: item.serving_size,
      serving_unit: item.serving_unit,
      confidence: item.confidence,
      vitamin_a: item.vitamin_a, vitamin_c: item.vitamin_c,
      vitamin_d: item.vitamin_d, vitamin_e: item.vitamin_e,
      vitamin_k: item.vitamin_k, vitamin_b6: item.vitamin_b6,
      vitamin_b12: item.vitamin_b12, folate: item.folate,
      calcium: item.calcium, iron: item.iron,
      magnesium: item.magnesium, potassium: item.potassium,
      zinc: item.zinc, sodium: item.sodium,
    });
    setDetailVisible(true);
  }, []);

  /* ── Tap existing item → open detail for editing ────── */
  const handleEditItem = useCallback((item: MealItem) => {
    setEditingItemId(item.id);
    setDetailFood({
      name: item.name,
      brand: item.brand,
      food_catalog_id: item.food_catalog_id,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      serving_size: item.serving_size,
      serving_unit: item.serving_unit,
    });
    setDetailVisible(true);
  }, []);

  /* ── Detail modal confirms → add or update item ──────── */
  const handleDetailAddToMeal = useCallback((data: MealItemData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingItemId) {
      // Update existing item
      setItems((prev) => prev.map((i) => i.id === editingItemId ? {
        ...i,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        fiber: data.fiber,
        sugar: data.sugar,
        serving_size: data.serving_size,
        serving_unit: data.serving_unit,
        quantity: data.quantity,
      } : i));
    } else {
      // Add new item
      const mealItem: MealItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: data.name,
        brand: data.brand,
        food_catalog_id: data.food_catalog_id,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        fiber: data.fiber,
        sugar: data.sugar,
        serving_size: data.serving_size,
        serving_unit: data.serving_unit,
        quantity: data.quantity,
      };
      setItems((prev) => [...prev, mealItem]);
    }
    setDetailVisible(false);
    setDetailFood(null);
    setEditingItemId(null);
    setQuery('');
    clearSearch();
  }, [editingItemId, clearSearch]);

  const handleDetailDismiss = useCallback(() => {
    setDetailVisible(false);
    setDetailFood(null);
    setEditingItemId(null);
  }, []);

  /* ── Add saved meal items (compound meal) ────────────── */
  const handleAddSavedMeal = useCallback((meal: SavedMeal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newItems: MealItem[] = meal.items.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  /* ── Remove item ────────────────────────────────────── */
  const handleRemoveItem = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /* ── Compute totals ─────────────────────────────────── */
  const totals = useMemo(() => {
    let cal = 0, pro = 0, carb = 0, fat = 0;
    for (const i of items) {
      cal += i.calories * i.quantity;
      pro += i.protein * i.quantity;
      carb += i.carbs * i.quantity;
      fat += i.fat * i.quantity;
    }
    return {
      calories: Math.round(cal),
      protein: Math.round(pro),
      carbs: Math.round(carb),
      fat: Math.round(fat),
    };
  }, [items]);

  /* ── Save meal ──────────────────────────────────────── */
  const handleSave = useCallback(() => {
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
    if (editingMealId) {
      updateMeal(editingMealId, name, items);
    } else {
      saveMeal(name, items).then((id) => setEditingMealId(id));
    }
    Alert.alert('Saved', `"${name}" has been saved.`);
  }, [mealName, items, editingMealId, saveMeal, updateMeal]);

  /* ── Log meal ───────────────────────────────────────── */
  const isEditingGroup = !!editMealGroupId;

  const handleLog = useCallback(async () => {
    if (!userId) return;
    if (items.length === 0) {
      Alert.alert('No Items', 'Add at least one food item to log.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const groupId = editMealGroupId || generateGroupId();
    const groupName = mealName.trim() || 'Meal';

    // If editing an existing group, delete old entries first
    if (editMealGroupId) {
      const { error: delErr } = await supabase
        .from('food_entries')
        .delete()
        .eq('meal_group_id', editMealGroupId);
      if (delErr) {
        console.error('[CreateMeal] Delete old group error:', delErr);
        Alert.alert('Update Failed', delErr.message);
        return;
      }
    }

    // Build created_at timestamp for the target date
    let createdAt: string;
    if (selectedDate && targetHour != null) {
      createdAt = new Date(selectedDate + `T${String(targetHour).padStart(2, '0')}:00:00`).toISOString();
    } else if (selectedDate) {
      createdAt = new Date(selectedDate + 'T12:00:00').toISOString();
    } else {
      createdAt = new Date().toISOString();
    }

    // Build rows for a single batch insert
    const rows = items.map((item) => {
      const qty = item.quantity;
      return {
        user_id: userId,
        name: item.name,
        calories: Math.round(item.calories * qty),
        protein: Math.round(item.protein * qty),
        carbs: Math.round(item.carbs * qty),
        fat: Math.round(item.fat * qty),
        meal_type: mealSlot,
        brand: item.brand || null,
        food_catalog_id: null,
        serving_size: Number(item.serving_size) || 1,
        serving_unit: item.serving_unit || 'serving',
        quantity: qty,
        fiber: item.fiber != null ? Math.round(item.fiber * qty * 10) / 10 : null,
        sugar: item.sugar != null ? Math.round(item.sugar * qty * 10) / 10 : null,
        is_planned: false,
        created_at: createdAt,
        meal_group_id: groupId,
        meal_group_name: groupName,
      };
    });

    const { error } = await supabase.from('food_entries').insert(rows);

    if (error) {
      console.error('[CreateMeal] Supabase insert error:', error);
      Alert.alert('Log Failed', error.message);
      return;
    }

    // Refetch entries from Supabase to update the view
    await fetchDayEntries(userId, selectedDate);
    // Sync HomeScreen nutrition
    useNutritionStore.getState().fetchTodayNutrition(userId);
    onLogged();
  }, [userId, items, mealSlot, mealName, selectedDate, targetHour, editMealGroupId, fetchDayEntries, onLogged]);

  /* ── Search display logic ───────────────────────────── */
  const showResults = query.length > 0 && catalogResults.length > 0;
  const showEmpty = query.length > 0 && catalogResults.length === 0 && !catalogLoading;
  const hasRecent = recentFoods.length > 0;
  const hasPopular = popularFoods.length > 0;
  const hasFavourites = favourites.length > 0;
  const hasSavedMeals = savedMeals.length > 0;
  const showDefaults = query.length === 0 && (hasRecent || hasPopular || hasFavourites || hasSavedMeals);

  /* ── Render ─────────────────────────────────────────── */
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.overlay, animStyle]} collapsable={false}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onDismiss} style={s.backBtn} activeOpacity={0.5}>
              <Ionicons name="chevron-back" size={ms(20)} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.title}>{isEditingGroup ? 'Edit Logged Meal' : editingMealId ? 'Edit Meal' : 'Create Meal'}</Text>
            <TouchableOpacity onPress={handleSave} style={s.saveHeaderBtn} activeOpacity={0.5}>
              <Ionicons name="bookmark-outline" size={ms(18)} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.flex}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Meal name input */}
            <View style={s.nameRow}>
              <Ionicons name="restaurant-outline" size={ms(18)} color={colors.accent} />
              <TextInput
                style={s.nameInput}
                placeholder="Meal name (e.g. Chicken Rice Bowl)"
                placeholderTextColor={colors.textTertiary + '50'}
                value={mealName}
                onChangeText={setMealName}
                returnKeyType="done"
              />
            </View>

            {/* Macro summary */}
            {items.length > 0 && (
              <View style={s.summaryCard}>
                <Text style={s.summaryCalories}>{totals.calories} kcal</Text>
                <View style={s.summaryMacros}>
                  <View style={s.summaryMacroCol}>
                    <Text style={[s.summaryMacroVal, { color: colors.protein }]}>{totals.protein}g</Text>
                    <Text style={s.summaryMacroLabel}>Protein</Text>
                  </View>
                  <View style={s.summaryDot} />
                  <View style={s.summaryMacroCol}>
                    <Text style={[s.summaryMacroVal, { color: colors.carbs }]}>{totals.carbs}g</Text>
                    <Text style={s.summaryMacroLabel}>Carbs</Text>
                  </View>
                  <View style={s.summaryDot} />
                  <View style={s.summaryMacroCol}>
                    <Text style={[s.summaryMacroVal, { color: colors.fat }]}>{totals.fat}g</Text>
                    <Text style={s.summaryMacroLabel}>Fat</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Items section */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>ITEMS ({items.length})</Text>
            </View>

            {items.length === 0 ? (
              <View style={s.emptyItems}>
                <Ionicons name="nutrition-outline" size={ms(28)} color={colors.textTertiary + '60'} />
                <Text style={s.emptyItemsText}>Search below to add foods</Text>
              </View>
            ) : (
              items.map((item) => (
                <MealItemRow
                  key={item.id}
                  item={item}
                  onPress={handleEditItem}
                  onRemove={handleRemoveItem}
                  s={s}
                  c={colors}
                />
              ))
            )}

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>ADD FOODS</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Search bar */}
            <View style={s.searchRow}>
              <Ionicons name="search" size={ms(17)} color={colors.textTertiary + '80'} />
              <TextInput
                style={s.searchText}
                placeholder="Search foods, brands, recipes..."
                placeholderTextColor={colors.textTertiary + '50'}
                value={query}
                onChangeText={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); clearSearch(); }} hitSlop={8} style={s.searchClearBtn}>
                  <Ionicons name="close" size={ms(12)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tab pills */}
            {query.length === 0 && (
              <View style={s.tabGrid}>
                <View style={s.tabGridRow}>
                  <TouchableOpacity
                    style={[s.tabPill, defaultTab === 'popular' && s.tabPillActive]}
                    onPress={() => setDefaultTab('popular')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.tabPillText, defaultTab === 'popular' && s.tabPillTextActive]}>Popular</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tabPill, defaultTab === 'recent' && s.tabPillActive]}
                    onPress={() => setDefaultTab('recent')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.tabPillText, defaultTab === 'recent' && s.tabPillTextActive]}>Recent</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.tabGridRow}>
                  <TouchableOpacity
                    style={[s.tabPill, defaultTab === 'favourites' && s.tabPillActive]}
                    onPress={() => setDefaultTab('favourites')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.tabPillText, defaultTab === 'favourites' && s.tabPillTextActive]}>
                      Favourites{hasFavourites ? ` (${favourites.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tabPill, defaultTab === 'meals' && s.tabPillActive]}
                    onPress={() => setDefaultTab('meals')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.tabPillText, defaultTab === 'meals' && s.tabPillTextActive]}>
                      Meals{hasSavedMeals ? ` (${savedMeals.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Search results / defaults */}
            {catalogLoading ? (
              <View style={s.searchState}>
                <Text style={s.searchStateText}>Searching...</Text>
              </View>
            ) : showEmpty ? (
              <View style={s.searchState}>
                <Ionicons name="search-outline" size={ms(24)} color={colors.textTertiary} />
                <Text style={s.searchStateText}>No results found</Text>
              </View>
            ) : showResults ? (
              catalogResults.map((item, i) => (
                <CatalogRow key={item.id + i} item={item} onSelect={handleSelectItem} s={s} c={colors} />
              ))
            ) : showDefaults ? (
              <>
                {defaultTab === 'popular' && hasPopular && popularFoods.map((item) => (
                  <CatalogRow key={`p-${item.id}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                ))}
                {defaultTab === 'recent' && hasRecent && recentFoods.map((item, i) => (
                  <CatalogRow key={`r-${item.id}-${i}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                ))}
                {defaultTab === 'recent' && !hasRecent && (
                  <View style={s.searchState}>
                    <Text style={s.searchStateText}>No recent foods yet</Text>
                  </View>
                )}
                {defaultTab === 'favourites' && hasFavourites && favourites.map((item, i) => (
                  <CatalogRow key={`fav-${item.id}-${i}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                ))}
                {defaultTab === 'favourites' && !hasFavourites && (
                  <View style={s.searchState}>
                    <Ionicons name="heart-outline" size={ms(24)} color={colors.textTertiary} />
                    <Text style={s.searchStateText}>No favourites yet</Text>
                  </View>
                )}
                {defaultTab === 'meals' && hasSavedMeals && savedMeals.map((meal) => {
                  const totalCal = Math.round(meal.items.reduce((sum, i) => sum + i.calories * i.quantity, 0));
                  const totalP = Math.round(meal.items.reduce((sum, i) => sum + i.protein * i.quantity, 0));
                  const totalC = Math.round(meal.items.reduce((sum, i) => sum + i.carbs * i.quantity, 0));
                  const totalF = Math.round(meal.items.reduce((sum, i) => sum + i.fat * i.quantity, 0));
                  return (
                    <TouchableOpacity
                      key={meal.id}
                      style={s.savedMealCard}
                      onPress={() => handleAddSavedMeal(meal)}
                      activeOpacity={0.7}
                    >
                      <View style={s.savedMealInfo}>
                        <Text style={s.savedMealName} numberOfLines={1}>{meal.name}</Text>
                        <View style={s.savedMealMeta}>
                          <Text style={s.savedMealItems}>{meal.items.length} items</Text>
                          <View style={s.savedMealMacros}>
                            <Text style={[s.catalogMacro, { color: colors.protein }]}>P {totalP}</Text>
                            <Text style={[s.catalogMacro, { color: colors.carbs }]}>C {totalC}</Text>
                            <Text style={[s.catalogMacro, { color: colors.fat }]}>F {totalF}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.catalogRight}>
                        <Text style={s.catalogCals}>{totalCal}</Text>
                        <Text style={s.catalogCalUnit}>kcal</Text>
                      </View>
                      <Ionicons name="add-circle" size={ms(22)} color={colors.accent} />
                    </TouchableOpacity>
                  );
                })}
                {defaultTab === 'meals' && !hasSavedMeals && (
                  <View style={s.searchState}>
                    <Ionicons name="restaurant-outline" size={ms(24)} color={colors.textTertiary} />
                    <Text style={s.searchStateText}>No saved meals yet</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={s.searchState}>
                <Text style={s.searchStateText}>Search for foods to add to your meal</Text>
              </View>
            )}

            {/* Bottom padding */}
            <View style={{ height: sw(100) }} />
          </ScrollView>

          {/* Fixed bottom bar */}
          <View style={s.bottomBar}>
            <TouchableOpacity
              style={[s.logBtn, items.length === 0 && s.logBtnDisabled]}
              onPress={handleLog}
              activeOpacity={0.7}
              disabled={items.length === 0}
            >
              <Ionicons name="add-circle-outline" size={ms(20)} color={colors.textOnAccent} />
              <Text style={s.logBtnText}>{isEditingGroup ? 'Update Meal' : 'Log Meal'} ({items.length} items)</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      <FoodDetailModal
        visible={detailVisible}
        food={detailFood}
        initialMealSlot={mealSlot}
        initialIsPlanned={false}
        onDismiss={handleDetailDismiss}
        onAdded={handleDetailDismiss}
        onAddToMeal={handleDetailAddToMeal}
      />
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────── */

const STATUS_H = StatusBar.currentHeight ?? 0;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? STATUS_H + sw(8) : sw(60),
  },
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(12),
    marginBottom: sw(12),
  },
  backBtn: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(12),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  saveHeaderBtn: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(12),
    backgroundColor: colors.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Scroll content */
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(20),
  },
  /* Meal name */
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    paddingHorizontal: sw(14),
    height: sw(48),
    gap: sw(10),
    marginBottom: sw(12),
  },
  nameInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    padding: 0,
  },
  /* Summary card */
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(14),
    marginBottom: sw(14),
    alignItems: 'center',
    gap: sw(8),
    ...colors.cardShadow,
  },
  summaryCalories: {
    color: colors.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(28),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  summaryMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(16),
  },
  summaryMacroCol: {
    alignItems: 'center',
    gap: sw(2),
  },
  summaryMacroVal: {
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
  },
  summaryMacroLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  summaryDot: {
    width: sw(3),
    height: sw(3),
    borderRadius: sw(1.5),
    backgroundColor: colors.textTertiary,
    opacity: 0.3,
  },
  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(8),
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
  },
  /* Empty items */
  emptyItems: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(24),
    gap: sw(8),
  },
  emptyItemsText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  /* Meal item card */
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: sw(12),
    padding: sw(12),
    marginBottom: sw(6),
    gap: sw(6),
    ...colors.cardShadow,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  itemInfo: {
    flex: 1,
    gap: sw(1),
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  itemBrand: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  itemCal: {
    color: colors.accent,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.bold,
  },
  removeBtn: {
    width: sw(24),
    height: sw(24),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemServing: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    marginTop: sw(1),
  },
  itemCalBig: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.extraBold,
  },
  itemCalUnit: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
  },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemMacros: {
    flexDirection: 'row',
    gap: sw(8),
  },
  itemMacro: {
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
  },
  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    marginVertical: sw(14),
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  dividerText: {
    color: colors.accent,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.extraBold,
    letterSpacing: 0.5,
  },
  /* Search bar */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    paddingHorizontal: sw(14),
    height: sw(46),
    gap: sw(10),
    marginBottom: sw(12),
  },
  searchText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.regular,
    padding: 0,
    letterSpacing: 0.1,
  },
  searchClearBtn: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(11),
    backgroundColor: colors.textTertiary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Tab pills */
  tabGrid: {
    gap: sw(6),
    marginBottom: sw(12),
  },
  tabGridRow: {
    flexDirection: 'row',
    gap: sw(6),
  },
  tabPill: {
    flex: 1,
    paddingVertical: sw(7),
    borderRadius: sw(20),
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: colors.accent,
  },
  tabPillText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  tabPillTextActive: {
    color: colors.textOnAccent,
  },
  /* Search states */
  searchState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(20),
    gap: sw(6),
  },
  searchStateText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  /* Catalog row */
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(12),
    paddingVertical: sw(10),
    paddingHorizontal: sw(12),
    gap: sw(10),
    marginBottom: sw(6),
  },
  catalogInfo: { flex: 1, gap: sw(2) },
  catalogName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  catalogBrand: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  catalogMacros: { flexDirection: 'row', gap: sw(8), marginTop: sw(2) },
  catalogMacro: { fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.bold },
  catalogServing: {
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    color: colors.textTertiary,
  },
  catalogRight: { alignItems: 'center' },
  catalogCals: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.extraBold,
  },
  catalogCalUnit: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
  },
  /* Results section labels */
  resultsSectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: sw(8),
    marginBottom: sw(6),
  },
  /* Saved meal card */
  savedMealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(12),
    paddingVertical: sw(10),
    paddingHorizontal: sw(12),
    gap: sw(10),
    marginBottom: sw(6),
  },
  savedMealInfo: { flex: 1, gap: sw(4) },
  savedMealName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  savedMealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  savedMealItems: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  savedMealMacros: {
    flexDirection: 'row',
    gap: sw(6),
  },
  /* Bottom bar */
  bottomBar: {
    paddingHorizontal: sw(16),
    paddingTop: sw(10),
    paddingBottom: Platform.OS === 'ios' ? sw(34) : sw(16),
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: sw(14),
    paddingVertical: sw(14),
    gap: sw(8),
  },
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
  },
});
