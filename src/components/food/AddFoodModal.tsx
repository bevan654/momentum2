import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSavedMealsStore, type SavedMeal } from '../../stores/useSavedMealsStore';
import { useFavouritesStore } from '../../stores/useFavouritesStore';
import type { FoodCatalogItem } from '../../stores/useFoodLogStore';
import FoodDetailModal from './FoodDetailModal';
import type { FoodDetailData } from './FoodDetailModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import CreateMealModal from './CreateMealModal';
import QuickAddModal from './QuickAddModal';
import BottomSheet from '../workout-sheet/BottomSheet';

/* ─── Props ──────────────────────────────────────────── */

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
}

/* ─── Catalog row (extracted) ─────────────────────────── */

interface CatalogRowProps {
  item: FoodCatalogItem;
  onSelect: (item: FoodCatalogItem) => void;
  s: ReturnType<typeof createStyles>;
  c: ThemeColors;
}

const CatalogRow = React.memo(function CatalogRow({ item, onSelect, s, c }: CatalogRowProps) {
  const isFav = useFavouritesStore((st) => st.isFavourite(item));
  const addFav = useFavouritesStore((st) => st.addFavourite);
  const removeFav = useFavouritesStore((st) => st.removeFavourite);

  const handleSelect = useCallback(() => onSelect(item), [item, onSelect]);
  const toggleFav = useCallback(() => {
    if (isFav) removeFav(item);
    else addFav(item);
  }, [isFav, item, addFav, removeFav]);

  return (
    <View style={s.catalogRow}>
      <TouchableOpacity style={s.catalogRowBody} onPress={handleSelect} activeOpacity={0.7}>
        <View style={s.catalogInfo}>
          <View style={s.catalogNameRow}>
            <Text style={s.catalogName} numberOfLines={1}>{item.name}</Text>
            {item.confidence === 'verified' && (
              <Ionicons name="checkmark-circle" size={ms(12)} color={c.accentGreen} />
            )}
          </View>
          {item.brand ? <Text style={s.catalogBrand} numberOfLines={1}>{item.brand}</Text> : null}
          <View style={s.catalogMacros}>
            <Text style={[s.catalogMacro, { color: c.protein }]}>P {Math.round(item.protein)}</Text>
            <Text style={[s.catalogMacro, { color: c.carbs }]}>C {Math.round(item.carbs)}</Text>
            <Text style={[s.catalogMacro, { color: c.fat }]}>F {Math.round(item.fat)}</Text>
            <Text style={s.catalogServing}>{item.serving_size}{item.serving_unit}</Text>
          </View>
        </View>
        <View style={s.catalogRight}>
          <Text style={s.catalogCal}>{Math.round(item.calories)}</Text>
          <Text style={s.catalogCalUnit}>kcal</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={toggleFav} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} style={s.favBtn}>
        <Ionicons
          name={isFav ? 'heart' : 'heart-outline'}
          size={ms(16)}
          color={isFav ? c.accentRed : c.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );
});

/* ─── Main component ─────────────────────────────────── */

