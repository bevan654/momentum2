import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, ScrollView, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useSupplementStore } from '../../../stores/useSupplementStore';
import { useProteinPowderStore, PROTEIN_POWDER_KEY } from '../../../stores/useProteinPowderStore';
import { useToday } from '../../../hooks/useToday';
import NutritionDetailModal from '../NutritionDetailModal';
import AddSupplementModal from '../AddSupplementModal';
import ProteinPowderModal from '../ProteinPowderModal';
import { formatIncrement } from '../SupplementDetailModal';
import ActivityRings, { type RingItem } from './ActivityRings';
import WeightGraph from './WeightGraph';
import SectionLabel from './SectionLabel';
import type { NutritionTotals } from './useTodayGlance';

const RING_SIZE = sw(132);

interface Chip {
  key: string;
  label: string;
  color: string;
  value: string;
  goal: string;
  add: string;
  onPress: () => void;
}

interface Props {
  /** Opens the Recovery tab (weight trend). */
  onOpenWeight: () => void;
  nutrition: NutritionTotals;
  water: number;
  waterGoal: number;
}

const ratio = (v: number, g: number) => (g > 0 ? v / g : 0);
const litres = (ml: number) => (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1);

/**
 * Home, Today section (no card), swipeable: page 1 is macros (calories, protein, carbs, fat rings with
 * kcal left inside, the weight graph beside them, P / C / F columns below), page 2 is water and
 * supplements with quick adds.
 */
