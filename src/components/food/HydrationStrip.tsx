import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSupplementStore } from '../../stores/useSupplementStore';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const WATER_STEP_ML = 250;
const WATER_KEY = 'water';

/** Water in litres when the goal is a litre or more (e.g. 0.75 / 3 L), otherwise ml. */
function formatWater(ml: number, inLitres: boolean): string {
  if (!inLitres) return String(Math.round(ml));
  const l = ml / 1000;
  return l % 1 === 0 ? String(l) : l.toFixed(2).replace(/0$/, '');
}

function formatAmount(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

interface ChipProps {
  /** Supplement key passed back to onAdd (water uses its own handlers). */
  itemKey: string;
  label: string;
  step: number;
  /** Spoken amount one tap adds, e.g. "250 ml". */
  stepText: string;
  icon: string;
  color: string;
  value: string;
  goal: string;
  unit: string;
  progress: number;
  canAdd: boolean;
  onAdd?: (key: string, step: number) => void;
  onLongPress?: () => void;
  styles: ReturnType<typeof createStyles>;
}

const Chip = React.memo(function Chip({ itemKey, label, step, stepText, icon, color, value, goal, unit, progress, canAdd, onAdd, onLongPress, styles }: ChipProps) {
  const done = progress >= 1;
  const handlePress = useCallback(() => onAdd?.(itemKey, step), [onAdd, itemKey, step]);
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, pressed && canAdd && styles.chipPressed]}
      onPress={canAdd ? handlePress : undefined}
      onLongPress={canAdd ? onLongPress : undefined}
      disabled={!canAdd}
      accessibilityRole={canAdd ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value} of ${goal} ${unit}`}
      accessibilityHint={canAdd ? `Adds ${stepText}${onLongPress ? '. Long press to undo the last one' : ''}` : undefined}
      accessibilityActions={canAdd && onLongPress ? [{ name: 'longpress', label: 'Undo last' }] : undefined}
      onAccessibilityAction={onLongPress ? (e) => { if (e.nativeEvent.actionName === 'longpress') onLongPress(); } : undefined}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={(done ? 'checkmark' : icon || 'ellipse-outline') as IconName} size={ms(14)} color={color} />
      </View>
      <View style={styles.chipBody}>
        <Text style={styles.chipText} numberOfLines={1}>
          <Text style={styles.chipValue}>{value}</Text>
          <Text style={styles.chipGoal}> / {goal} {unit}</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
      {canAdd && !done && <Ionicons name="add" size={ms(16)} color={color} />}
    </Pressable>
  );
});

/**
 * Water + supplements for the day under the nutrition summary.
 * Tap to add (today only); long-press water to undo the last glass. Past days are read-only.
 */
function HydrationStrip({ isToday }: { isToday: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const water = useSupplementStore((s) => s.water);
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const todayTotals = useSupplementStore((s) => s.supplementTotals);
  const dateEntries = useSupplementStore((s) => s.dateEntries);
  const addWater = useSupplementStore((s) => s.addWater);
  const undoLastWater = useSupplementStore((s) => s.undoLastWater);
  const addSupplement = useSupplementStore((s) => s.addSupplement);

  // Today uses the live totals; a past day adds up that day's entries.
  const { waterMl, totals } = useMemo(() => {
    if (isToday) return { waterMl: water, totals: todayTotals };
    let w = 0;
    const t: Record<string, number> = {};
    for (const e of dateEntries) {
      if (e.type === 'water') w += Number(e.amount);
      else t[e.type] = (t[e.type] || 0) + Number(e.amount);
    }
    return { waterMl: w, totals: t };
  }, [isToday, water, todayTotals, dateEntries]);

  const waterInLitres = waterGoal >= 1000;

  const handleAdd = useCallback((key: string, step: number) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === WATER_KEY) addWater(userId, step);
    else addSupplement(userId, key, step);
  }, [userId, addWater, addSupplement]);

  const handleUndoWater = useCallback(() => {
    if (!userId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    undoLastWater(userId);
  }, [userId, undoLastWater]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      <Chip
        itemKey={WATER_KEY}
        label="Water"
        step={WATER_STEP_ML}
        stepText={`${WATER_STEP_ML} ml`}
        icon="water-outline"
        color={colors.water}
        value={formatWater(waterMl, waterInLitres)}
        goal={formatWater(waterGoal, waterInLitres)}
        unit={waterInLitres ? 'L' : 'ml'}
        progress={waterGoal > 0 ? waterMl / waterGoal : 0}
        canAdd={isToday}
        onAdd={handleAdd}
        onLongPress={handleUndoWater}
        styles={styles}
      />
      {configs.map((c) => {
        const amount = totals[c.key] || 0;
        const step = c.increments[0] ?? c.dailyGoal;
        return (
          <Chip
            key={c.key}
            itemKey={c.key}
            label={c.name}
            step={step}
            stepText={`${formatAmount(step)} ${c.unit}`}
            icon={c.icon}
            color={c.color}
            value={formatAmount(amount)}
            goal={formatAmount(c.dailyGoal)}
            unit={c.unit}
            progress={c.dailyGoal > 0 ? amount / c.dailyGoal : 0}
            canAdd={isToday && step > 0}
            onAdd={handleAdd}
            styles={styles}
          />
        );
      })}
    </ScrollView>
  );
}

export default React.memo(HydrationStrip);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginTop: sw(10),
    },
    row: {
      paddingHorizontal: sw(16),
      gap: sw(8),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(8),
      paddingLeft: sw(8),
      paddingRight: sw(10),
      minWidth: sw(150),
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    chipPressed: {
      opacity: 0.7,
    },
    iconWrap: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(9),
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipBody: {
      flex: 1,
      gap: sw(4),
    },
    chipText: {
      fontSize: ms(12),
      lineHeight: ms(16),
    },
    chipValue: {
      color: colors.textPrimary,
      fontFamily: Fonts.bold,
    },
    chipGoal: {
      color: colors.textTertiary,
      fontFamily: Fonts.medium,
    },
    track: {
      height: sw(3),
      borderRadius: sw(1.5),
      backgroundColor: colors.ring.track,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: sw(1.5),
    },
  });
