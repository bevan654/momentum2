import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, KeyboardAvoidingView, Alert, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore, type FoodCatalogItem } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSavedMealsStore, type SavedMeal } from '../../stores/useSavedMealsStore';
import { useFavouritesStore } from '../../stores/useFavouritesStore';
import FoodDetailModal, { type FoodDetailData } from './FoodDetailModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import MacroLensModal from './MacroLensModal';
import CreateMealModal from './CreateMealModal';
import QuickAddModal from './QuickAddModal';
import Sheet from '../ui/Sheet';
import ReportSheet from '../friends/ReportSheet';
import { supabase } from '../../lib/supabase';
import { makeUuid } from '../../utils/uuid';
import FoodSheetHeader from './ui/FoodSheetHeader';
import FoodSearchBar from './ui/FoodSearchBar';
import FoodSegmentChips, { type SegmentOption } from './ui/FoodSegmentChips';
import AddFoodActions from './AddFoodActions';
import AddFoodResults, { type AddFoodTab } from './AddFoodResults';
import { useAiFoodSearch } from './useAiFoodSearch';
import { catalogToDetail } from './foodMapping';

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
}

const TABS: SegmentOption<AddFoodTab>[] = [
  { key: 'home', label: 'For you', icon: 'sparkles-outline' },
  { key: 'favourites', label: 'Favourites', icon: 'heart-outline' },
  { key: 'meals', label: 'Meals', icon: 'restaurant-outline' },
];

/**
 * Log Food sheet: search (catalog + shared AI estimates, optional Deep Search), recent /
 * popular / favourite foods and saved meals, plus barcode, MacroLens, Quick add and Make a meal.
 * Every child screen that logs something closes this sheet too.
 */