export default function AddFoodModal({ visible, mealSlot, targetHour, onDismiss }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  /* ── Store selectors ───────────────────────────────── */
  const userId = useAuthStore((s) => s.user?.id);
  const catalogResults = useFoodLogStore((s) => s.catalogResults);
  const catalogLoading = useFoodLogStore((s) => s.catalogLoading);
  const searchCatalog = useFoodLogStore((s) => s.searchCatalog);
  const clearSearch = useFoodLogStore((s) => s.clearSearch);
  const recentFoods = useFoodLogStore((s) => s.recentFoods);
  const popularFoods = useFoodLogStore((s) => s.popularFoods);
  const fetchDefaultFoods = useFoodLogStore((s) => s.fetchDefaultFoods);

  /* ── Local state ───────────────────────────────────── */
  const [query, setQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sub-modals
  const [detailFood, setDetailFood] = useState<FoodDetailData | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);
  const [createMealVisible, setCreateMealVisible] = useState(false);
  const [selectedSavedMeal, setSelectedSavedMeal] = useState<SavedMeal | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  // Saved meals
  const savedMeals = useSavedMealsStore((st) => st.meals);
  const loadSavedMeals = useSavedMealsStore((st) => st.loadMeals);
  const deleteSavedMeal = useSavedMealsStore((st) => st.deleteMeal);

  // Favourites
  const favourites = useFavouritesStore((st) => st.favourites);
  const loadFavourites = useFavouritesStore((st) => st.loadFavourites);

  // Default tab (popular / recent / favourites / meals)
  const [defaultTab, setDefaultTab] = useState<'popular' | 'recent' | 'favourites' | 'meals'>('recent');

  /* ── Load defaults + saved meals + favourites on open ──── */
  useEffect(() => {
    if (visible && userId) fetchDefaultFoods(userId);
    if (visible) { loadSavedMeals(); loadFavourites(); }
  }, [visible, userId]);

  /* ── Reset on close ────────────────────────────────── */
  useEffect(() => {
    if (!visible) {
      if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
      setQuery('');
      clearSearch();
      setDetailFood(null);
      setDetailVisible(false);
      setScannerVisible(false);
      setScanNotFound(null);
      setCreateMealVisible(false);
      setSelectedSavedMeal(null);
      setQuickAddVisible(false);
      setDefaultTab('recent');
    }
  }, [visible]);

  /* ── Search ────────────────────────────────────────── */
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchCatalog(text), 300);
  }, [searchCatalog]);

  /* ── Select catalog item → detail ──────────────────── */
  const handleSelectItem = useCallback((item: FoodCatalogItem) => {
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

  /* ── Detail / scanner callbacks ────────────────────── */
  const handleDetailDismiss = useCallback(() => { setDetailVisible(false); setDetailFood(null); }, []);
  const handleDetailAdded = useCallback(() => { setDetailVisible(false); setDetailFood(null); onDismiss(); }, [onDismiss]);
  const handleOpenScanner = useCallback(() => { setScanNotFound(null); setScannerVisible(true); }, []);
  const handleScanDismiss = useCallback(() => setScannerVisible(false), []);
  const handleScanFound = useCallback((food: FoodDetailData) => {
    setScannerVisible(false); setDetailFood(food); setDetailVisible(true);
  }, []);
  const handleScanNotFound = useCallback(() => {
    setScannerVisible(false); setScanNotFound('Product not found. Try searching manually.');
  }, []);

  /* ── Create meal callbacks ──────────────────────────── */
  const handleOpenCreateMeal = useCallback(() => {
    setSelectedSavedMeal(null);
    setCreateMealVisible(true);
  }, []);
  const handleOpenSavedMeal = useCallback((meal: SavedMeal) => {
    setSelectedSavedMeal(meal);
    setCreateMealVisible(true);
  }, []);
  const handleCreateMealDismiss = useCallback(() => {
    setCreateMealVisible(false);
    setSelectedSavedMeal(null);
  }, []);
  const handleMealLogged = useCallback(() => {
    setCreateMealVisible(false);
    setSelectedSavedMeal(null);
    onDismiss();
  }, [onDismiss]);

  /* ── Quick Add callbacks ────────────────────────────── */
  const handleOpenQuickAdd = useCallback(() => setQuickAddVisible(true), []);
  const handleQuickAddDismiss = useCallback(() => setQuickAddVisible(false), []);
  const handleQuickAdded = useCallback(() => {
    setQuickAddVisible(false);
    onDismiss();
  }, [onDismiss]);

  /* ── Search results list data ────────────────────────── */
  const showResults = query.length > 0 && catalogResults.length > 0;
  const showEmpty = query.length > 0 && catalogResults.length === 0 && !catalogLoading;
  const hasRecent = recentFoods.length > 0;
  const hasPopular = popularFoods.length > 0;
  const hasSavedMeals = savedMeals.length > 0;
  const hasFavourites = favourites.length > 0;
  const showDefaults = query.length === 0 && (hasRecent || hasPopular || hasSavedMeals || hasFavourites);

  /* ── Render ────────────────────────────────────────── */
  return (
    <BottomSheet visible={visible} onClose={onDismiss} height="92%" modal>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Log Food</Text>
          </View>

          {/* Action buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpenCreateMeal} activeOpacity={0.7}>
              <Ionicons name="restaurant-outline" size={ms(20)} color={colors.accent} />
              <Text style={s.actionBtnText}>Make A Meal</Text>
              <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpenScanner} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={ms(20)} color={colors.accent} />
              <Text style={s.actionBtnText}>Scan a meal</Text>
              <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpenQuickAdd} activeOpacity={0.7}>
              <Ionicons name="flash-outline" size={ms(20)} color={colors.accent} />
              <Text style={s.actionBtnText}>Quick Add</Text>
              <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={[s.actionBtn, s.actionBtnDisabled]}>
              <Ionicons name="document-text-outline" size={ms(20)} color={colors.textTertiary} />
              <Text style={[s.actionBtnText, { color: colors.textTertiary }]} numberOfLines={1}>Label Scanner</Text>
            </View>
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
              autoFocus={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); clearSearch(); }} hitSlop={8} style={s.searchClearBtn}>
                <Ionicons name="close" size={ms(12)} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          {query.length === 0 && (
            <View style={s.chipRow}>
              {([
                { key: 'recent' as const, label: 'Recent', icon: 'time-outline' as const },
                { key: 'popular' as const, label: 'Popular', icon: 'trending-up-outline' as const },
                { key: 'favourites' as const, label: 'Favs', icon: 'heart-outline' as const },
                { key: 'meals' as const, label: 'Meals', icon: 'restaurant-outline' as const },
              ]).map((tab) => {
                const active = defaultTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setDefaultTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={ms(14)}
                      color={active ? colors.textOnAccent : colors.textSecondary}
                    />
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Not-found banner */}
          {scanNotFound && (
            <View style={s.notFoundBanner}>
              <Ionicons name="alert-circle-outline" size={ms(15)} color={colors.textOnAccent} />
              <Text style={s.notFoundText}>{scanNotFound}</Text>
              <TouchableOpacity onPress={() => setScanNotFound(null)}>
                <Ionicons name="close" size={ms(15)} color={colors.textOnAccent} />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          {catalogLoading ? (
            <View style={s.centerState}>
              <Text style={s.emptyText}>Searching...</Text>
            </View>
          ) : showEmpty ? (
            <View style={s.centerState}>
              <Ionicons name="search-outline" size={ms(32)} color={colors.textTertiary} />
              <Text style={s.emptyText}>No results found</Text>
            </View>
          ) : !showResults && !showDefaults ? (
            <View style={s.centerState}>
              <Ionicons name="nutrition-outline" size={ms(32)} color={colors.textTertiary} />
              <Text style={s.emptyText}>Search for foods to add</Text>
            </View>
          ) : (
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {showResults && catalogResults.map((item, i) => (
                <CatalogRow key={item.id + i} item={item} onSelect={handleSelectItem} s={s} c={colors} />
              ))}
              {showDefaults && (
                <>
                  {defaultTab === 'meals' && hasSavedMeals && savedMeals.map((meal) => {
                    const totalCal = Math.round(meal.items.reduce((sum, i) => sum + i.calories * i.quantity, 0));
                    const totalP = Math.round(meal.items.reduce((sum, i) => sum + i.protein * i.quantity, 0));
                    const totalC = Math.round(meal.items.reduce((sum, i) => sum + i.carbs * i.quantity, 0));
                    const totalF = Math.round(meal.items.reduce((sum, i) => sum + i.fat * i.quantity, 0));
                    return (
                      <TouchableOpacity
                        key={meal.id}
                        style={s.savedMealCard}
                        onPress={() => handleOpenSavedMeal(meal)}
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
                          <Text style={s.catalogCal}>{totalCal}</Text>
                          <Text style={s.catalogCalUnit}>kcal</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={ms(16)} color={colors.textTertiary} />
                      </TouchableOpacity>
                    );
                  })}
                  {defaultTab === 'meals' && !hasSavedMeals && (
                    <View style={s.tabEmptyState}>
                      <Ionicons name="restaurant-outline" size={ms(28)} color={colors.textTertiary} />
                      <Text style={s.emptyText}>No saved meals yet</Text>
                      <Text style={s.emptySubtext}>Use "Make A Meal" to create and save meals</Text>
                    </View>
                  )}
                  {defaultTab === 'recent' && hasRecent && recentFoods.map((item, i) => (
                    <CatalogRow key={`r-${item.id}-${i}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                  ))}
                  {defaultTab === 'recent' && !hasRecent && (
                    <View style={s.tabEmptyState}>
                      <Text style={s.emptyText}>No recent foods yet</Text>
                    </View>
                  )}
                  {defaultTab === 'popular' && hasPopular && popularFoods.map((item) => (
                    <CatalogRow key={`p-${item.id}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                  ))}
                  {defaultTab === 'favourites' && hasFavourites && favourites.map((item, i) => (
                    <CatalogRow key={`fav-${item.id}-${i}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                  ))}
                  {defaultTab === 'favourites' && !hasFavourites && (
                    <View style={s.tabEmptyState}>
                      <Ionicons name="heart-outline" size={ms(28)} color={colors.textTertiary} />
                      <Text style={s.emptyText}>No favourites yet</Text>
                      <Text style={s.emptySubtext}>Tap the heart on any food to save it here</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>

      {detailVisible && (
        <FoodDetailModal
          visible={detailVisible}
          food={detailFood}
          initialMealSlot={mealSlot}
          initialIsPlanned={false}
          targetHour={targetHour}
          onDismiss={handleDetailDismiss}
          onAdded={handleDetailAdded}
          onFoodSwap={setDetailFood}
        />
      )}
      {scannerVisible && (
        <BarcodeScannerModal
          visible={scannerVisible}
          onDismiss={handleScanDismiss}
          onFoodFound={handleScanFound}
          onNotFound={handleScanNotFound}
        />
      )}
      {createMealVisible && (
        <CreateMealModal
          visible={createMealVisible}
          mealSlot={mealSlot}
          targetHour={targetHour}
          onDismiss={handleCreateMealDismiss}
          onLogged={handleMealLogged}
          initialMeal={selectedSavedMeal}
        />
      )}
      {quickAddVisible && (
        <QuickAddModal
          visible={quickAddVisible}
          mealSlot={mealSlot}
          targetHour={targetHour}
          onDismiss={handleQuickAddDismiss}
          onAdded={handleQuickAdded}
        />
      )}
    </BottomSheet>
  );
}

/* ─── Styles ─────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  /* Header */
  header: {
    alignItems: 'center',
    paddingHorizontal: sw(12),
    marginBottom: sw(16),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: sw(16),
    gap: sw(10),
    marginBottom: sw(12),
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(16),
    paddingHorizontal: sw(14),
    borderRadius: sw(14),
    backgroundColor: colors.card,
    ...colors.cardShadow,
  },
  actionBtnActive: {
    borderWidth: 1.5,
    borderColor: colors.accentRed + '40',
    backgroundColor: colors.accentRed + '08',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  /* Search */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    marginHorizontal: sw(16),
    paddingHorizontal: sw(14),
    height: sw(46),
    gap: sw(10),
    marginBottom: sw(14),
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
  /* Filter chips */
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: sw(16),
    gap: sw(8),
    marginBottom: sw(12),
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(4),
    paddingVertical: sw(8),
    borderRadius: sw(20),
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  chipTextActive: {
    color: colors.textOnAccent,
  },
  tabEmptyState: {
    alignItems: 'center',
    paddingVertical: sw(32),
  },
  /* Not-found banner */
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentOrange,
    marginHorizontal: sw(16),
    marginBottom: sw(10),
    borderRadius: sw(10),
    paddingHorizontal: sw(12),
    paddingVertical: sw(10),
    gap: sw(8),
  },
  notFoundText: {
    flex: 1,
    color: colors.textOnAccent,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  /* List */
  listContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(40),
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: sw(12),
    marginBottom: sw(6),
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(12),
    paddingRight: sw(4),
    marginBottom: sw(6),
  },
  catalogRowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(12),
    paddingLeft: sw(14),
    paddingRight: sw(6),
    gap: sw(10),
  },
  catalogInfo: { flex: 1, gap: sw(2) },
  catalogNameRow: { flexDirection: 'row', alignItems: 'center', gap: sw(4) },
  catalogName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  catalogBrand: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
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
  favBtn: {
    padding: sw(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogCal: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.extraBold,
  },
  catalogCalUnit: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
  },
  /* Saved meals */
  savedMealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(12),
    paddingVertical: sw(12),
    paddingHorizontal: sw(14),
    gap: sw(10),
    marginBottom: sw(6),
  },
  savedMealInfo: { flex: 1, gap: sw(4) },
  savedMealName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  savedMealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  savedMealItems: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  savedMealMacros: {
    flexDirection: 'row',
    gap: sw(6),
  },
  /* Empty states */
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  emptySubtext: {
    color: colors.textTertiary + '80',
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.regular,
    textAlign: 'center',
    paddingHorizontal: sw(40),
  },
});
