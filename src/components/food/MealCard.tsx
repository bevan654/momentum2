import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry } from '../../stores/useFoodLogStore';
import type { MealBucket } from './groupEntriesByMeal';
import MealEntryRow from './MealEntryRow';
import MealGroupRow from './MealGroupRow';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  meal: MealBucket;
  onAdd: (meal: MealBucket) => void;
  onPressEntry: (entry: FoodEntry) => void;
  onTogglePlanned: (id: string) => void;
  onPressGroup: (groupId: string, entries: FoodEntry[]) => void;
  onDeleteGroup: (groupId: string) => void;
}

/**
 * One meal of the day. With food: header (icon, name, kcal), the items, then "Add food".
 * Empty: a single slim row that adds to this meal.
 */
function MealCard({ meal, onAdd, onPressEntry, onTogglePlanned, onPressGroup, onDeleteGroup }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handleAdd = useCallback(() => onAdd(meal), [meal, onAdd]);
  const icon = (meal.icon || 'restaurant-outline') as IconName;
  const isEmpty = meal.items.length === 0;

  if (isEmpty) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.emptyCard, pressed && styles.pressed]}
        onPress={handleAdd}
        accessibilityRole="button"
        accessibilityLabel={`Add food to ${meal.label}`}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={ms(15)} color={colors.textSecondary} />
        </View>
        <Text style={[styles.title, styles.emptyTitle]}>{meal.label}</Text>
        <View style={styles.addPill}>
          <Ionicons name="add" size={ms(14)} color={colors.accent} />
          <Text style={styles.addPillText}>Add</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={ms(15)} color={colors.accent} />
        </View>
        <Text style={styles.title}>{meal.label}</Text>
        <Text style={styles.total}>
          {meal.totals.calories.toLocaleString()}
          <Text style={styles.totalUnit}> kcal</Text>
        </Text>
      </View>

      <View style={styles.items}>
        {meal.items.map((item, i) => (
          <View key={item.type === 'entry' ? item.entry.id : item.groupId} style={i > 0 && styles.divider}>
            {item.type === 'entry' ? (
              <MealEntryRow entry={item.entry} onPress={onPressEntry} onTogglePlanned={onTogglePlanned} />
            ) : (
              <MealGroupRow
                groupId={item.groupId}
                groupName={item.groupName}
                entries={item.entries}
                onPress={onPressGroup}
                onDelete={onDeleteGroup}
              />
            )}
          </View>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
        onPress={handleAdd}
        accessibilityRole="button"
        accessibilityLabel={`Add food to ${meal.label}`}
      >
        <Ionicons name="add-circle" size={ms(18)} color={colors.accent} />
        <Text style={styles.addRowText}>Add food</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(MealCard);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: sw(16),
      paddingHorizontal: sw(14),
      paddingTop: sw(12),
      borderRadius: sw(18),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    emptyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingVertical: sw(12),
    },
    pressed: {
      opacity: 0.7,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingBottom: sw(4),
    },
    iconWrap: {
      width: sw(30),
      height: sw(30),
      borderRadius: sw(10),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
      letterSpacing: -0.2,
    },
    emptyTitle: {
      color: colors.textSecondary,
      fontFamily: Fonts.semiBold,
      fontSize: ms(15),
    },
    total: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
    },
    totalUnit: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
    },
    items: {
      paddingLeft: sw(40),
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(12),
      paddingLeft: sw(40),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    addRowText: {
      color: colors.accent,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
    addPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(2),
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
      borderRadius: sw(999),
      backgroundColor: colors.accent + '1F',
    },
    addPillText: {
      color: colors.accent,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
  });
