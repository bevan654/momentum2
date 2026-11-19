import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { findMealConfig } from './groupEntriesByMeal';
import { useKeyboardInset } from './ui/useKeyboardInset';

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
function AddFoodModal({ visible, mealSlot, targetHour, onDismiss }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const userId = useAuthStore((st) => st.user?.id);
  const catalogResults = useFoodLogStore((st) => st.catalogResults);
  const catalogLoading = useFoodLogStore((st) => st.catalogLoading);
  const searchCatalog = useFoodLogStore((st) => st.searchCatalog);
  const clearSearch = useFoodLogStore((st) => st.clearSearch);
  const recentFoods = useFoodLogStore((st) => st.recentFoods);
  const popularFoods = useFoodLogStore((st) => st.popularFoods);
  const fetchDefaultFoods = useFoodLogStore((st) => st.fetchDefaultFoods);
  const mealLabel = useFoodLogStore((st) => findMealConfig(st.mealConfigs, mealSlot)?.label);
  const savedMeals = useSavedMealsStore((st) => st.meals);
  const loadSavedMeals = useSavedMealsStore((st) => st.loadMeals);
  const favourites = useFavouritesStore((st) => st.favourites);
  const loadFavourites = useFavouritesStore((st) => st.loadFavourites);

  const [query, setQuery] = useState('');
  /** The text the last search ran for (set after the debounce): the results are grouped by it,
   *  so typing doesn't rebuild the whole list on every keystroke. */
  const [searchedQuery, setSearchedQuery] = useState('');
  const [tab, setTab] = useState<AddFoodTab>('home');
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while the 300 ms debounce waits, so "No results" doesn't flash before the search starts.
  const [searchPending, setSearchPending] = useState(false);
  const ai = useAiFoodSearch(query);

  // Child screens
  const [detailFood, setDetailFood] = useState<FoodDetailData | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [macroLensVisible, setMacroLensVisible] = useState(false);
  // Once opened, MacroLens stays mounted (hidden) so the items left from a scan can still be
  // logged without another scan; it drops them itself after a while.
  const [lensMounted, setLensMounted] = useState(false);
  const [scanNotFound, setScanNotFound] = useState<string | null>(null);
  const [createMealVisible, setCreateMealVisible] = useState(false);
  const [selectedSavedMeal, setSelectedSavedMeal] = useState<SavedMeal | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  // Only track the keyboard while this sheet is open and no child screen covers it.
  const kbInset = useKeyboardInset(
    visible && !detailVisible && !scannerVisible && !macroLensVisible && !createMealVisible && !quickAddVisible,
  );
  // Above the home indicator normally; just above the keyboard when it's open.
  const kbOpen = kbInset.open;
  // Plain numbers worked out here: sw() isn't a worklet, so it can't run inside the animated style.
  const deepBase = sw(16);
  const deepRest = deepBase + insets.bottom;
  const deepBtnStyle = useAnimatedStyle(() => ({ bottom: kbOpen.value ? deepBase : deepRest }));
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
    setSearchPending(false);
    setQuery('');
    setSearchedQuery('');
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
    setSearchPending(text.trim().length >= 2);
    searchTimer.current = setTimeout(() => {
      setSearchPending(false);
      setSearchedQuery(text);
      searchCatalog(text);
      searchCache(text);
    }, 300);
  }, [searchCatalog, searchCache]);

  const handleClearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchPending(false);
    setQuery('');
    setSearchedQuery('');
    clearSearch();
    clearCache();
  }, [clearSearch, clearCache]);

  // Search results in two groups: the user's own foods (favourites and foods they've logged
  // that match), then everything else (catalog, other users' foods, earlier AI estimates).
  // A Deep Search answer is shown on its own.
  const { myResults, results } = useMemo(() => {
    if (ai.showAiResults) return { myResults: [] as FoodCatalogItem[], results: ai.aiResults };
    const q = searchedQuery.trim().toLowerCase();
    const seen = new Set<string>();
    const mine: FoodCatalogItem[] = [];
    for (const f of favourites) {
      const key = f.name.toLowerCase();
      if (q.length >= 2 && key.includes(q) && !seen.has(key)) { seen.add(key); mine.push(f); }
    }
    const others: FoodCatalogItem[] = [];
    for (const r of catalogResults) {
      const key = r.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (r.confidence === 'user' ? mine : others).push(r);
    }
    for (const r of ai.cachedResults) {
      const key = r.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      others.push(r);
    }
    return { myResults: mine, results: others };
  }, [ai.showAiResults, ai.aiResults, ai.cachedResults, catalogResults, favourites, searchedQuery]);

  /* ── Child screens ────────────────────────────────── */
  const openDetail = useCallback((food: FoodDetailData) => { setDetailFood(food); setDetailVisible(true); }, []);
  const handleSelectFood = useCallback((item: FoodCatalogItem) => openDetail(catalogToDetail(item)), [openDetail]);
  const handleDetailDismiss = useCallback(() => { setDetailVisible(false); setDetailFood(null); }, []);
  const handleDetailAdded = useCallback(() => { setDetailVisible(false); setDetailFood(null); onDismiss(); }, [onDismiss]);

  const handleOpenScanner = useCallback(() => { setScanNotFound(null); setScannerVisible(true); }, []);
  const handleScanDismiss = useCallback(() => setScannerVisible(false), []);
  const handleScanFound = useCallback((food: FoodDetailData) => { setScannerVisible(false); openDetail(food); }, [openDetail]);
  const handleScanNotFound = useCallback((_barcode: string, failed?: boolean) => {
    setScannerVisible(false);
    setScanNotFound(failed
      ? "Couldn't look up that barcode. Check your connection and try again."
      : 'Product not found. Try searching for it instead.');
  }, []);

  const handleOpenLens = useCallback(() => { setScanNotFound(null); setLensMounted(true); setMacroLensVisible(true); }, []);
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
  // Searches need 2 characters; with 1, keep showing the normal lists instead of "No results".
  const searching = query.trim().length >= 2;
  const { showAiResults, hideAiResults, aiError } = ai;
  const listHeader = useMemo(() => (
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
      {searching && showAiResults && (
        <View style={s.aiBox}>
          <View style={s.aiTop}>
            <View style={s.aiBadge}>
              <Ionicons name="sparkles" size={ms(11)} color={colors.accent} />
              <Text style={s.aiBadgeText}>AI estimates</Text>
            </View>
            <Pressable onPress={hideAiResults} hitSlop={8} accessibilityRole="button">
              <Text style={s.aiBack}>Back to results</Text>
            </Pressable>
          </View>
          <Text style={s.aiNote}>
            Approximate nutrition values, not professional dietary advice. Check before tracking.
            Long-press any result to report it.
          </Text>
        </View>
      )}
      {searching && !!aiError && (
        <View style={[s.banner, s.bannerInfo]}>
          <Ionicons name="information-circle-outline" size={ms(15)} color={colors.textSecondary} />
          <Text style={s.bannerText}>{aiError}</Text>
        </View>
      )}
    </View>
  ), [s, colors, searching, tab, scanNotFound, showAiResults, hideAiResults, aiError,
    handleOpenScanner, handleOpenLens, handleOpenQuickAdd, handleOpenCreateMeal]);

  const showDeepSearch = deepSearchEnabled && query.trim().length > 0 && !ai.showAiResults && !ai.aiSearching;

  return (
    <Sheet visible={visible} onClose={onDismiss} height="95%">
      <Animated.View ref={kbInset.ref} style={[s.flex, kbInset.style]}>
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
            searching={searching}
            tab={tab}
            loading={catalogLoading || ai.aiSearching || searchPending}
            myResults={myResults}
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
            bottomPadding={showDeepSearch ? sw(80) + insets.bottom : sw(40) + insets.bottom}
          />
          {/* Inside the list's view, so it rises with the keyboard instead of hiding under it. */}
          {(showDeepSearch || (searching && ai.aiSearching)) && (
            <Animated.View style={[s.deepWrap, deepBtnStyle]} pointerEvents="box-none">
              <Pressable
                style={({ pressed }) => [s.deepBtn, pressed && s.pressed]}
                onPress={ai.deepSearch}
                disabled={ai.aiSearching}
                accessibilityRole="button"
                accessibilityLabel={ai.aiSearching ? 'Deep Search running' : 'Deep Search with AI'}
                accessibilityState={{ busy: ai.aiSearching }}
              >
                {ai.aiSearching
                  ? <ActivityIndicator size="small" color={colors.textOnAccent} />
                  : <Ionicons name="sparkles" size={ms(15)} color={colors.textOnAccent} />}
                <Text style={s.deepText}>{ai.aiSearching ? 'Asking AI…' : 'Deep Search'}</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Animated.View>

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
      {lensMounted && (
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
    deepWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    deepBtn: {
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

export default React.memo(AddFoodModal);
