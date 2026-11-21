import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useProteinPowderStore, PROTEIN_POWDER_KEY } from '../../stores/useProteinPowderStore';
import SupplementLogSheet, { type LogSheetEntry } from './SupplementLogSheet';
import ProteinPowderModal from '../home/ProteinPowderModal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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

const COLUMNS = 2;

/** What one chip shows; the handlers and styles are shared. */
type ChipData = Omit<ChipProps, 'onAdd' | 'onOpenLog' | 'styles'>;

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
  onAdd: (key: string, step: number) => void;
  /** Long-press: open this item's sheet (quick amounts, and the day's entries to view / delete). */
  onOpenLog: (key: string) => void;
  styles: ReturnType<typeof createStyles>;
}

const Chip = React.memo(function Chip({ itemKey, label, step, stepText, icon, color, value, goal, unit, progress, canAdd, onAdd, onOpenLog, styles }: ChipProps) {
  const done = progress >= 1;
  const handlePress = useCallback(() => onAdd(itemKey, step), [onAdd, itemKey, step]);
  const handleLongPress = useCallback(() => onOpenLog(itemKey), [onOpenLog, itemKey]);
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      onPress={canAdd ? handlePress : handleLongPress}
      onLongPress={handleLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} of ${goal} ${unit}`}
      accessibilityHint={canAdd ? `Adds ${stepText}. Long press to change amounts or see entries` : 'Shows amounts and this day\'s entries'}
      accessibilityActions={[{ name: 'longpress', label: 'See entries' }]}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'longpress') handleLongPress(); }}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={(done ? 'checkmark' : icon || 'ellipse-outline') as IconName} size={ms(14)} color={color} />
      </View>
      <View style={styles.chipBody}>
        <Text style={styles.chipName} numberOfLines={1}>{label}</Text>
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
 * Tap to add (today only); long-press to see or delete the day's entries (on past days, tap does that too).
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
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const deleteSupplementEntry = useSupplementStore((s) => s.deleteSupplementEntry);
  const waterIncrements = useSupplementStore((s) => s.waterIncrements);
  const setWaterIncrements = useSupplementStore((s) => s.setWaterIncrements);
  const updateSupplementConfig = useSupplementStore((s) => s.updateSupplementConfig);
  const waterStep = waterIncrements[0] ?? 250;
  // Protein powder counts its own adds (each also a diary snack), not supplement entries.
  const powderToday = useProteinPowderStore((s) => s.todayServings);
  const powderLogs = useProteinPowderStore((s) => s.dateLogs);
  const powderConfig = configs.find((c) => c.key === PROTEIN_POWDER_KEY);
  const [powderOpen, setPowderOpen] = useState(false);
  const handleClosePowder = useCallback(() => setPowderOpen(false), []);
  // logKey picks what the sheet shows; it stays set while the sheet fades out.
  const [logKey, setLogKey] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  // Today uses the live totals; a past day adds up that day's entries.
  const { waterMl, totals } = useMemo(() => {
    let w = 0;
    let t: Record<string, number> = {};
    if (isToday) {
      w = water;
      t = { ...todayTotals, [PROTEIN_POWDER_KEY]: powderToday };
    } else {
      for (const e of dateEntries) {
        if (e.type === 'water') w += Number(e.amount);
        else t[e.type] = (t[e.type] || 0) + Number(e.amount);
      }
      t[PROTEIN_POWDER_KEY] = Math.round(powderLogs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
    }
    return { waterMl: w, totals: t };
  }, [isToday, water, todayTotals, dateEntries, powderToday, powderLogs]);

  const waterInLitres = waterGoal >= 1000;

  const handleAdd = useCallback((key: string, step: number) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === WATER_KEY) addWater(userId, step);
    else if (key === PROTEIN_POWDER_KEY) setPowderOpen(true); // choose the powder and servings
    else addSupplement(userId, key, step);
  }, [userId, addWater, addSupplement]);

  const handleOpenLog = useCallback((key: string) => {
    Haptics.selectionAsync();
    setLogKey(key);
    setLogOpen(true);
  }, []);
  const handleCloseLog = useCallback(() => setLogOpen(false), []);
  const handleLogClosed = useCallback(() => setLogKey(null), []);
  const handleDeleteEntry = useCallback((entry: LogSheetEntry) => {
    if (!userId) return;
    if (logKey === PROTEIN_POWDER_KEY) {
      const log = useProteinPowderStore.getState().dateLogs.find((l) => l.id === entry.id);
      if (log) useProteinPowderStore.getState().deleteLog(userId, log);
      return;
    }
    const supplementEntry = useSupplementStore.getState().dateEntries.find((e) => e.id === entry.id);
    if (supplementEntry) deleteSupplementEntry(userId, supplementEntry);
  }, [userId, logKey, deleteSupplementEntry]);

  const logConfig = logKey && logKey !== WATER_KEY ? configs.find((c) => c.key === logKey) : undefined;
  // Protein powder has no quick amounts: each add picks a powder and servings in its picker.
  const logAmounts = logKey === WATER_KEY ? waterIncrements : logKey === PROTEIN_POWDER_KEY ? [] : logConfig?.increments ?? [];

  // Saved to the account: supplements in their config (synced), water on this phone for now.
  const handleAmountsChange = useCallback((amounts: number[]) => {
    if (!userId || !logKey || amounts.length === 0) return;
    if (logKey === WATER_KEY) setWaterIncrements(userId, amounts);
    else updateSupplementConfig(userId, logKey, { increments: amounts });
  }, [userId, logKey, setWaterIncrements, updateSupplementConfig]);
  const handleLogAmount = useCallback((amount: number) => {
    if (logKey) handleAdd(logKey, amount);
  }, [logKey, handleAdd]);
  const logEntries: LogSheetEntry[] = useMemo(() => {
    if (!logKey) return [];
    if (logKey === PROTEIN_POWDER_KEY) {
      return powderLogs.map((l) => ({ id: l.id, amount: l.amount, created_at: l.created_at, note: l.name }));
    }
    return dateEntries
      .filter((e) => e.type === logKey)
      .map((e) => ({ id: e.id, amount: Number(e.amount), created_at: e.created_at }));
  }, [logKey, dateEntries, powderLogs]);

  // Water first, then each supplement, laid out two per row. An odd one out on the last row
  // stretches to the full width, so the grid always looks filled.
  const chips: ChipData[] = useMemo(() => {
    const list: ChipData[] = [{
      itemKey: WATER_KEY,
      label: 'Water',
      step: waterStep,
      stepText: `${formatAmount(waterStep)} ml`,
      icon: 'water-outline',
      color: colors.water,
      value: formatWater(waterMl, waterInLitres),
      goal: formatWater(waterGoal, waterInLitres),
      unit: waterInLitres ? 'L' : 'ml',
      progress: waterGoal > 0 ? waterMl / waterGoal : 0,
      canAdd: isToday,
    }];
    for (const c of configs) {
      const amount = totals[c.key] || 0;
      const step = c.increments[0] ?? c.dailyGoal;
      list.push({
        itemKey: c.key,
        label: c.name,
        step,
        stepText: `${formatAmount(step)} ${c.unit}`,
        icon: c.icon,
        color: c.color,
        value: formatAmount(amount),
        goal: formatAmount(c.dailyGoal),
        unit: c.unit,
        progress: c.dailyGoal > 0 ? amount / c.dailyGoal : 0,
        canAdd: isToday && step > 0,
      });
    }
    return list;
  }, [colors.water, waterStep, waterMl, waterGoal, waterInLitres, configs, totals, isToday]);

  const rows = useMemo(() => {
    const out: ChipData[][] = [];
    for (let i = 0; i < chips.length; i += COLUMNS) out.push(chips.slice(i, i + COLUMNS));
    return out;
  }, [chips]);

  return (
    <>
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].itemKey} style={styles.row}>
          {row.map((chip) => (
            <Chip key={chip.itemKey} {...chip} onAdd={handleAdd} onOpenLog={handleOpenLog} styles={styles} />
          ))}
        </View>
      ))}
    </View>
    <SupplementLogSheet
      visible={logOpen}
      label={logKey === WATER_KEY ? 'Water' : logConfig?.name || ''}
      unit={logKey === WATER_KEY ? 'ml' : logConfig?.unit || ''}
      color={logKey === WATER_KEY ? colors.water : logConfig?.color || colors.creatine}
      entries={logEntries}
      onDelete={handleDeleteEntry}
      amounts={logAmounts}
      onAmountsChange={handleAmountsChange}
      onLogAmount={isToday ? handleLogAmount : undefined}
      onClose={handleCloseLog}
      onClosed={handleLogClosed}
    />
    {powderConfig && (
      <ProteinPowderModal visible={powderOpen} onClose={handleClosePowder} config={powderConfig} />
    )}
    </>
  );
}

export default React.memo(HydrationStrip);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: {
      marginTop: sw(10),
      paddingHorizontal: sw(16),
      gap: sw(8),
    },
    row: {
      flexDirection: 'row',
      gap: sw(8),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(8),
      paddingLeft: sw(8),
      paddingRight: sw(10),
      // Equal halves of the row; a chip alone on the last row takes the full width.
      flex: 1,
      minWidth: 0,
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
    chipName: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
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
