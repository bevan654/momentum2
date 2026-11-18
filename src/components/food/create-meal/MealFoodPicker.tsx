import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { useFoodLogStore, type FoodCatalogItem } from '../../../stores/useFoodLogStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useSavedMealsStore, type SavedMeal } from '../../../stores/useSavedMealsStore';
import { useFavouritesStore } from '../../../stores/useFavouritesStore';
import FoodSearchBar from '../ui/FoodSearchBar';
import FoodSegmentChips, { type SegmentOption } from '../ui/FoodSegmentChips';
import FoodRow from '../ui/FoodRow';
import FoodEmptyState from '../ui/FoodEmptyState';
import { foodSubtitle, savedMealTotals } from '../foodMapping';

type Tab = 'recent' | 'popular' | 'favourites' | 'meals';

const TABS: SegmentOption<Tab>[] = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'popular', label: 'Popular', icon: 'trending-up-outline' },
  { key: 'favourites', label: 'Favs', icon: 'heart-outline' },
  { key: 'meals', label: 'Meals', icon: 'restaurant-outline' },
];

/** Searches need 2 characters (as in Log food); with 1, the normal lists stay. */
const MIN_QUERY = 2;

interface Props {
  onSelectFood: (item: FoodCatalogItem) => void;
  /** Adds every item of a saved meal to the one being built. */
  onAddSavedMeal: (meal: SavedMeal) => void;
  /** Changes each time a food is added to the meal: the search clears, ready for the next one. */
  clearSignal: number;
}

const AddIcon = React.memo(function AddIcon() {
  const colors = useColors();
  return <Ionicons name="add-circle" size={ms(22)} color={colors.accent} />;
});

const FoodPickRow = React.memo(function FoodPickRow({ item, onSelect }: { item: FoodCatalogItem; onSelect: (item: FoodCatalogItem) => void }) {
  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
  return (
    <FoodRow
      name={item.name}
      subtitle={foodSubtitle(item)}
      calories={item.calories}
      protein={item.protein}
      carbs={item.carbs}
      fat={item.fat}
      confidence={item.confidence}
      onPress={handlePress}
      accessibilityHint="Choose the amount, then add it to the meal"
      trailing={<AddIcon />}
    />
  );
});

const SavedMealPickRow = React.memo(function SavedMealPickRow({ meal, onAdd }: { meal: SavedMeal; onAdd: (meal: SavedMeal) => void }) {
  const totals = useMemo(() => savedMealTotals(meal), [meal]);
  const handlePress = useCallback(() => onAdd(meal), [meal, onAdd]);
  return (
    <FoodRow
      name={meal.name}
      subtitle={`${meal.items.length} ${meal.items.length === 1 ? 'item' : 'items'}`}
      calories={totals.calories}
      protein={totals.protein}
      carbs={totals.carbs}
      fat={totals.fat}
      onPress={handlePress}
      accessibilityHint="Adds all of this meal's foods"
      trailing={<AddIcon />}
    />
  );
});

/**
 * Search plus the default lists (recent, popular, favourites, saved meals) for Make a meal.
 * Owns the search text, so typing re-renders only this part, not the whole meal screen.
 */
function MealFoodPicker({ onSelectFood, onAddSavedMeal, clearSignal }: Props) {
  const userId = useAuthStore((st) => st.user?.id);
  const catalogResults = useFoodLogStore((st) => st.catalogResults);
  const catalogLoading = useFoodLogStore((st) => st.catalogLoading);
  const recentFoods = useFoodLogStore((st) => st.recentFoods);
  const popularFoods = useFoodLogStore((st) => st.popularFoods);
  const savedMeals = useSavedMealsStore((st) => st.meals);
  const favourites = useFavouritesStore((st) => st.favourites);

  const [query, setQuery] = useState('');
  /** The text the store's results are for: anything else (e.g. Log food's search) isn't shown. */
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('recent');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mounted only while Make a meal is open: load the lists now, clear the shared search on close.
  useEffect(() => {
    if (userId) useFoodLogStore.getState().fetchDefaultFoods(userId);
    useFavouritesStore.getState().loadFavourites();
    useSavedMealsStore.getState().loadMeals();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      useFoodLogStore.getState().clearSearch();
    };
  }, [userId]);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setSearchedFor(text);
      useFoodLogStore.getState().searchCatalog(text);
    }, 300);
  }, []);

  const handleClear = useCallback(() => {
    // Cancel a search still waiting to run, or it would bring the results back after the clear.
    if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
    setQuery('');
    setSearchedFor(null);
    useFoodLogStore.getState().clearSearch();
  }, []);

  // Only a change while open clears (the value outlives a close on the Nutrition screen).
  const lastSignal = useRef(clearSignal);
  useEffect(() => {
    if (clearSignal === lastSignal.current) return;
    lastSignal.current = clearSignal;
    handleClear();
  }, [clearSignal, handleClear]);

  const searching = query.trim().length >= MIN_QUERY;

  let body: React.ReactNode;
  if (searching) {
    if (searchedFor !== null && catalogResults.length > 0) {
      // Keep the previous results on screen while a refined search runs, instead of flickering.
      body = catalogResults.map((item, i) => <FoodPickRow key={`${item.id}-${i}`} item={item} onSelect={onSelectFood} />);
    } else if (catalogLoading || searchedFor === null) {
      body = <FoodEmptyState loading title="Searching…" />;
    } else {
      body = <FoodEmptyState icon="search-outline" title="No results found" subtitle="Try another name, scan it, or use Quick add" />;
    }
  } else if (tab === 'meals') {
    body = savedMeals.length > 0
      ? savedMeals.map((meal) => <SavedMealPickRow key={meal.id} meal={meal} onAdd={onAddSavedMeal} />)
      : <FoodEmptyState icon="restaurant-outline" title="No saved meals yet" />;
  } else {
    const list = tab === 'recent' ? recentFoods : tab === 'popular' ? popularFoods : favourites;
    body = list.length > 0
      ? list.map((item, i) => <FoodPickRow key={`${tab}-${item.id}-${i}`} item={item} onSelect={onSelectFood} />)
      : (
        <FoodEmptyState
          icon={tab === 'favourites' ? 'heart-outline' : 'nutrition-outline'}
          title={tab === 'recent' ? 'No recent foods yet' : tab === 'favourites' ? 'No favourites yet' : 'Nothing here yet'}
        />
      );
  }

  return (
    <View style={styles.wrap}>
      <FoodSearchBar
        value={query}
        onChangeText={handleChange}
        onClear={handleClear}
        placeholder="Search foods, brands, recipes..."
      />
      {!searching && <FoodSegmentChips options={TABS} value={tab} onChange={setTab} />}
      <View style={styles.rows}>{body}</View>
    </View>
  );
}

export default React.memo(MealFoodPicker);

const styles = StyleSheet.create({
  wrap: {
    gap: sw(10),
  },
  rows: {
    gap: sw(8),
  },
});
