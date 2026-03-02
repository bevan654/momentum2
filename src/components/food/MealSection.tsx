import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry } from '../../stores/useFoodLogStore';
import type { SupplementEntry } from '../../stores/useSupplementStore';

/* ─── Constants ────────────────────────────────────────── */

const START_HOUR = 0;
const END_HOUR = 23;
const DOT_FILLED = sw(8);
const DOT_EMPTY = sw(5);
const ROW_HEIGHT = sw(44);
const DRAG_SPRING = { damping: 20, stiffness: 300, mass: 0.6, overshootClamping: true };

const SECTIONS: { hour: number; label: string; start: number; end: number }[] = [
  { hour: 6, label: 'Breakfast', start: 6, end: 10 },
  { hour: 11, label: 'Lunch', start: 11, end: 14 },
  { hour: 15, label: 'Snack', start: 15, end: 16 },
  { hour: 17, label: 'Dinner', start: 17, end: 23 },
];
const SECTION_AT_HOUR: Record<number, typeof SECTIONS[number]> = {};
for (const s of SECTIONS) SECTION_AT_HOUR[s.hour] = s;

const HOUR_LABELS: string[] = [];
for (let h = 0; h < 24; h++) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  HOUR_LABELS[h] = `${h12} ${ampm}`;
}

function getDefaultSlot(h: number): string {
  if (h < 11) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

function getEntryHour(entry: FoodEntry): number {
  try {
    const d = new Date(entry.created_at);
    if (!isNaN(d.getTime())) return d.getHours();
  } catch { /* fallback */ }
  return 12;
}

function getMealEmoji(hour: number): string {
  if (hour < 6) return '\u{1F319}';
  if (hour < 11) return '\u{1F373}';
  if (hour < 14) return '\u{2600}\u{FE0F}';
  if (hour < 17) return '\u{1F36A}';
  if (hour < 21) return '\u{1F37D}\u{FE0F}';
  return '\u{1F319}';
}

/* ─── Entry card (memoized) ────────────────────────────── */

interface EntryCardProps {
  entry: FoodEntry;
  onPress: (entry: FoodEntry) => void;
  onEdit: (entry: FoodEntry) => void;
  onTogglePlanned: (id: string) => void;
  onMoveEntry?: (entryId: string, hour: number) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

const EntryCard = React.memo(function EntryCard({
  entry, onPress, onEdit, onTogglePlanned, onMoveEntry, styles, colors,
}: EntryCardProps) {
  const handlePress = useCallback(() => onPress(entry), [entry, onPress]);
  const handleEdit = useCallback(() => onEdit(entry), [entry, onEdit]);
  const handleToggle = useCallback(() => onTogglePlanned(entry.id), [entry.id, onTogglePlanned]);
  const hour = useMemo(() => getEntryHour(entry), [entry]);
  const emoji = useMemo(() => getMealEmoji(hour), [hour]);

  /* ── Long-press drag to move hour ──────────────────── */
  const isDragging = useSharedValue(0);
  const translateY = useSharedValue(0);
  const dragScale = useSharedValue(1);

  const onMoveRef = React.useRef(onMoveEntry);
  onMoveRef.current = onMoveEntry;
  const entryIdRef = React.useRef(entry.id);
  entryIdRef.current = entry.id;
  const hourRef = React.useRef(hour);
  hourRef.current = hour;

  const fireHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  const commitMove = useCallback((newHour: number) => {
    onMoveRef.current?.(entryIdRef.current, newHour);
  }, []);

  const longPress = useMemo(() =>
    Gesture.LongPress()
      .minDuration(400)
      .onStart(() => {
        'worklet';
        isDragging.value = 1;
        dragScale.value = withSpring(1.04, DRAG_SPRING);
        runOnJS(fireHaptic)();
      }),
    [],
  );

  const pan = useMemo(() =>
    Gesture.Pan()
      .manualActivation(true)
      .onTouchesMove((_e, state) => {
        'worklet';
        if (isDragging.value === 1) {
          state.activate();
        } else {
          state.fail();
        }
      })
      .onUpdate((e) => {
        'worklet';
        translateY.value = e.translationY;
      })
      .onEnd((e) => {
        'worklet';
        const hourDelta = Math.round(e.translationY / ROW_HEIGHT);
        const newHour = Math.max(0, Math.min(23, hourRef.current + hourDelta));
        if (hourDelta !== 0) {
          runOnJS(commitMove)(newHour);
        }
        translateY.value = withSpring(0, DRAG_SPRING);
        dragScale.value = withSpring(1, DRAG_SPRING);
        isDragging.value = 0;
      })
      .onFinalize(() => {
        'worklet';
        translateY.value = withSpring(0, DRAG_SPRING);
        dragScale.value = withSpring(1, DRAG_SPRING);
        isDragging.value = 0;
      }),
    [],
  );

  const composed = useMemo(() => Gesture.Simultaneous(longPress, pan), [longPress, pan]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: dragScale.value },
    ],
    zIndex: isDragging.value === 1 ? 100 : 0,
    opacity: withTiming(isDragging.value === 1 ? 0.92 : 1, { duration: 120 }),
  }));

  const entryContent = (
    <Pressable style={styles.entryCard} onPress={handlePress}>
      <View style={styles.entryTopRow}>
        <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
        {entry.is_planned && (
          <Pressable onPress={handleToggle} hitSlop={6}>
            <View style={styles.plannedTag}>
              <Text style={styles.plannedTagText}>PLANNED</Text>
            </View>
          </Pressable>
        )}
        <Text style={styles.entryCal}>{Math.round(entry.calories)} kcal</Text>
      </View>
      <View style={styles.entryMacros}>
        <Text style={[styles.macroText, { color: colors.protein }]}>P {Math.round(entry.protein)}g</Text>
        <View style={styles.macroDot} />
        <Text style={[styles.macroText, { color: colors.carbs }]}>C {Math.round(entry.carbs)}g</Text>
        <View style={styles.macroDot} />
        <Text style={[styles.macroText, { color: colors.fat }]}>F {Math.round(entry.fat)}g</Text>
      </View>
    </Pressable>
  );

  if (onMoveEntry) {
    return (
      <GestureDetector gesture={composed}>
        <Animated.View style={dragStyle} collapsable={false}>
          {entryContent}
        </Animated.View>
      </GestureDetector>
    );
  }

  return entryContent;
});

