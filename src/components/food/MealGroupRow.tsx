import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry } from '../../stores/useFoodLogStore';
import MacroSplitBar from './MacroSplitBar';
import { sumMacros } from './dayTotals';

interface Props {
  groupId: string;
  groupName: string;
  entries: FoodEntry[];
  onPress: (groupId: string, entries: FoodEntry[]) => void;
  onDelete: (groupId: string) => void;
}

/** A meal logged as one group (e.g. a saved meal): tap to edit, trash to delete all its items. */
function MealGroupRow({ groupId, groupName, entries, onPress, onDelete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Same rule as the meal header and day summary: planned items don't count yet.
  const totals = useMemo(() => {
    const t = sumMacros(entries);
    return { cal: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat };
  }, [entries]);

  const handlePress = useCallback(() => onPress(groupId, entries), [groupId, entries, onPress]);
  const handleDelete = useCallback(() => {
    Alert.alert('Delete meal', `Remove "${groupName}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(groupId) },
    ]);
  }, [groupId, groupName, onDelete]);

  const isPlanned = entries.every((e) => e.is_planned);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, isPlanned && styles.planned, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${groupName}, ${entries.length} items, ${totals.cal} calories. Tap to edit`}
      accessibilityActions={[{ name: 'delete', label: 'Delete meal' }]}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'delete') handleDelete(); }}
    >
      <View style={styles.top}>
        <View style={styles.badge}>
          <Ionicons name="layers-outline" size={ms(13)} color={colors.accent} />
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{groupName}</Text>
          <Text style={styles.sub}>{entries.length} item{entries.length === 1 ? '' : 's'}</Text>
        </View>
        <Text style={styles.kcal}>
          {totals.cal}
          <Text style={styles.kcalUnit}> kcal</Text>
        </Text>
        <Pressable
          onPress={handleDelete}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${groupName}`}
        >
          <Ionicons name="trash-outline" size={ms(15)} color={colors.textTertiary} />
        </Pressable>
      </View>
      <MacroSplitBar protein={totals.protein} carbs={totals.carbs} fat={totals.fat} />
    </Pressable>
  );
}

export default React.memo(MealGroupRow);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      paddingVertical: sw(10),
      gap: sw(7),
    },
    planned: {
      opacity: 0.55,
    },
    pressed: {
      opacity: 0.6,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    badge: {
      width: sw(26),
      height: sw(26),
      borderRadius: sw(8),
      backgroundColor: colors.accent + '1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameCol: {
      flex: 1,
      gap: sw(1),
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    sub: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.regular,
    },
    kcal: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.bold,
    },
    kcalUnit: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
    },
    deleteBtn: {
      paddingLeft: sw(4),
    },
  });
