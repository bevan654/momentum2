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
  ActivityIndicator,
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
import { supabase } from '../../lib/supabase';

/* ─── Gemini AI Deep Search ───────────────────────────── */

const GEMINI_KEY = 'AIzaSyB0Z6K4MU7JfjAdjMGNNKY81epuW2K8hjc';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_KEY}`;

function buildFoodPrompt(query: string): string {
  return `You are a nutrition database. For the food query "${query}", return a JSON array of 5-8 matching food items. Each item must have exactly these fields:
{ "name": string, "brand": string|null, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number|null, "sugar": number|null, "serving_size": number, "serving_unit": string, "vitamin_a": number|null, "vitamin_c": number|null, "vitamin_d": number|null, "vitamin_e": number|null, "vitamin_k": number|null, "vitamin_b6": number|null, "vitamin_b12": number|null, "folate": number|null, "calcium": number|null, "iron": number|null, "magnesium": number|null, "potassium": number|null, "zinc": number|null, "sodium": number|null }
IMPORTANT: Use realistic serving sizes. For branded/restaurant items (e.g. KFC Zinger Fillet, Big Mac), use the actual item size as one serving (e.g. 1 burger, 1 piece). For raw ingredients (e.g. chicken breast, rice), use a typical serving size in grams. All nutritional values must match the serving_size. Calories in kcal, macros in grams, micronutrients in standard units (mcg/mg as appropriate). Return ONLY the JSON array, no markdown, no explanation.`;
}

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
              <Ionicons name="checkmark-circle" size={ms(10)} color={c.accentGreen} />
            )}
            {item.confidence === 'ai_estimated' && (
              <Ionicons name="sparkles" size={ms(10)} color={c.accent} />
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
          size={ms(14)}
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
  const [deepSearchEnabled, setDeepSearchEnabled] = useState(false);
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

  // AI Deep Search
  const [aiResults, setAiResults] = useState<FoodCatalogItem[]>([]);
  const [aiSearching, setAiSearching] = useState(false);
  const [showAiResults, setShowAiResults] = useState(false);
  const [cachedAiResults, setCachedAiResults] = useState<FoodCatalogItem[]>([]);

  // Saved meals
  const savedMeals = useSavedMealsStore((st) => st.meals);
  const loadSavedMeals = useSavedMealsStore((st) => st.loadMeals);
  const deleteSavedMeal = useSavedMealsStore((st) => st.deleteMeal);

  // Favourites
  const favourites = useFavouritesStore((st) => st.favourites);
  const loadFavourites = useFavouritesStore((st) => st.loadFavourites);

  // Default tab (home = recent+popular together, favourites, meals)
  const [defaultTab, setDefaultTab] = useState<'home' | 'favourites' | 'meals'>('home');

  /* ── Check deep search access ──────────────────────── */
  useEffect(() => {
    if (!visible || !userId) return;
    supabase
      .from('feature_flags')
      .select('enabled')
      .eq('user_id', userId)
      .eq('flag', 'deep_search')
      .maybeSingle()
      .then(({ data }) => setDeepSearchEnabled(data?.enabled === true));
  }, [visible, userId]);

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
      setDefaultTab('home');
      setAiResults([]);
      setAiSearching(false);
      setShowAiResults(false);
      setCachedAiResults([]);
    }
  }, [visible]);

  /* ── Search ────────────────────────────────────────── */
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchCatalog(text);
      // Also search AI cache
      const normalized = text.trim().toLowerCase();
      if (normalized.length >= 2) {
        supabase
          .from('ai_food_cache')
          .select('*')
          .or(`name.ilike.%${normalized}%,brand.ilike.%${normalized}%,search_query.ilike.%${normalized}%`)
          .limit(10)
          .then(({ data }) => {
            if (data && data.length > 0) {
              setCachedAiResults(data.map((row: any, i: number) => ({
                id: row.id ?? `aic-${Date.now()}-${i}`,
                name: row.name,
                brand: row.brand || null,
                calories: Number(row.calories) || 0,
                protein: Number(row.protein) || 0,
                carbs: Number(row.carbs) || 0,
                fat: Number(row.fat) || 0,
                fiber: row.fiber != null ? Number(row.fiber) : null,
                sugar: row.sugar != null ? Number(row.sugar) : null,
                serving_size: Number(row.serving_size) || 100,
                serving_unit: row.serving_unit || 'g',
                confidence: 'ai_estimated' as const,
                food_catalog_id: null,
                vitamin_a: row.vitamin_a ?? null, vitamin_c: row.vitamin_c ?? null,
                vitamin_d: row.vitamin_d ?? null, vitamin_e: row.vitamin_e ?? null,
                vitamin_k: row.vitamin_k ?? null, vitamin_b6: row.vitamin_b6 ?? null,
                vitamin_b12: row.vitamin_b12 ?? null, folate: row.folate ?? null,
                calcium: row.calcium ?? null, iron: row.iron ?? null,
                magnesium: row.magnesium ?? null, potassium: row.potassium ?? null,
                zinc: row.zinc ?? null, sodium: row.sodium ?? null,
              })));
            } else {
              setCachedAiResults([]);
            }
          })
          .catch(() => setCachedAiResults([]));
      } else {
        setCachedAiResults([]);
      }
    }, 300);
  }, [searchCatalog]);

  /* ── AI Deep Search (with shared cache) ─────────────── */
  const searchAi = useCallback(async () => {
    const q = query.trim();
    if (!q || aiSearching) return;
    setAiSearching(true);
    const normalized = q.toLowerCase();

    const mapRow = (row: any, i: number): FoodCatalogItem => ({
      id: row.id ?? `ai-${Date.now()}-${i}`,
      name: row.name,
      brand: row.brand || null,
      calories: Number(row.calories) || 0,
      protein: Number(row.protein) || 0,
      carbs: Number(row.carbs) || 0,
      fat: Number(row.fat) || 0,
      fiber: row.fiber != null ? Number(row.fiber) : null,
      sugar: row.sugar != null ? Number(row.sugar) : null,
      serving_size: Number(row.serving_size) || 100,
      serving_unit: row.serving_unit || 'g',
      confidence: 'ai_estimated',
      food_catalog_id: null,
      vitamin_a: row.vitamin_a ?? null, vitamin_c: row.vitamin_c ?? null,
      vitamin_d: row.vitamin_d ?? null, vitamin_e: row.vitamin_e ?? null,
      vitamin_k: row.vitamin_k ?? null, vitamin_b6: row.vitamin_b6 ?? null,
      vitamin_b12: row.vitamin_b12 ?? null, folate: row.folate ?? null,
      calcium: row.calcium ?? null, iron: row.iron ?? null,
      magnesium: row.magnesium ?? null, potassium: row.potassium ?? null,
      zinc: row.zinc ?? null, sodium: row.sodium ?? null,
    });

    try {
      // 1. Check shared cache first (non-blocking — table may not exist yet)
      try {
        const { data: cached } = await supabase
          .from('ai_food_cache')
          .select('*')
          .eq('search_query', normalized);

        if (cached && cached.length > 0) {
          setAiResults(cached.map(mapRow));
          setShowAiResults(true);
          return;
        }
      } catch {}

      // 2. Cache miss — call Gemini
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildFoodPrompt(q) }] }],
        }),
      });
      const json = await res.json();
      console.log('[DeepSearch] status:', res.status, 'response:', JSON.stringify(json).slice(0, 500));
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
      const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
      const items: any[] = JSON.parse(cleaned);
      console.log('[DeepSearch] parsed items:', items.length);
      const mapped = items.map(mapRow);

      setAiResults(mapped);
      setShowAiResults(true);

      // 3. Save to shared cache (fire-and-forget)
      const rows = items.map((item: any) => ({
        search_query: normalized,
        name: item.name || q,
        brand: item.brand || null,
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fat ?? 0,
        fiber: item.fiber ?? null,
        sugar: item.sugar ?? null,
        serving_size: item.serving_size ?? 100,
        serving_unit: item.serving_unit ?? 'g',
        vitamin_a: item.vitamin_a ?? null, vitamin_c: item.vitamin_c ?? null,
        vitamin_d: item.vitamin_d ?? null, vitamin_e: item.vitamin_e ?? null,
        vitamin_k: item.vitamin_k ?? null, vitamin_b6: item.vitamin_b6 ?? null,
        vitamin_b12: item.vitamin_b12 ?? null, folate: item.folate ?? null,
        calcium: item.calcium ?? null, iron: item.iron ?? null,
        magnesium: item.magnesium ?? null, potassium: item.potassium ?? null,
        zinc: item.zinc ?? null, sodium: item.sodium ?? null,
      }));
      try { await supabase.from('ai_food_cache').insert(rows); } catch {}
    } catch (err) {
      console.log('[DeepSearch] error:', err);
      setAiResults([]);
    } finally {
      setAiSearching(false);
    }
  }, [query, aiSearching]);

  // Reset AI results when query changes
  useEffect(() => {
    setShowAiResults(false);
    setAiResults([]);
  }, [query]);

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
  const mergedResults = useMemo(() => {
    if (showAiResults) return aiResults;
    if (cachedAiResults.length === 0) return catalogResults;
    // Merge: catalog first, then cached AI results not already in catalog
    const seen = new Set(catalogResults.map((r) => r.name.toLowerCase()));
    const unique = cachedAiResults.filter((r) => !seen.has(r.name.toLowerCase()));
    return [...catalogResults, ...unique];
  }, [showAiResults, aiResults, catalogResults, cachedAiResults]);
  const displayResults = mergedResults;
  const showResults = query.length > 0 && displayResults.length > 0;
  const showEmpty = query.length > 0 && displayResults.length === 0 && !catalogLoading && !aiSearching;
  const hasRecent = recentFoods.length > 0;
  const hasPopular = popularFoods.length > 0;
  const hasSavedMeals = savedMeals.length > 0;
  const hasFavourites = favourites.length > 0;
  const showDefaults = query.length === 0 && (hasRecent || hasPopular || hasSavedMeals || hasFavourites);

  /* ── Render ────────────────────────────────────────── */
  return (
    <BottomSheet visible={visible} onClose={onDismiss} height="95%" modal>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Log Food</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={ms(16)} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpenCreateMeal} activeOpacity={0.7}>
              <Ionicons name="restaurant-outline" size={ms(16)} color={colors.accent} />
              <Text style={s.actionBtnText}>Make A Meal</Text>
              <Ionicons name="chevron-forward" size={ms(12)} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpenScanner} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={ms(16)} color={colors.accent} />
              <Text style={s.actionBtnText}>Scan a meal</Text>
              <Ionicons name="chevron-forward" size={ms(12)} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={handleOpenQuickAdd} activeOpacity={0.7}>
              <Ionicons name="flash-outline" size={ms(16)} color={colors.accent} />
              <Text style={s.actionBtnText}>Quick Add</Text>
              <Ionicons name="chevron-forward" size={ms(12)} color={colors.textTertiary} />
            </TouchableOpacity>
            <View style={[s.actionBtn, s.actionBtnDisabled]}>
              <Ionicons name="document-text-outline" size={ms(16)} color={colors.textTertiary} />
              <Text style={[s.actionBtnText, { color: colors.textTertiary }]} numberOfLines={1}>Label Scanner</Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={ms(14)} color={colors.textTertiary + '80'} />
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
                <Ionicons name="close" size={ms(10)} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter chips */}
          {query.length === 0 && (
            <View style={s.chipRow}>
              {([
                { key: 'home' as const, label: 'For You', icon: 'home-outline' as const },
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
                      size={ms(12)}
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
              <Ionicons name="alert-circle-outline" size={ms(13)} color={colors.textOnAccent} />
              <Text style={s.notFoundText}>{scanNotFound}</Text>
              <TouchableOpacity onPress={() => setScanNotFound(null)}>
                <Ionicons name="close" size={ms(13)} color={colors.textOnAccent} />
              </TouchableOpacity>
            </View>
          )}

          {/* AI results header */}
          {showAiResults && (
            <View style={s.aiHeader}>
              <View style={s.aiBadge}>
                <Ionicons name="sparkles" size={ms(10)} color={colors.textOnAccent} />
                <Text style={s.aiBadgeText}>Estimated</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiResults(false)} hitSlop={8}>
                <Text style={s.backToLocal}>Back to local</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          {(catalogLoading || aiSearching) ? (
            <View style={s.centerState}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.emptyText}>{aiSearching ? 'Searching...' : 'Searching...'}</Text>
            </View>
          ) : showEmpty ? (
            <View style={s.centerState}>
              <Ionicons name="search-outline" size={ms(24)} color={colors.textTertiary} />
              <Text style={s.emptyText}>No results found</Text>
            </View>
          ) : !showResults && !showDefaults ? (
            <View style={s.centerState}>
              <Ionicons name="nutrition-outline" size={ms(24)} color={colors.textTertiary} />
              <Text style={s.emptyText}>Search for foods to add</Text>
            </View>
          ) : (
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {showResults && displayResults.map((item, i) => (
                <CatalogRow key={item.id + i} item={item} onSelect={handleSelectItem} s={s} c={colors} />
              ))}
              {showDefaults && (
                <>
                  {/* Home tab: Recent + Popular stacked */}
                  {defaultTab === 'home' && (
                    <>
                      {hasRecent && (
                        <>
                          <Text style={s.sectionLabel}>Recent</Text>
                          {recentFoods.slice(0, 5).map((item, i) => (
                            <CatalogRow key={`r-${item.id}-${i}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                          ))}
                        </>
                      )}
                      {hasPopular && (
                        <>
                          <Text style={s.sectionLabel}>Popular</Text>
                          {popularFoods.map((item) => (
                            <CatalogRow key={`p-${item.id}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                          ))}
                        </>
                      )}
                      {!hasRecent && !hasPopular && (
                        <View style={s.tabEmptyState}>
                          <Text style={s.emptyText}>No recent or popular foods yet</Text>
                        </View>
                      )}
                    </>
                  )}
                  {/* Meals tab */}
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
                        <Ionicons name="chevron-forward" size={ms(13)} color={colors.textTertiary} />
                      </TouchableOpacity>
                    );
                  })}
                  {defaultTab === 'meals' && !hasSavedMeals && (
                    <View style={s.tabEmptyState}>
                      <Ionicons name="restaurant-outline" size={ms(20)} color={colors.textTertiary} />
                      <Text style={s.emptyText}>No saved meals yet</Text>
                      <Text style={s.emptySubtext}>Use "Make A Meal" to create and save meals</Text>
                    </View>
                  )}
                  {/* Favourites tab */}
                  {defaultTab === 'favourites' && hasFavourites && favourites.map((item, i) => (
                    <CatalogRow key={`fav-${item.id}-${i}`} item={item} onSelect={handleSelectItem} s={s} c={colors} />
                  ))}
                  {defaultTab === 'favourites' && !hasFavourites && (
                    <View style={s.tabEmptyState}>
                      <Ionicons name="heart-outline" size={ms(20)} color={colors.textTertiary} />
                      <Text style={s.emptyText}>No favourites yet</Text>
                      <Text style={s.emptySubtext}>Tap the heart on any food to save it here</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}
          {/* Deep Search floating button */}
          {deepSearchEnabled && query.trim().length > 0 && !showAiResults && !aiSearching && (
            <TouchableOpacity
              style={s.deepSearchBtn}
              onPress={searchAi}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={ms(14)} color={colors.textOnAccent} />
              <Text style={s.deepSearchText}>Deep Search</Text>
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sw(10),
    marginBottom: sw(6),
  },
  closeBtn: {
    position: 'absolute',
    right: sw(10),
    width: sw(28),
    height: sw(28),
    borderRadius: sw(14),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: sw(12),
    gap: sw(8),
    marginBottom: sw(6),
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    paddingVertical: sw(10),
    paddingHorizontal: sw(10),
    borderRadius: sw(10),
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
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
  },
  /* Search */
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    marginHorizontal: sw(12),
    paddingHorizontal: sw(10),
    height: sw(36),
    gap: sw(8),
    marginBottom: sw(8),
  },
  searchText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.regular,
    padding: 0,
    letterSpacing: 0.1,
  },
  searchClearBtn: {
    width: sw(18),
    height: sw(18),
    borderRadius: sw(9),
    backgroundColor: colors.textTertiary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Filter chips */
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: sw(12),
    gap: sw(6),
    marginBottom: sw(8),
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(3),
    paddingVertical: sw(6),
    borderRadius: sw(16),
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
  },
  chipTextActive: {
    color: colors.textOnAccent,
  },
  tabEmptyState: {
    alignItems: 'center',
    paddingVertical: sw(24),
  },
  /* Not-found banner */
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentOrange,
    marginHorizontal: sw(12),
    marginBottom: sw(6),
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(8),
    gap: sw(6),
  },
  notFoundText: {
    flex: 1,
    color: colors.textOnAccent,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
  },
  /* List */
  listContent: {
    paddingHorizontal: sw(12),
    paddingBottom: sw(30),
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: sw(8),
    marginBottom: sw(4),
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(10),
    paddingRight: sw(2),
    marginBottom: sw(4),
  },
  catalogRowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(8),
    paddingLeft: sw(10),
    paddingRight: sw(4),
    gap: sw(8),
  },
  catalogInfo: { flex: 1, gap: sw(1) },
  catalogNameRow: { flexDirection: 'row', alignItems: 'center', gap: sw(3) },
  catalogName: {
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  catalogBrand: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  catalogMacros: { flexDirection: 'row', gap: sw(6), marginTop: sw(1) },
  catalogMacro: { fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.bold },
  catalogServing: {
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.medium,
    color: colors.textTertiary,
  },
  catalogRight: { alignItems: 'center' },
  favBtn: {
    padding: sw(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogCal: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.extraBold,
  },
  catalogCalUnit: {
    color: colors.textTertiary,
    fontSize: ms(8),
    lineHeight: ms(10),
    fontFamily: Fonts.semiBold,
  },
  /* Saved meals */
  savedMealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(10),
    paddingVertical: sw(8),
    paddingHorizontal: sw(10),
    gap: sw(8),
    marginBottom: sw(4),
  },
  savedMealInfo: { flex: 1, gap: sw(2) },
  savedMealName: {
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  savedMealMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  savedMealItems: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  savedMealMacros: {
    flexDirection: 'row',
    gap: sw(5),
  },
  /* AI Deep Search */
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(12),
    marginBottom: sw(6),
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    backgroundColor: colors.accent,
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
  },
  aiBadgeText: {
    color: colors.textOnAccent,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.semiBold,
  },
  backToLocal: {
    color: colors.accent,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
  },
  deepSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    marginHorizontal: sw(12),
    marginBottom: sw(6),
    paddingVertical: sw(9),
    backgroundColor: colors.accent,
    borderRadius: sw(10),
  },
  deepSearchText: {
    color: colors.textOnAccent,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  /* Empty states */
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  emptySubtext: {
    color: colors.textTertiary + '80',
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.regular,
    textAlign: 'center',
    paddingHorizontal: sw(32),
  },
});
