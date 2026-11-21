import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry } from '../../stores/useFoodLogStore';
import MacroSplitBar from './MacroSplitBar';

interface Props {
  entry: FoodEntry;
  onPress: (entry: FoodEntry) => void;
  onTogglePlanned: (id: string) => void;
  /** Delete from the diary (after the second tap on the bin). */
  onDelete: (id: string) => void;
}

/** How long the bin stays armed ("Delete?") waiting for the confirming tap. */
const CONFIRM_MS = 3000;

function formatServing(entry: FoodEntry): string | null {
  const qty = entry.quantity || 1;
  const size = entry.serving_size;
  const unit = entry.serving_unit;
  if (!size || !unit) return qty !== 1 ? `×${qty}` : null;
  const amount = Math.round(size * qty * 10) / 10;
  return unit === 'serving' ? `${qty} serving${qty === 1 ? '' : 's'}` : `${amount} ${unit}`;
}

/** One logged food inside a meal card: name, serving, kcal and its macro split. */
function MealEntryRow({ entry, onPress, onTogglePlanned, onDelete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handlePress = useCallback(() => onPress(entry), [entry, onPress]);
  const handleToggle = useCallback(() => onTogglePlanned(entry.id), [entry.id, onTogglePlanned]);

  // Two taps to delete: the first arms the bin ("Delete?"), the second within 3 s deletes.
  // A stray tap (e.g. while swiping between tabs) only arms it, and it disarms by itself.
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);
  const handleDeletePress = useCallback(() => {
    if (armTimer.current) clearTimeout(armTimer.current);
    if (armed) {
      setArmed(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDelete(entry.id);
      return;
    }
    Haptics.selectionAsync();
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
  }, [armed, entry.id, onDelete]);
  // Still saving (temporary id): there's nothing to delete yet.
  const canDelete = !entry.id.startsWith('temp-');

  const serving = formatServing(entry);
  const sub = [entry.brand, serving].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.row, entry.is_planned && styles.planned, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${Math.round(entry.calories)} calories${entry.is_planned ? ', planned' : ''}`}
      accessibilityActions={entry.is_planned ? [{ name: 'markEaten', label: 'Mark as eaten' }] : undefined}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'markEaten') handleToggle(); }}
    >
      <View style={styles.top}>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
          {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
        </View>
        {entry.is_planned && (
          <Pressable
            onPress={handleToggle}
            hitSlop={8}
            style={styles.plannedTag}
            accessibilityRole="button"
            accessibilityLabel="Planned. Tap to mark as eaten"
          >
            <Text style={styles.plannedText}>Planned</Text>
          </Pressable>
        )}
        <Text style={styles.kcal}>
          {Math.round(entry.calories)}
          <Text style={styles.kcalUnit}> kcal</Text>
        </Text>
        <View style={styles.spacer} />
        {canDelete && (
          <Pressable
            onPress={handleDeletePress}
            hitSlop={8}
            style={[styles.deleteBtn, armed && styles.deleteBtnArmed]}
            accessibilityRole="button"
            accessibilityLabel={armed ? `Tap again to delete ${entry.name}` : `Delete ${entry.name}`}
          >
            {armed
              ? <Text style={styles.deleteText}>Delete?</Text>
              : <Ionicons name="trash-outline" size={ms(15)} color={colors.textTertiary} />}
          </Pressable>
        )}
      </View>
      <MacroSplitBar protein={entry.protein} carbs={entry.carbs} fat={entry.fat} />
    </Pressable>
  );
}

export default React.memo(MealEntryRow);

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
    // Name and kcal sit together; the space after them goes to the delete button on the right.
    nameCol: {
      flexShrink: 1,
      gap: sw(1),
    },
    spacer: {
      flex: 1,
    },
    deleteBtn: {
      minWidth: sw(30),
      height: sw(30),
      paddingHorizontal: sw(8),
      borderRadius: sw(8),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    deleteBtnArmed: {
      backgroundColor: colors.accentRed,
    },
    deleteText: {
      color: colors.textOnColor,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
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
    plannedTag: {
      paddingHorizontal: sw(7),
      paddingVertical: sw(2),
      borderRadius: sw(6),
      borderWidth: 1,
      borderColor: colors.accent,
    },
    plannedText: {
      color: colors.accent,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
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
  });
