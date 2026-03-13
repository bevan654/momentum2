import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, ms } from '../theme/responsive';
import { Fonts } from '../theme/typography';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useSupplementStore, type SupplementEntry } from '../stores/useSupplementStore';
import MealSection from '../components/food/MealSection';
import AddFoodModal from '../components/food/AddFoodModal';
import FoodDetailModal from '../components/food/FoodDetailModal';
import CreateMealModal from '../components/food/CreateMealModal';
import NutritionHero from '../components/food/NutritionHero';
import type { FoodDetailData } from '../components/food/FoodDetailModal';
import type { FoodEntry, MealConfig } from '../stores/useFoodLogStore';

function FoodLoggerScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const selectedDate = useFoodLogStore((s) => s.selectedDate);
  const entries = useFoodLogStore((s) => s.entries);
  const mealConfigs = useFoodLogStore((s) => s.mealConfigs);
  const goals = useFoodLogStore((s) => s.goals);
  const collapsedMeals = useFoodLogStore((s) => s.collapsedMeals);
  const loading = useFoodLogStore((s) => s.loading);

  const fetchDayEntries = useFoodLogStore((s) => s.fetchDayEntries);
  const fetchMealConfigs = useFoodLogStore((s) => s.fetchMealConfigs);
  const fetchGoals = useFoodLogStore((s) => s.fetchGoals);
  const toggleMealCollapse = useFoodLogStore((s) => s.toggleMealCollapse);
  const deleteEntry = useFoodLogStore((s) => s.deleteEntry);
  const updateEntry = useFoodLogStore((s) => s.updateEntry);
  const togglePlanned = useFoodLogStore((s) => s.togglePlanned);
  const moveEntryToHour = useFoodLogStore((s) => s.moveEntryToHour);
  const deleteMealGroup = useFoodLogStore((s) => s.deleteMealGroup);

  const supplementEntries = useSupplementStore((s) => s.dateEntries);
  const fetchDateSupplements = useSupplementStore((s) => s.fetchDateSupplements);
  const deleteSupplementEntry = useSupplementStore((s) => s.deleteSupplementEntry);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const nowRef = useRef<View>(null);
  const hasScrolledRef = useRef(false);

  // Add food modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addMealSlot, setAddMealSlot] = useState('breakfast');
  const [addHour, setAddHour] = useState<number | undefined>(undefined);

  // Detail modal state (tap entry to open)
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null);
  const [editDetailVisible, setEditDetailVisible] = useState(false);

  // Meal group edit state
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupEntries, setEditGroupEntries] = useState<FoodEntry[] | null>(null);
  const [editGroupModalVisible, setEditGroupModalVisible] = useState(false);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    fetchMealConfigs(userId);
    fetchGoals(userId);
  }, [userId]);

  // Fetch entries when date changes
  useEffect(() => {
    if (!userId) return;
    hasScrolledRef.current = false;
    fetchDayEntries(userId, selectedDate);
    fetchDateSupplements(userId, selectedDate);
  }, [userId, selectedDate]);

  // Auto-scroll to current time after layout (only for today)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const isToday = selectedDate === todayStr;

  useEffect(() => {
    if (loading || hasScrolledRef.current || !isToday) return;
    const timer = setTimeout(() => {
      if (nowRef.current && contentRef.current) {
        nowRef.current.measureLayout(
          contentRef.current as any,
          (_x: number, y: number) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - sw(80)), animated: true });
            hasScrolledRef.current = true;
          },
          () => {},
        );
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleAddFood = useCallback((mealSlot: string, hour?: number) => {
    setAddMealSlot(mealSlot);
    setAddHour(hour);
    setAddModalVisible(true);
  }, []);

  const handleFabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const h = new Date().getHours();
    const slot = h < 11 ? 'breakfast' : h < 14 ? 'lunch' : h < 17 ? 'snack' : 'dinner';
    setAddMealSlot(slot);
    setAddHour(h);
    setAddModalVisible(true);
  }, []);

  const handleDismissModal = useCallback(() => {
    setAddModalVisible(false);
  }, []);

  const handleRefresh = useCallback(() => {
    if (!userId) return;
    fetchDayEntries(userId, selectedDate);
  }, [userId, selectedDate]);

  // Tap entry → open detail modal
  const handlePressEntry = useCallback((entry: FoodEntry) => {
    setEditEntry(entry);
    setEditDetailVisible(true);
  }, []);

  // Convert entry to FoodDetailData (per-serving values)
  const editDetailData: FoodDetailData | null = useMemo(() => {
    if (!editEntry) return null;
    const qty = editEntry.quantity || 1;
    return {
      name: editEntry.name,
      brand: editEntry.brand,
      food_catalog_id: editEntry.food_catalog_id,
      calories: editEntry.calories / qty,
      protein: editEntry.protein / qty,
      carbs: editEntry.carbs / qty,
      fat: editEntry.fat / qty,
      fiber: editEntry.fiber != null ? editEntry.fiber / qty : null,
      sugar: editEntry.sugar != null ? editEntry.sugar / qty : null,
      serving_size: editEntry.serving_size || 1,
      serving_unit: editEntry.serving_unit || 'serving',
      vitamin_a: editEntry.vitamin_a != null ? editEntry.vitamin_a / qty : null,
      vitamin_c: editEntry.vitamin_c != null ? editEntry.vitamin_c / qty : null,
      vitamin_d: editEntry.vitamin_d != null ? editEntry.vitamin_d / qty : null,
      vitamin_e: editEntry.vitamin_e != null ? editEntry.vitamin_e / qty : null,
      vitamin_k: editEntry.vitamin_k != null ? editEntry.vitamin_k / qty : null,
      vitamin_b6: editEntry.vitamin_b6 != null ? editEntry.vitamin_b6 / qty : null,
      vitamin_b12: editEntry.vitamin_b12 != null ? editEntry.vitamin_b12 / qty : null,
      folate: editEntry.folate != null ? editEntry.folate / qty : null,
      calcium: editEntry.calcium != null ? editEntry.calcium / qty : null,
      iron: editEntry.iron != null ? editEntry.iron / qty : null,
      magnesium: editEntry.magnesium != null ? editEntry.magnesium / qty : null,
      potassium: editEntry.potassium != null ? editEntry.potassium / qty : null,
      zinc: editEntry.zinc != null ? editEntry.zinc / qty : null,
      sodium: editEntry.sodium != null ? editEntry.sodium / qty : null,
      caffeine: editEntry.caffeine != null ? editEntry.caffeine / qty : null,
    };
  }, [editEntry]);

  const handleEditDismiss = useCallback(() => {
    setEditDetailVisible(false);
    setEditEntry(null);
  }, []);

  // When edit detail saves, update the existing entry instead of creating new
  const handleEditSaved = useCallback(() => {
    setEditDetailVisible(false);
    setEditEntry(null);
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    setEditDetailVisible(false);
    setEditEntry(null);
    deleteEntry(id);
  }, [deleteEntry]);

  // Meal group handlers
  const handlePressMealGroup = useCallback((groupId: string, groupEntries: FoodEntry[]) => {
    const hour = groupEntries[0] ? new Date(groupEntries[0].created_at).getHours() : undefined;
    setEditGroupId(groupId);
    setEditGroupEntries(groupEntries);
    setAddMealSlot(groupEntries[0]?.meal_type || 'breakfast');
    setAddHour(hour);
    setEditGroupModalVisible(true);
  }, []);

  const handleDeleteMealGroup = useCallback((groupId: string) => {
    deleteMealGroup(groupId);
  }, [deleteMealGroup]);

  const handleDeleteSupplement = useCallback((supplement: SupplementEntry) => {
    if (!userId) return;
    deleteSupplementEntry(userId, supplement);
  }, [userId, deleteSupplementEntry]);

  const handleDismissGroupEdit = useCallback(() => {
    setEditGroupModalVisible(false);
    setEditGroupId(null);
    setEditGroupEntries(null);
  }, []);

  const handleGroupEditLogged = useCallback(() => {
    setEditGroupModalVisible(false);
    setEditGroupId(null);
    setEditGroupEntries(null);
  }, []);

  return (
    <View style={styles.screen}>
      <NutritionHero entries={entries} goals={goals} />
      <ScrollView
        ref={scrollRef}
        style={styles.diaryPage}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
      >
        <View ref={contentRef} collapsable={false}>
          <MealSection
            entries={entries}
            supplementEntries={supplementEntries}
            onTogglePlanned={togglePlanned}
            onAddFood={handleAddFood}
            onPressEntry={handlePressEntry}
            onEditEntry={handlePressEntry}
            onMoveEntry={moveEntryToHour}
            onPressMealGroup={handlePressMealGroup}
            onDeleteMealGroup={handleDeleteMealGroup}
            onDeleteSupplement={handleDeleteSupplement}
            nowRef={nowRef}
            isToday={isToday}
          />
        </View>
      </ScrollView>
      <AddFoodModal
        visible={addModalVisible}
        mealSlot={addMealSlot}
        targetHour={addHour}
        onDismiss={handleDismissModal}
      />
      <FoodDetailModal
        visible={editDetailVisible}
        food={editDetailData}
        initialMealSlot={editEntry?.meal_type || 'breakfast'}
        initialIsPlanned={editEntry?.is_planned || false}
        onDismiss={handleEditDismiss}
        onAdded={handleEditSaved}
        editEntryId={editEntry?.id}
        onDelete={handleDeleteEntry}
      />
      <CreateMealModal
        visible={editGroupModalVisible}
        mealSlot={addMealSlot}
        targetHour={addHour}
        onDismiss={handleDismissGroupEdit}
        onLogged={handleGroupEditLogged}
        editMealGroupId={editGroupId}
        editMealGroupEntries={editGroupEntries}
      />
      {!addModalVisible && !editDetailVisible && !editGroupModalVisible && (
        <TouchableOpacity style={styles.fab} onPress={handleFabPress} activeOpacity={0.8}>
          <Ionicons name="add" size={ms(26)} color={colors.textOnAccent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default React.memo(FoodLoggerScreen);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSection: {
    paddingHorizontal: sw(16),
    paddingTop: sw(14),
    gap: sw(8),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSpacer: {
    width: sw(32),
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
    paddingHorizontal: sw(16),
    paddingTop: sw(10),
    paddingBottom: sw(8),
  },
  editBtn: {
    width: sw(32),
    height: sw(32),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryPage: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fab: {
    position: 'absolute',
    bottom: sw(16),
    right: sw(16),
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...colors.cardShadow,
    shadowOpacity: 0.3,
    elevation: 6,
  },
});