export default function AddFoodModal({ visible, mealSlot, targetHour, onDismiss }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((st) => st.user?.id);
  const catalogResults = useFoodLogStore((st) => st.catalogResults);
  const catalogLoading = useFoodLogStore((st) => st.catalogLoading);
  const searchCatalog = useFoodLogStore((st) => st.searchCatalog);
  const clearSearch = useFoodLogStore((st) => st.clearSearch);
  const recentFoods = useFoodLogStore((st) => st.recentFoods);
  const popularFoods = useFoodLogStore((st) => st.popularFoods);
  const fetchDefaultFoods = useFoodLogStore((st) => st.fetchDefaultFoods);
  const mealLabel = useFoodLogStore((st) => st.mealConfigs.find((m) => m.slot === mealSlot)?.label);
  const savedMeals = useSavedMealsStore((st) => st.meals);
  const loadSavedMeals = useSavedMealsStore((st) => st.loadMeals);
  const favourites = useFavouritesStore((st) => st.favourites);
  const loadFavourites = useFavouritesStore((st) => st.loadFavourites);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<AddFoodTab>('home');
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ai = useAiFoodSearch(query);

  // Child screens
  const [detailFood, setDetailFood] = useState<FoodDetailData | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [macroLensVisible, setMacroLensVisible] = useState(false);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);
  const [createMealVisible, setCreateMealVisible] = useState(false);
  const [selectedSavedMeal, setSelectedSavedMeal] = useState<SavedMeal | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; content: string } | null>(null);

  /* ── Open / close ─────────────────────────────────── */
  // Deep Search is per-user (feature_flags); re-checked on each open.
  useEffect(() => {
    if (!visible || !userId) return;
    supabase
      .from('feature_flags')
      .select('enabled')
      .eq('user_id', userId)
      .eq('flag', 'deep_search')
      .maybeSingle()
      .then(({ data }) => setDeepSearchEnabled(data?.enabled === true), () => setDeepSearchEnabled(false));
  }, [visible, userId]);

  useEffect(() => {
    if (visible && userId) fetchDefaultFoods(userId);
    if (visible) { loadSavedMeals(); loadFavourites(); }
  }, [visible, userId]);

  useEffect(() => {
    if (visible) return;
    if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
    setQuery('');
    clearSearch();
    ai.clearCache();
    setDetailFood(null);
    setDetailVisible(false);
    setScannerVisible(false);
    setMacroLensVisible(false);
    setScanNotFound(null);
    setCreateMealVisible(false);
    setSelectedSavedMeal(null);
    setQuickAddVisible(false);
    setTab('home');
  }, [visible]);

  /* ── Search ───────────────────────────────────────── */
  const { searchCache, clearCache } = ai;
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchCatalog(text);
      searchCache(text);
    }, 300);
  }, [searchCatalog, searchCache]);

  const handleClearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery('');
    clearSearch();
    clearCache();
  }, [clearSearch, clearCache]);

  // Catalog first, then earlier AI estimates not already in the catalog (by name).
  const results = useMemo(() => {
    if (ai.showAiResults) return ai.aiResults;
    if (ai.cachedResults.length === 0) return catalogResults;
    const seen = new Set(catalogResults.map((r) => r.name.toLowerCase()));
    return [...catalogResults, ...ai.cachedResults.filter((r) => !seen.has(r.name.toLowerCase()))];
  }, [ai.showAiResults, ai.aiResults, ai.cachedResults, catalogResults]);

  /* ── Child screens ────────────────────────────────── */
  const openDetail = useCallback((food: FoodDetailData) => { setDetailFood(food); setDetailVisible(true); }, []);
  const handleSelectFood = useCallback((item: FoodCatalogItem) => openDetail(catalogToDetail(item)), [openDetail]);
  const handleDetailDismiss = useCallback(() => { setDetailVisible(false); setDetailFood(null); }, []);
  const handleDetailAdded = useCallback(() => { setDetailVisible(false); setDetailFood(null); onDismiss(); }, [onDismiss]);

  const handleOpenScanner = useCallback(() => { setScanNotFound(null); setScannerVisible(true); }, []);
  const handleScanDismiss = useCallback(() => setScannerVisible(false), []);
  const handleScanFound = useCallback((food: FoodDetailData) => { setScannerVisible(false); openDetail(food); }, [openDetail]);
  const handleScanNotFound = useCallback(() => {
    setScannerVisible(false);
    setScanNotFound('Product not found. Try searching for it instead.');
  }, []);

  const handleOpenLens = useCallback(() => { setScanNotFound(null); setMacroLensVisible(true); }, []);
  const handleLensDismiss = useCallback(() => setMacroLensVisible(false), []);
  const handleLensFound = useCallback((food: FoodDetailData) => { setMacroLensVisible(false); openDetail(food); }, [openDetail]);

  const handleOpenCreateMeal = useCallback(() => { setSelectedSavedMeal(null); setCreateMealVisible(true); }, []);
  const handleOpenSavedMeal = useCallback((meal: SavedMeal) => { setSelectedSavedMeal(meal); setCreateMealVisible(true); }, []);
  const handleCreateMealDismiss = useCallback(() => { setCreateMealVisible(false); setSelectedSavedMeal(null); }, []);
  const handleMealLogged = useCallback(() => {
    setCreateMealVisible(false);
    setSelectedSavedMeal(null);
    onDismiss();
  }, [onDismiss]);

  const handleOpenQuickAdd = useCallback(() => setQuickAddVisible(true), []);
  const handleQuickAddDismiss = useCallback(() => setQuickAddVisible(false), []);
  const handleQuickAdded = useCallback(() => { setQuickAddVisible(false); onDismiss(); }, [onDismiss]);

  const handleReportAi = useCallback((item: FoodCatalogItem) => {
    Alert.alert(
      'Report this estimate?',
      `Tell us if "${item.name}" is wildly inaccurate or inappropriate. We review every report and act within 24 hours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            const summary = `${item.name}${item.brand ? ` (${item.brand})` : ''}\n` +
              `Per ${item.serving_size}${item.serving_unit}: ` +
              `${Math.round(item.calories)} kcal, P${Math.round(item.protein)} ` +
              `C${Math.round(item.carbs)} F${Math.round(item.fat)}`;
            setReportTarget({ id: makeUuid(), content: summary });
          },
        },
      ],
    );
  }, []);
  const handleCloseReport = useCallback(() => setReportTarget(null), []);

  /* ── List header: actions, tabs, banners ──────────── */
  const searching = query.length > 0;
  const listHeader = (
    <View style={s.listHeader}>
      {!searching && (
        <>
          <AddFoodActions onScan={handleOpenScanner} onLens={handleOpenLens} onQuickAdd={handleOpenQuickAdd} onMeal={handleOpenCreateMeal} />
          <FoodSegmentChips options={TABS} value={tab} onChange={setTab} />
        </>
      )}
      {!!scanNotFound && (
        <View style={[s.banner, s.bannerWarn]}>
          <Ionicons name="alert-circle-outline" size={ms(15)} color={colors.accentOrange} />
          <Text style={s.bannerText}>{scanNotFound}</Text>
          <Pressable onPress={() => setScanNotFound(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Ionicons name="close" size={ms(15)} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}
      {searching && ai.showAiResults && (
        <View style={s.aiBox}>
          <View style={s.aiTop}>
            <View style={s.aiBadge}>
              <Ionicons name="sparkles" size={ms(11)} color={colors.accent} />
              <Text style={s.aiBadgeText}>AI estimates</Text>
            </View>
            <Pressable onPress={ai.hideAiResults} hitSlop={8} accessibilityRole="button">
              <Text style={s.aiBack}>Back to results</Text>
            </Pressable>
          </View>
          <Text style={s.aiNote}>
            Approximate nutrition values, not professional dietary advice. Check before tracking.
            Long-press any result to report it.
          </Text>
        </View>
      )}
      {searching && !!ai.aiError && (
        <View style={[s.banner, s.bannerInfo]}>
          <Ionicons name="information-circle-outline" size={ms(15)} color={colors.textSecondary} />
          <Text style={s.bannerText}>{ai.aiError}</Text>
        </View>
      )}
    </View>
  );

  const showDeepSearch = deepSearchEnabled && query.trim().length > 0 && !ai.showAiResults && !ai.aiSearching;

  return (
    <Sheet visible={visible} onClose={onDismiss} height="95%">
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FoodSheetHeader
          title="Log food"
          subtitle={mealLabel ? `to ${mealLabel}` : undefined}
          leading="close"
          onLeading={onDismiss}
        />
        <FoodSearchBar
          value={query}
          onChangeText={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search foods and brands"
        />
        <View style={s.flex}>
          <AddFoodResults
            query={query}
            tab={tab}
            loading={catalogLoading || ai.aiSearching}
            results={results}
            aiMode={ai.showAiResults}
            recentFoods={recentFoods}
            popularFoods={popularFoods}
            favourites={favourites}
            savedMeals={savedMeals}
            header={listHeader}
            onSelectFood={handleSelectFood}
            onReportAi={handleReportAi}
            onOpenSavedMeal={handleOpenSavedMeal}
          />
        </View>
        {showDeepSearch && (
          <Pressable
            style={({ pressed }) => [s.deepBtn, pressed && s.pressed]}
            onPress={ai.deepSearch}
            accessibilityRole="button"
            accessibilityLabel="Deep Search with AI"
          >
            <Ionicons name="sparkles" size={ms(15)} color={colors.textOnAccent} />
            <Text style={s.deepText}>Deep Search</Text>
          </Pressable>
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
      {macroLensVisible && (
        <MacroLensModal visible={macroLensVisible} onDismiss={handleLensDismiss} onFoodFound={handleLensFound} />
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

      <ReportSheet
        visible={!!reportTarget}
        onClose={handleCloseReport}
        targetType="ai_message"
        targetId={reportTarget?.id ?? ''}
        targetUserId={null}
        contextLabel="AI food estimate"
        contextText={reportTarget?.content}
      />
    </Sheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },
    listHeader: {
      gap: sw(12),
      paddingTop: sw(12),
      paddingBottom: sw(4),
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
    },
    bannerWarn: {
      backgroundColor: colors.accentOrange + '1A',
      borderColor: colors.accentOrange + '40',
    },
    bannerInfo: {
      backgroundColor: colors.surface,
      borderColor: colors.cardBorder,
    },
    bannerText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(17),
      fontFamily: Fonts.medium,
    },
    aiBox: {
      marginHorizontal: sw(16),
      padding: sw(12),
      gap: sw(6),
      borderRadius: sw(14),
      backgroundColor: colors.accent + '14',
      borderWidth: 1,
      borderColor: colors.accent + '33',
    },
    aiTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
    },
    aiBadgeText: {
      color: colors.accent,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
    },
    aiBack: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    aiNote: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(16),
      fontFamily: Fonts.regular,
    },
    deepBtn: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: sw(20),
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(7),
      paddingHorizontal: sw(20),
      paddingVertical: sw(12),
      borderRadius: sw(999),
      backgroundColor: colors.accent,
      ...colors.cardShadow,
    },
    deepText: {
      color: colors.textOnAccent,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.bold,
    },
  });
