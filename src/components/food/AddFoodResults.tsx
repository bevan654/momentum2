import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodCatalogItem } from '../../stores/useFoodLogStore';
import type { SavedMeal } from '../../stores/useSavedMealsStore';
import FoodRow from './ui/FoodRow';
import FavouriteButton from './ui/FavouriteButton';
import FoodEmptyState from './ui/FoodEmptyState';
import { foodSubtitle, savedMealTotals } from './foodMapping';

export type AddFoodTab = 'home' | 'favourites' | 'meals';

type ListItem =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'food'; key: string; item: FoodCatalogItem; reportable: boolean }
  | { kind: 'meal'; key: string; meal: SavedMeal }
  | { kind: 'empty'; key: string; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle?: string; loading?: boolean };

interface Props {
  query: string;
  tab: AddFoodTab;
  loading: boolean;
  /** Search results to show (catalog + cached AI, or the Deep Search answer). */
  results: FoodCatalogItem[];
  /** Results are a Deep Search answer: long-press reports an item. */
  aiMode: boolean;
  recentFoods: FoodCatalogItem[];
  popularFoods: FoodCatalogItem[];
  favourites: FoodCatalogItem[];
  savedMeals: SavedMeal[];
  header: React.ReactElement;
  onSelectFood: (item: FoodCatalogItem) => void;
  onReportAi: (item: FoodCatalogItem) => void;
  onOpenSavedMeal: (meal: SavedMeal) => void;
}

const RECENT_LIMIT = 5;

/** Everything under the search bar, as one virtualised list (search results or a default tab). */
function AddFoodResults({
  query, tab, loading, results, aiMode, recentFoods, popularFoods, favourites, savedMeals,
  header, onSelectFood, onReportAi, onOpenSavedMeal,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const data = useMemo<ListItem[]>(() => {
    const foods = (prefix: string, items: FoodCatalogItem[], reportable = false): ListItem[] =>
      items.map((item, i) => ({ kind: 'food', key: `${prefix}-${item.id}-${i}`, item, reportable }));

    if (query.length > 0) {
      if (loading) return [{ kind: 'empty', key: 'loading', icon: 'search-outline', title: 'Searching…', loading: true }];
      if (results.length === 0) {
        return [{ kind: 'empty', key: 'none', icon: 'search-outline', title: 'No results found', subtitle: 'Try another name, scan the barcode, or use Quick add.' }];
      }
      return foods('s', results, aiMode);
    }
    if (tab === 'favourites') {
      return favourites.length
        ? foods('fav', favourites)
        : [{ kind: 'empty', key: 'nofav', icon: 'heart-outline', title: 'No favourites yet', subtitle: 'Tap the heart on any food to keep it here.' }];
    }
    if (tab === 'meals') {
      return savedMeals.length
        ? savedMeals.map((meal) => ({ kind: 'meal' as const, key: `m-${meal.id}`, meal }))
        : [{ kind: 'empty', key: 'nomeals', icon: 'restaurant-outline', title: 'No saved meals yet', subtitle: 'Use "Make a meal" to build one and save it.' }];
    }
    const out: ListItem[] = [];
    if (recentFoods.length) {
      out.push({ kind: 'section', key: 'sec-recent', title: 'Recent' }, ...foods('r', recentFoods.slice(0, RECENT_LIMIT)));
    }
    if (popularFoods.length) {
      out.push({ kind: 'section', key: 'sec-popular', title: 'Popular' }, ...foods('p', popularFoods));
    }
    if (out.length === 0) {
      out.push({ kind: 'empty', key: 'nohome', icon: 'nutrition-outline', title: 'Search for a food to add', subtitle: 'Your recent and popular foods will show here.' });
    }
    return out;
  }, [query, loading, results, aiMode, tab, recentFoods, popularFoods, favourites, savedMeals]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    switch (item.kind) {
      case 'section':
        return <Text style={styles.section}>{item.title}</Text>;
      case 'empty':
        return <FoodEmptyState loading={item.loading} icon={item.icon} title={item.title} subtitle={item.subtitle} />;
      case 'meal': {
        const t = savedMealTotals(item.meal);
        return (
          <View style={styles.gap}>
            <FoodRow
              name={item.meal.name}
              subtitle={`${item.meal.items.length} item${item.meal.items.length === 1 ? '' : 's'}`}
              calories={t.calories}
              protein={t.protein}
              carbs={t.carbs}
              fat={t.fat}
              onPress={() => onOpenSavedMeal(item.meal)}
              trailing={<Ionicons name="chevron-forward" size={ms(16)} color={colors.textTertiary} style={styles.chevron} />}
            />
          </View>
        );
      }
      case 'food':
        return (
          <View style={styles.gap}>
            <FoodRow
              name={item.item.name}
              subtitle={foodSubtitle(item.item)}
              calories={item.item.calories}
              protein={item.item.protein}
              carbs={item.item.carbs}
              fat={item.item.fat}
              confidence={item.item.confidence}
              onPress={() => onSelectFood(item.item)}
              onLongPress={item.reportable ? () => onReportAi(item.item) : undefined}
              accessibilityHint={item.reportable ? 'Long press to report an inaccurate estimate' : undefined}
              trailing={<FavouriteButton item={item.item} />}
            />
          </View>
        );
    }
  }, [styles, colors, onSelectFood, onReportAi, onOpenSavedMeal]);

  return (
    <FlashList
      data={data}
      keyExtractor={(i) => i.key}
      getItemType={(i) => i.kind}
      renderItem={renderItem}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    />
  );
}

export default React.memo(AddFoodResults);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingBottom: sw(40),
    },
    section: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginHorizontal: sw(20),
      marginTop: sw(14),
      marginBottom: sw(8),
    },
    gap: {
      paddingBottom: sw(8),
    },
    chevron: {
      paddingHorizontal: sw(8),
    },
  });