/* ─── Hour row (memoized) ──────────────────────────────── */

interface HourRowProps {
  hour: number;
  items: TimelineItem[];
  entries: FoodEntry[];
  isFirst: boolean;
  isLast: boolean;
  hasSection: boolean;
  accentColor: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onAddFood: (slot: string, hour: number) => void;
  onPressEntry: (entry: FoodEntry) => void;
  onEditEntry: (entry: FoodEntry) => void;
  onTogglePlanned: (id: string) => void;
  onMoveEntry?: (entryId: string, hour: number) => void;
  onPressMealGroup?: (groupId: string, entries: FoodEntry[]) => void;
  onDeleteMealGroup?: (groupId: string) => void;
  onDeleteSupplement?: (supplement: SupplementEntry) => void;
}

const HourRow = React.memo(function HourRow({
  hour, items, entries, isFirst, isLast, hasSection, accentColor,
  styles, colors, onAddFood, onPressEntry, onEditEntry, onTogglePlanned, onMoveEntry,
  onPressMealGroup, onDeleteMealGroup, onDeleteSupplement,
}: HourRowProps) {
  const hasEntries = entries.length > 0 || items.length > 0;
  const handleAdd = useCallback(() => onAddFood(getDefaultSlot(hour), hour), [hour, onAddFood]);
  const noopPressMealGroup = useCallback((_gid: string, _entries: FoodEntry[]) => {}, []);
  const noopDeleteMealGroup = useCallback((_gid: string) => {}, []);

  return (
    <Pressable style={styles.timelineRow} onPress={handleAdd}>
      <View style={styles.leftCol}>
        <Text style={[styles.timeLabel, hasEntries && styles.timeLabelActive]}>
          {HOUR_LABELS[hour]}
        </Text>
        <View style={styles.dotCol}>
          <View style={[styles.lineSegment, (isFirst && !hasSection) && styles.lineHidden]} />
          {hasEntries ? (
            <View style={[styles.dotFilled, { backgroundColor: accentColor }]} />
          ) : (
            <View style={styles.dotEmpty} />
          )}
          <View style={[styles.lineSegment, isLast && styles.lineHidden]} />
        </View>
      </View>
      <View style={[styles.rightCol, !hasEntries && styles.rightColEmpty]}>
        {items.map((item) =>
          item.type === 'mealGroup' ? (
            <MealGroupCard
              key={`mg-${item.groupId}`}
              groupId={item.groupId}
              groupName={item.groupName}
              entries={item.entries}
              onPress={onPressMealGroup || noopPressMealGroup}
              onDelete={onDeleteMealGroup || noopDeleteMealGroup}
              styles={styles}
              colors={colors}
            />
          ) : item.type === 'supplement' ? (
            <SupplementCard
              key={`sup-${item.supplement.id}`}
              supplement={item.supplement}
              onDelete={onDeleteSupplement}
              styles={styles}
              colors={colors}
            />
          ) : (
            <EntryCard
              key={item.entry.id}
              entry={item.entry}
              onPress={onPressEntry}
              onEdit={onEditEntry}
              onTogglePlanned={onTogglePlanned}
              onMoveEntry={onMoveEntry}
              styles={styles}
              colors={colors}
            />
          ),
        )}
      </View>
    </Pressable>
  );
});

