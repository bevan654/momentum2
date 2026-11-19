import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, ms } from '../theme/responsive';
import { Fonts } from '../theme/typography';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useProteinPowderStore, PROTEIN_POWDER_KEY } from '../stores/useProteinPowderStore';

/** Protein powder's count follows its diary snacks: only users who track it load it. */
const tracksPowder = () => useSupplementStore.getState().supplementConfigs.some((c) => c.key === PROTEIN_POWDER_KEY);
import MealList from '../components/food/MealList';
import { hourFromTimeStart, mealSlotForHour, OTHER_SLOT, type MealBucket } from '../components/food/groupEntriesByMeal';
import AddFoodModal from '../components/food/AddFoodModal';
import FoodDetailModal from '../components/food/FoodDetailModal';
import CreateMealModal from '../components/food/CreateMealModal';
import NutritionHero from '../components/food/NutritionHero';
import HydrationStrip from '../components/food/HydrationStrip';
import DateNavigator from '../components/food/DateNavigator';
import RefreshBanner, { type RefreshResult } from '../components/food/RefreshBanner';
import UndoBanner, { type UndoOffer } from '../components/food/UndoBanner';
import type { FoodDetailData } from '../components/food/FoodDetailModal';
import type { FoodEntry } from '../stores/useFoodLogStore';
import { useToday } from '../hooks/useToday';

function FoodLoggerScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const selectedDate = useFoodLogStore((s) => s.selectedDate);
  const entries = useFoodLogStore((s) => s.entries);
  const goals = useFoodLogStore((s) => s.goals);
  const loading = useFoodLogStore((s) => s.loading);
  const loadError = useFoodLogStore((s) => s.loadError);

  const setDate = useFoodLogStore((s) => s.setDate);
  const fetchDayEntries = useFoodLogStore((s) => s.fetchDayEntries);
  const fetchMealConfigs = useFoodLogStore((s) => s.fetchMealConfigs);
  const fetchGoals = useFoodLogStore((s) => s.fetchGoals);
  const deleteEntry = useFoodLogStore((s) => s.deleteEntry);
  const togglePlanned = useFoodLogStore((s) => s.togglePlanned);
  const deleteMealGroup = useFoodLogStore((s) => s.deleteMealGroup);
  const restoreDeleted = useFoodLogStore((s) => s.restoreDeleted);

  const fetchDateSupplements = useSupplementStore((s) => s.fetchDateSupplements);

  const colors = useColors();

  // Whether the Nutrition tab is showing, kept in a ref by navigation events: the tab freezes
  // when hidden, so its sheets can't re-render to drop their Android back listeners.
  const navigation = useNavigation();
  const focusedRef = React.useRef(navigation.isFocused()); // React.useRef: the redesign drops the named import
  useEffect(() => {
    const onFocus = navigation.addListener('focus', () => { focusedRef.current = true; });
    const onBlur = navigation.addListener('blur', () => { focusedRef.current = false; });
    return () => { onFocus(); onBlur(); };
  }, [navigation]);
  const isScreenFocused = useCallback(() => focusedRef.current, []);
  const styles = useMemo(() => createStyles(colors), [colors]);

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
    fetchDayEntries(userId, selectedDate);
    fetchDateSupplements(userId, selectedDate);
    if (tracksPowder()) useProteinPowderStore.getState().fetchDate(userId, selectedDate);
  }, [userId, selectedDate]);

  // No auto-scroll to the current hour: the day summary at the top should stay in view.
  const todayStr = useToday();
  const isToday = selectedDate === todayStr;

  // Past midnight: if the user was looking at "today", follow it to the new day.
  // On first mount, compare against the store's starting day: it is set when the app loads,
  // so an app that sat in the background overnight would otherwise open on yesterday.
  const prevTodayRef = React.useRef(useFoodLogStore.getState().selectedDate);
  // Wait while a log/edit sheet is open: it builds times from the selected day, so
  // switching under it would log to the wrong day. Catch up once it closes.
  const sheetOpen = addModalVisible || editDetailVisible || editGroupModalVisible;
  useEffect(() => {
    if (sheetOpen) return;
    const prev = prevTodayRef.current;
    prevTodayRef.current = todayStr;
    if (prev !== todayStr && useFoodLogStore.getState().selectedDate === prev) {
      setDate(todayStr);
    }
  }, [todayStr, setDate, sheetOpen]);

  // The water strip shows today's live totals: reload them when the day rolls over
  // while the app stays open, or they'd keep showing yesterday's water and supplements.
  const totalsDayRef = React.useRef(todayStr);
  useEffect(() => {
    if (!userId || totalsDayRef.current === todayStr) return;
    totalsDayRef.current = todayStr;
    useSupplementStore.getState().fetchTodaySupplements(userId);
    if (tracksPowder()) useProteinPowderStore.getState().fetchToday(userId);
  }, [userId, todayStr]);

  // Always pass an hour so food lands on the day being viewed: now for today,
  // otherwise the meal's usual start time.
  const handleAddToMeal = useCallback((meal: MealBucket) => {
    const configs = useFoodLogStore.getState().mealConfigs;
    const nowHour = new Date().getHours();
    const hour = isToday ? nowHour : hourFromTimeStart(meal.timeStart);
    setAddMealSlot(meal.slot === OTHER_SLOT ? mealSlotForHour(configs, hour) : meal.slot);
    setAddHour(hour);
    setAddModalVisible(true);
  }, [isToday]);

  // The meal for the current time; on another day, logged at that meal's usual start time
  // (like the meal "+" buttons), not at this hour of that day.
  const handleFabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const configs = useFoodLogStore.getState().mealConfigs;
    const nowHour = new Date().getHours();
    const slot = mealSlotForHour(configs, nowHour);
    const meal = configs.find((c) => c.slot === slot);
    setAddMealSlot(slot);
    setAddHour(isToday || !meal ? nowHour : hourFromTimeStart(meal.time_start));
    setAddModalVisible(true);
  }, [isToday]);

  const handleDismissModal = useCallback(() => {
    setAddModalVisible(false);
  }, []);

  // Only a pull shows the refresh spinner; switching days has its own loading row below.
  const [refreshing, setRefreshing] = useState(false);
  // Shown in a small banner once the pull finishes, so it's clear the refresh did something.
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    let ok = false;
    try {
      await Promise.all([
        fetchDayEntries(userId, selectedDate),
        fetchDateSupplements(userId, selectedDate),
        tracksPowder() ? useProteinPowderStore.getState().fetchDate(userId, selectedDate) : null,
        fetchMealConfigs(userId),
        isToday ? useSupplementStore.getState().fetchTodaySupplements(userId) : null,
      ]);
      ok = !useFoodLogStore.getState().loadError;
    } finally {
      setRefreshing(false);
      setRefreshResult((prev) => ({ ok, id: (prev?.id ?? 0) + 1 }));
    }
  }, [userId, selectedDate, isToday]);

  const handleRetry = useCallback(() => {
    if (userId) fetchDayEntries(userId, selectedDate);
  }, [userId, selectedDate]);

  // Tap entry → open detail modal
  // Clear the edited entry after the close animation; cancel that if another entry opens first,
  // or the new one would be wiped and the editor would show nothing.
  const clearEditTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null); // React.useRef: the redesign drops the named import
  const clearEditEntrySoon = useCallback(() => {
    if (clearEditTimer.current) clearTimeout(clearEditTimer.current);
    clearEditTimer.current = setTimeout(() => setEditEntry(null), 350);
  }, []);
  useEffect(() => () => { if (clearEditTimer.current) clearTimeout(clearEditTimer.current); }, []);

  const handlePressEntry = useCallback((entry: FoodEntry) => {
    // Still saving (temporary id): nothing to edit yet.
    if (entry.id.startsWith('temp-')) return;
    if (clearEditTimer.current) clearTimeout(clearEditTimer.current);
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
    clearEditEntrySoon();
  }, []);

  // When edit detail saves, update the existing entry instead of creating new
  const handleEditSaved = useCallback(() => {
    setEditDetailVisible(false);
    clearEditEntrySoon();
  }, []);

  // The last delete, offered for a few seconds as "Deleted … · Undo".
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);
  const undoRowsRef = React.useRef<FoodEntry[]>([]); // React.useRef: the redesign drops the named import
  // A deleted (or restored) protein powder snack changes the serving count: reload it after.
  const refreshPowder = useCallback(() => {
    if (userId && tracksPowder()) useProteinPowderStore.getState().refresh(userId);
  }, [userId]);

  const offerUndo = useCallback((rows: FoodEntry[], message: string) => {
    if (rows.length === 0) return;
    undoRowsRef.current = rows;
    setUndoOffer((prev) => ({ message, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const handleUndo = useCallback(() => {
    const rows = undoRowsRef.current;
    undoRowsRef.current = [];
    setUndoOffer(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    restoreDeleted(rows).then(refreshPowder);
  }, [restoreDeleted, refreshPowder]);
  const handleUndoExpire = useCallback(() => {
    undoRowsRef.current = [];
    setUndoOffer(null);
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    const removed = useFoodLogStore.getState().entries.filter((e) => e.id === id);
    offerUndo(removed, `Deleted ${removed[0]?.name ?? 'food'}`);
    setEditDetailVisible(false);
    deleteEntry(id).then(refreshPowder);
    clearEditEntrySoon();
  }, [deleteEntry, offerUndo, refreshPowder]);

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
    const removed = useFoodLogStore.getState().entries.filter((e) => e.meal_group_id === groupId);
    offerUndo(removed, `Deleted ${removed[0]?.meal_group_name || 'meal'}`);
    deleteMealGroup(groupId).then(refreshPowder);
  }, [deleteMealGroup, offerUndo, refreshPowder]);

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
      <DateNavigator selectedDate={selectedDate} today={todayStr} onDateSelect={setDate} />
      <View style={styles.diaryPage}>
      <ScrollView
        style={styles.diaryPage}
        showsVerticalScrollIndicator={false}
        // Bounce (iOS) and stretch (Android) at the ends instead of stopping dead; iOS also
        // needs the bounce to start pull-to-refresh.
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View>
          {loadError ? (
            <TouchableOpacity style={styles.statusRow} onPress={handleRetry} activeOpacity={0.7} accessibilityRole="button">
              <Ionicons name="cloud-offline-outline" size={ms(15)} color={colors.accentOrange} />
              <Text style={styles.statusText}>Couldn't load this day. Tap to try again.</Text>
            </TouchableOpacity>
          ) : loading && entries.length === 0 && !refreshing ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.textTertiary} />
              <Text style={styles.statusText}>Loading…</Text>
            </View>
          ) : null}
          <NutritionHero entries={entries} goals={goals} />
          <HydrationStrip isToday={isToday} />
          <View style={styles.mealsGap} />
          <MealList
            entries={entries}
            onAdd={handleAddToMeal}
            onPressEntry={handlePressEntry}
            onTogglePlanned={togglePlanned}
            onDeleteEntry={handleDeleteEntry}
            onPressGroup={handlePressMealGroup}
            onDeleteGroup={handleDeleteMealGroup}
          />
        </View>
      </ScrollView>
      <RefreshBanner result={refreshResult} />
      </View>
      <AddFoodModal
        visible={addModalVisible}
        mealSlot={addMealSlot}
        targetHour={addHour}
        onDismiss={handleDismissModal}
      />
      <FoodDetailModal
        visible={editDetailVisible}
        isBackActive={isScreenFocused}
        bottomInset={sw(12)}
        food={editDetailData}
        initialMealSlot={editEntry?.meal_type || 'breakfast'}
        initialIsPlanned={editEntry?.is_planned || false}
        initialQuantity={editEntry?.quantity || 1}
        onDismiss={handleEditDismiss}
        onAdded={handleEditSaved}
        editEntryId={editEntry?.id}
        onDelete={handleDeleteEntry}
      />
      <CreateMealModal
        visible={editGroupModalVisible}
        isBackActive={isScreenFocused}
        mealSlot={addMealSlot}
        targetHour={addHour}
        onDismiss={handleDismissGroupEdit}
        onLogged={handleGroupEditLogged}
        editMealGroupId={editGroupId}
        editMealGroupEntries={editGroupEntries}
        bottomInset={sw(12)}
      />
      <UndoBanner offer={undoOffer} onUndo={handleUndo} onExpire={handleUndoExpire} />
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginHorizontal: sw(16),
    marginTop: sw(8),
    paddingHorizontal: sw(12),
    paddingVertical: sw(10),
    borderRadius: sw(12),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statusText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
  },
  mealsGap: {
    height: sw(12),
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