function RingsHero({ nutrition, water, waterGoal, onOpenWeight }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((st) => st.user?.id);
  const { configs, totals, waterIncrements, addWater, addSupplement } = useSupplementStore(
    useShallow((st) => ({
      configs: st.supplementConfigs,
      totals: st.supplementTotals,
      waterIncrements: st.waterIncrements,
      addWater: st.addWater,
      addSupplement: st.addSupplement,
    })),
  );
  const powderServings = useProteinPowderStore((st) => st.todayServings);
  const powderConfig = useMemo(() => configs.find((c) => c.key === PROTEIN_POWDER_KEY), [configs]);
  const today = useToday();

  useEffect(() => {
    if (!userId || !powderConfig) return;
    useProteinPowderStore.getState().fetchToday(userId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') useProteinPowderStore.getState().fetchToday(userId);
    });
    return () => sub.remove();
  }, [userId, powderConfig, today]);

  const [showNutrition, setShowNutrition] = useState(false);
  const [showAddSupp, setShowAddSupp] = useState(false);
  const [showPowder, setShowPowder] = useState(false);
  const closeNutrition = useCallback(() => setShowNutrition(false), []);
  const openNutrition = useCallback(() => setShowNutrition(true), []);
  const closeAddSupp = useCallback(() => setShowAddSupp(false), []);
  const closePowder = useCallback(() => setShowPowder(false), []);
  const waterQuickAdd = waterIncrements[0] ?? 250;

  const tapWater = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addWater(userId, waterQuickAdd);
  }, [userId, addWater, waterQuickAdd]);
  const tapSupp = useCallback((key: string, amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === PROTEIN_POWDER_KEY) {
      setShowPowder(true);
      return;
    }
    if (userId) addSupplement(userId, key, amount);
  }, [userId, addSupplement]);

  const n = nutrition;
  const calOver = n.calorieGoal > 0 && n.calories > n.calorieGoal;
  const calColor = calOver ? colors.accentRed : colors.accent;
  const kcalShown = calOver ? n.calories - n.calorieGoal : Math.max(0, n.calorieGoal - n.calories);

  const chips = useMemo<Chip[]>(() => [
    {
      key: 'water', label: 'Water', color: colors.water,
      value: litres(water), goal: `${litres(waterGoal)} L`, add: `+${waterQuickAdd} ml`, onPress: tapWater,
    },
    ...configs.map((c) => {
      const inc = c.increments[0] ?? c.dailyGoal;
      return {
        key: c.key, label: c.name, color: c.color,
        value: formatIncrement(c.key === PROTEIN_POWDER_KEY ? powderServings : totals[c.key] || 0), goal: `${formatIncrement(c.dailyGoal)}${c.unit}`,
        add: `+${formatIncrement(inc)}${c.unit}`, onPress: () => tapSupp(c.key, inc),
      };
    }),
  ], [water, waterGoal, waterQuickAdd, configs, totals, powderServings, colors, tapWater, tapSupp]);

  interface Column {
    key: string;
    label: string;
    color: string;
    value: string;
    goal: string;
    over?: boolean;
    add?: string;
    onPress?: () => void;
  }
  interface Page {
    key: string;
    rings: RingItem[];
    center: { value: string; label: string; over?: boolean };
    columns: Column[];
    nutrition: boolean;
  }

  const pages = useMemo<Page[]>(() => {
    const macro = (key: string, label: string, eaten: number, goal: number, color: string): Column => {
      const over = goal > 0 && eaten > goal;
      return { key, label, color: over ? colors.accentRed : color, value: `${Math.round(eaten)}g`, goal: `${goal}g`, over };
    };
    const progressOf = (c: Chip) =>
      c.key === 'water' ? ratio(water, waterGoal) : ratio(c.key === PROTEIN_POWDER_KEY ? powderServings : totals[c.key] || 0, configs.find((x) => x.key === c.key)?.dailyGoal ?? 0);
    return [
      {
        key: 'macros',
        nutrition: true,
        rings: [
          { key: 'kcal', progress: ratio(n.calories, n.calorieGoal), color: calColor },
          { key: 'p', progress: ratio(n.protein, n.proteinGoal), color: colors.protein },
          { key: 'c', progress: ratio(n.carbs, n.carbsGoal), color: colors.carbs },
          { key: 'f', progress: ratio(n.fat, n.fatGoal), color: colors.fat },
        ],
        center: { value: kcalShown.toLocaleString(), label: calOver ? 'kcal over' : 'kcal left', over: calOver },
        columns: [
          macro('p', 'Protein', n.protein, n.proteinGoal, colors.protein),
          macro('c', 'Carbs', n.carbs, n.carbsGoal, colors.carbs),
          macro('f', 'Fat', n.fat, n.fatGoal, colors.fat),
        ],
      },
      {
        key: 'supps',
        nutrition: false,
        rings: chips.slice(0, 4).map((c) => ({ key: c.key, progress: progressOf(c), color: c.color })),
        center: { value: `${Math.round(ratio(water, waterGoal) * 100)}%`, label: 'water' },
        columns: chips.map((c) => ({ key: c.key, label: c.label, color: c.color, value: c.value, goal: c.goal, add: c.add, onPress: c.onPress })),
      },
    ];
  }, [n, calColor, calOver, kcalShown, chips, water, waterGoal, totals, powderServings, configs, colors]);

  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  // Each page's own height.
  const [heights, setHeights] = useState<number[]>([]);
  // Always the taller page's height, so nothing below moves when swiping between pages.
  const pagerHeight = heights.length ? Math.max(...heights.filter(Boolean)) : undefined;
  const onPageLayout = useCallback((i: number, h: number) => {
    setHeights((prev) => {
      if (prev[i] === h) return prev;
      const next = prev.slice();
      next[i] = h;
      return next;
    });
  }, []);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }, [width]);

  return (
    <View style={s.wrap} onLayout={onLayout}>
      <SectionLabel
        label="Today"
        detail={page === 0 ? 'Swipe for supplements' : '+ Add supplement'}
        onDetailPress={page === 0 ? undefined : () => setShowAddSupp(true)}
      />
      {width > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} style={{ width, height: pagerHeight }} contentContainerStyle={s.pager}>
          {pages.map((p, i) => (
            <View key={p.key} style={[s.page, { width }]} onLayout={(e) => onPageLayout(i, e.nativeEvent.layout.height)}>
              <View style={[s.topRow, p.key === 'macros' && s.topRowSplit]}>
                <TouchableOpacity
                  style={s.ringWrap}
                  activeOpacity={p.nutrition ? 0.85 : 1}
                  disabled={!p.nutrition}
                  onPress={openNutrition}
                  accessibilityLabel={p.nutrition ? 'Nutrition breakdown' : undefined}
                >
                  <ActivityRings rings={p.rings} size={RING_SIZE} stroke={p.rings.length > 3 ? sw(12) : sw(15)} gap={sw(3)} />
                  <View style={s.ringCenter} pointerEvents="none">
                    <Text style={[s.centerValue, p.center.over && { color: colors.accentRed }]} numberOfLines={1} adjustsFontSizeToFit>
                      {p.center.value}
                    </Text>
                    <Text style={s.centerLabel}>{p.center.label}</Text>
                  </View>
                </TouchableOpacity>
                {p.key === 'macros' && <WeightGraph onOpen={onOpenWeight} />}
              </View>

              <View style={s.columns}>
                {p.columns.map((c) => (
                  <View key={c.key} style={s.col}>
                    <Text style={[s.colLabel, { color: c.color }]} numberOfLines={1}>{c.label}</Text>
                    <Text style={[s.colValue, c.over && { color: colors.accentRed }]} numberOfLines={1} adjustsFontSizeToFit>
                      {c.value}
                      {c.add && <Text style={s.colGoalInline}> / {c.goal}</Text>}
                    </Text>
                    {/* Supplements show the goal inline and a quick add instead, so both pages are the same height. */}
                    {!c.add && <Text style={s.colGoal} numberOfLines={1}>of {c.goal}</Text>}
                    {c.add && c.onPress && (
                      <TouchableOpacity style={[s.addBtn, { borderColor: c.color + '66' }]} onPress={c.onPress} hitSlop={4} activeOpacity={0.6}>
                        <Text style={s.addText} numberOfLines={1}>{c.add}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

            </View>
          ))}
        </ScrollView>
      )}

      <View style={s.dots}>
        {pages.map((p, i) => (
          <View key={p.key} style={[s.dot, i === page && s.dotOn]} />
        ))}
      </View>

      <NutritionDetailModal visible={showNutrition} onClose={closeNutrition} totals={nutrition} />
      <AddSupplementModal visible={showAddSupp} onClose={closeAddSupp} />
      {powderConfig && <ProteinPowderModal visible={showPowder} onClose={closePowder} config={powderConfig} />}
    </View>
  );
}

export default React.memo(RingsHero);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { paddingTop: sw(4) },
    pager: { alignItems: 'flex-start' },
    page: { alignItems: 'center' },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
    topRowSplit: { justifyContent: 'flex-start', gap: sw(18) },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: sw(5), marginTop: sw(8) },
    dot: { width: sw(6), height: sw(6), borderRadius: sw(3), backgroundColor: colors.ring.track },
    dotOn: { width: sw(16), backgroundColor: colors.accent },
    ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
    ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    centerValue: {
      color: colors.textPrimary,
      fontSize: ms(24),
      lineHeight: ms(28),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1,
      maxWidth: RING_SIZE * 0.42,
    },
    centerLabel: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.semiBold },
    columns: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'stretch', rowGap: sw(10), marginTop: sw(12) },
    col: { width: '33.33%', alignItems: 'center', paddingHorizontal: sw(4) },
    colLabel: { fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
    colValue: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(22),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.4,
      marginTop: sw(1),
    },
    colGoal: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.medium },
    colGoalInline: { color: colors.textTertiary, fontSize: ms(11), fontFamily: Fonts.medium, letterSpacing: 0 },
    addBtn: {
      marginTop: sw(4),
      height: sw(22),
      paddingHorizontal: sw(10),
      borderRadius: sw(12),
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: { color: colors.textPrimary, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.semiBold },
  });
