import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { sw } from '../../theme/responsive';
import { useFoodLogStore, type FoodEntry } from '../../stores/useFoodLogStore';
import { groupEntriesByMeal, type MealBucket } from './groupEntriesByMeal';
import MealCard from './MealCard';

interface Props {
  entries: FoodEntry[];
  onAdd: (meal: MealBucket) => void;
  onPressEntry: (entry: FoodEntry) => void;
  onTogglePlanned: (id: string) => void;
  onPressGroup: (groupId: string, entries: FoodEntry[]) => void;
  onDeleteGroup: (groupId: string) => void;
}

/** The day's food as one card per meal, in the user's meal order. */
function MealList({ entries, onAdd, onPressEntry, onTogglePlanned, onPressGroup, onDeleteGroup }: Props) {
  const mealConfigs = useFoodLogStore((s) => s.mealConfigs);
  const meals = useMemo(() => groupEntriesByMeal(entries, mealConfigs), [entries, mealConfigs]);

  return (
    <View style={styles.list}>
      {meals.map((meal) => (
        <MealCard
          key={meal.slot}
          meal={meal}
          onAdd={onAdd}
          onPressEntry={onPressEntry}
          onTogglePlanned={onTogglePlanned}
          onPressGroup={onPressGroup}
          onDeleteGroup={onDeleteGroup}
        />
      ))}
    </View>
  );
}

export default React.memo(MealList);

const styles = StyleSheet.create({
  list: {
    gap: sw(10),
    paddingBottom: sw(96),
  },
});