/* ─── Divider (memoized) ───────────────────────────────── */

interface DividerProps {
  label: string;
  cals: number;
  styles: ReturnType<typeof createStyles>;
}

const Divider = React.memo(function Divider({ label, cals, styles }: DividerProps) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      {cals > 0 && (
        <View style={styles.calPill}>
          <Text style={styles.calPillText}>{cals} kcal</Text>
        </View>
      )}
      <View style={styles.dividerLine} />
    </View>
  );
});

/* ─── Now line (memoized) ──────────────────────────────── */

const NowLine = React.memo(function NowLine({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.nowRow}>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
});

/* ─── Main component ───────────────────────────────────── */

/* ─── Timeline item union ──────────────────────────────── */

type TimelineItem =
  | { type: 'entry'; entry: FoodEntry }
  | { type: 'mealGroup'; groupId: string; groupName: string; entries: FoodEntry[] }
  | { type: 'supplement'; supplement: SupplementEntry };

/* ─── Meal group card (memoized) ──────────────────────── */

interface MealGroupCardProps {
  groupId: string;
  groupName: string;
  entries: FoodEntry[];
  onPress: (groupId: string, entries: FoodEntry[]) => void;
  onDelete: (groupId: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

const MealGroupCard = React.memo(function MealGroupCard({
  groupId, groupName, entries, onPress, onDelete, styles, colors,
}: MealGroupCardProps) {
  const handlePress = useCallback(() => onPress(groupId, entries), [groupId, entries, onPress]);
  const handleDelete = useCallback(() => {
    Alert.alert('Delete Meal', `Remove "${groupName}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(groupId) },
    ]);
  }, [groupId, groupName, onDelete]);

  const hour = useMemo(() => getEntryHour(entries[0]), [entries]);
  const emoji = useMemo(() => getMealEmoji(hour), [hour]);

  const totals = useMemo(() => {
    let cal = 0, pro = 0, carb = 0, fat = 0;
    for (const e of entries) {
      cal += e.calories;
      pro += e.protein;
      carb += e.carbs;
      fat += e.fat;
    }
    return { cal: Math.round(cal), pro: Math.round(pro), carb: Math.round(carb), fat: Math.round(fat) };
  }, [entries]);

  return (
    <Pressable style={[styles.entryCard, styles.mealGroupCard]} onPress={handlePress}>
      <View style={styles.entryMeta}>
        <Text style={styles.entryEmoji}>{emoji}</Text>
        <View style={styles.entryCalPill}>
          <Text style={styles.entryCalText}>{totals.cal} kcal</Text>
        </View>
        <View style={styles.mealGroupBadge}>
          <Ionicons name="restaurant-outline" size={ms(9)} color={colors.accent} />
          <Text style={styles.mealGroupBadgeText}>{entries.length} items</Text>
        </View>
        <View style={styles.entryMetaSpacer} />
        <Pressable onPress={handleDelete} hitSlop={6} style={styles.mealGroupDeleteBtn}>
          <Ionicons name="trash-outline" size={ms(13)} color={colors.accentRed} />
        </Pressable>
        <Pressable onPress={handlePress} hitSlop={6} style={styles.editBtn}>
          <Ionicons name="pencil-outline" size={ms(13)} color={colors.textTertiary} />
        </Pressable>
      </View>
      <Text style={styles.entryName} numberOfLines={1}>{groupName}</Text>
      <View style={styles.entryMacros}>
        <Text style={[styles.macroText, { color: colors.protein }]}>P {totals.pro}g</Text>
        <View style={styles.macroDot} />
        <Text style={[styles.macroText, { color: colors.carbs }]}>C {totals.carb}g</Text>
        <View style={styles.macroDot} />
        <Text style={[styles.macroText, { color: colors.fat }]}>F {totals.fat}g</Text>
      </View>
    </Pressable>
  );
});

/* ─── Supplement card (memoized) ──────────────────────── */

interface SupplementCardProps {
  supplement: SupplementEntry;
  onDelete?: (supplement: SupplementEntry) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

const SupplementCard = React.memo(function SupplementCard({
  supplement, onDelete, styles, colors,
}: SupplementCardProps) {
  const isWater = supplement.type === 'water';
  const icon = isWater ? 'water-outline' : 'flash-outline';
  const label = isWater ? 'Water' : 'Creatine';
  const amount = isWater
    ? `${Math.round(supplement.amount)} ml`
    : `${supplement.amount} g`;
  const tint = isWater ? colors.water : colors.creatine;
  const handleDelete = useCallback(() => onDelete?.(supplement), [supplement, onDelete]);

  return (
    <View style={[styles.entryCard, styles.supplementCard, { borderLeftColor: tint }]}>
      <View style={styles.entryTopRow}>
        <Ionicons name={icon} size={ms(14)} color={tint} />
        <Text style={[styles.entryName, { color: tint }]}>{label}</Text>
        <Text style={styles.entryCal}>{amount}</Text>
        {onDelete && (
          <Pressable onPress={handleDelete} hitSlop={8}>
            <Ionicons name="close-circle" size={ms(16)} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

/* ─── Props ────────────────────────────────────────────── */

interface Props {
  entries: FoodEntry[];
  supplementEntries?: SupplementEntry[];
  onTogglePlanned: (id: string) => void;
  onAddFood: (mealSlot: string, hour?: number) => void;
  onPressEntry: (entry: FoodEntry) => void;
  onEditEntry: (entry: FoodEntry) => void;
  onMoveEntry?: (entryId: string, hour: number) => void;
  onPressMealGroup?: (groupId: string, entries: FoodEntry[]) => void;
  onDeleteMealGroup?: (groupId: string) => void;
  onDeleteSupplement?: (supplement: SupplementEntry) => void;
  nowRef?: React.RefObject<View>;
  isToday?: boolean;
}

function MealSection({ entries, supplementEntries, onTogglePlanned, onAddFood, onPressEntry, onEditEntry, onMoveEntry, onPressMealGroup, onDeleteMealGroup, onDeleteSupplement, nowRef, isToday = true }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const entriesByHour = useMemo(() => {
    const map: Record<number, FoodEntry[]> = {};
    for (const e of entries) {
      const h = getEntryHour(e);
      if (!map[h]) map[h] = [];
      map[h].push(e);
    }
    for (const h of Object.keys(map)) {
      map[+h].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [entries]);

  /* ── Supplement entries grouped by hour ──────────── */
  const suppByHour = useMemo(() => {
    const map: Record<number, SupplementEntry[]> = {};
    if (!supplementEntries) return map;
    for (const s of supplementEntries) {
      try {
        const h = new Date(s.created_at).getHours();
        if (!map[h]) map[h] = [];
        map[h].push(s);
      } catch { /* skip */ }
    }
    return map;
  }, [supplementEntries]);

  /* ── Group entries into TimelineItems per hour ────── */
  const itemsByHour = useMemo(() => {
    const map: Record<number, TimelineItem[]> = {};
    // Collect all hours that have either food or supplement entries
    const allHours = new Set<number>();
    for (const h of Object.keys(entriesByHour)) allHours.add(+h);
    for (const h of Object.keys(suppByHour)) allHours.add(+h);

    for (const h of allHours) {
      const hourEntries = entriesByHour[h] || [];

      // Rebuild items in correct order
      const finalItems: TimelineItem[] = [];
      const usedGroups = new Set<string>();
      for (const e of hourEntries) {
        if (e.meal_group_id) {
          if (!usedGroups.has(e.meal_group_id)) {
            usedGroups.add(e.meal_group_id);
            const groupEntries = hourEntries.filter((x) => x.meal_group_id === e.meal_group_id);
            finalItems.push({
              type: 'mealGroup',
              groupId: e.meal_group_id,
              groupName: e.meal_group_name || 'Meal',
              entries: groupEntries,
            });
          }
        } else {
          finalItems.push({ type: 'entry', entry: e });
        }
      }

      // Append supplement entries for this hour
      for (const s of (suppByHour[h] || [])) {
        finalItems.push({ type: 'supplement', supplement: s });
      }

      map[h] = finalItems;
    }
    return map;
  }, [entriesByHour, suppByHour]);

  const sectionCals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const s of SECTIONS) {
      let cal = 0;
      for (let h = s.start; h <= s.end; h++) {
        for (const e of entriesByHour[h] || []) cal += e.calories;
      }
      totals[s.hour] = Math.round(cal);
    }
    return totals;
  }, [entriesByHour]);

  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const timer = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const EMPTY: FoodEntry[] = useMemo(() => [], []);
  const EMPTY_ITEMS: TimelineItem[] = useMemo(() => [], []);

  return (
    <View style={styles.container}>
      {(() => {
        const elements: React.ReactNode[] = [];
        for (let h = START_HOUR; h <= END_HOUR; h++) {
          const section = SECTION_AT_HOUR[h];
          if (section) {
            elements.push(
              <Divider
                key={`d-${h}`}
                label={section.label}
                cals={sectionCals[section.hour]}
                styles={styles}
              />,
            );
          }
          elements.push(
            <HourRow
              key={h}
              hour={h}
              items={itemsByHour[h] || EMPTY_ITEMS}
              entries={entriesByHour[h] || EMPTY}
              isFirst={h === START_HOUR && !section}
              isLast={h === END_HOUR}
              hasSection={!!section}
              accentColor={colors.accent}
              styles={styles}
              colors={colors}
              onAddFood={onAddFood}
              onPressEntry={onPressEntry}
              onEditEntry={onEditEntry}
              onTogglePlanned={onTogglePlanned}
              onMoveEntry={onMoveEntry}
              onPressMealGroup={onPressMealGroup}
              onDeleteMealGroup={onDeleteMealGroup}
              onDeleteSupplement={onDeleteSupplement}
            />,
          );
          if (isToday && h === currentHour) {
            elements.push(
              <View key="now" ref={nowRef} collapsable={false}>
                <NowLine styles={styles} />
              </View>,
            );
          }
        }
        return elements;
      })()}
    </View>
  );
}

export default React.memo(MealSection);

/* ─── Styles ───────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: sw(16),
      paddingVertical: sw(8),
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.textTertiary + '40',
    },
    leftCol: {
      width: sw(62),
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeLabel: {
      width: sw(40),
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
      textAlign: 'right',
      paddingRight: sw(6),
      opacity: 0.6,
    },
    timeLabelActive: {
      fontFamily: Fonts.bold,
      opacity: 1,
    },
    dotCol: {
      width: sw(22),
      alignItems: 'center',
    },
    lineSegment: {
      flex: 1,
      width: sw(1.5),
      backgroundColor: colors.surface,
    },
    lineHidden: {
      backgroundColor: 'transparent',
    },
    dotFilled: {
      width: DOT_FILLED,
      height: DOT_FILLED,
      borderRadius: DOT_FILLED / 2,
    },
    dotEmpty: {
      width: DOT_EMPTY,
      height: DOT_EMPTY,
      borderRadius: DOT_EMPTY / 2,
      backgroundColor: colors.surface,
    },
    rightCol: {
      flex: 1,
      paddingVertical: sw(4),
      gap: sw(6),
    },
    rightColEmpty: {
      minHeight: sw(28),
    },
    entryCard: {
      borderRadius: sw(12),
      padding: sw(10),
      gap: sw(3),
    },
    entryMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    entryTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    entryName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.semiBold,
    },
    entryCal: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    entryMacros: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    macroText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    macroDot: {
      width: sw(2.5),
      height: sw(2.5),
      borderRadius: sw(1.5),
      backgroundColor: colors.textTertiary,
      opacity: 0.4,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(10),
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
    },
    dividerLabel: {
      color: colors.accent,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.extraBold,
      letterSpacing: 0.3,
    },
    calPill: {
      backgroundColor: colors.accent + '18',
      borderRadius: sw(10),
      paddingHorizontal: sw(8),
      paddingVertical: sw(2),
    },
    calPillText: {
      color: colors.accent,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.bold,
      letterSpacing: 0.2,
    },
    nowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(2),
    },
    nowDot: {
      width: sw(8),
      height: sw(8),
      borderRadius: sw(4),
      backgroundColor: colors.accentRed,
    },
    nowLine: {
      flex: 1,
      height: sw(1.5),
      backgroundColor: colors.accentRed,
    },
    plannedTag: {
      backgroundColor: colors.accentGreen + '18',
      borderRadius: sw(4),
      paddingHorizontal: sw(5),
      paddingVertical: sw(1.5),
    },
    plannedTagText: {
      color: colors.accentGreen,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.extraBold,
      letterSpacing: 0.3,
    },
    /* Supplement card */
    supplementCard: {
      borderLeftWidth: sw(3),
      backgroundColor: colors.surface,
    },
    /* Meal group card */
    mealGroupCard: {
      borderLeftWidth: sw(3),
      borderLeftColor: colors.accent,
    },
    mealGroupBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.accent + '15',
      borderRadius: sw(6),
      paddingHorizontal: sw(6),
      paddingVertical: sw(1.5),
      gap: sw(3),
    },
    mealGroupBadgeText: {
      color: colors.accent,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.bold,
    },
    mealGroupDeleteBtn: {
      width: sw(26),
      height: sw(26),
      borderRadius: sw(8),
      backgroundColor: colors.accentRed + '15',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
  });
