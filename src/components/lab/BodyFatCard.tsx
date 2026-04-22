import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, FlatList, type ViewStyle } from 'react-native';
import {
  Canvas,
  RoundedRect,
  Path,
  Line as SkiaLine,
  Skia,
  vec,
  LinearGradient,
} from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { useBodyFatStore, type BodyFatMethod, type BodyFatEntry } from '../../stores/useBodyFatStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import { useLabTimeRangeStore, nearestRangeOption } from '../../stores/useLabTimeRangeStore';
import BottomSheet from '../workout-sheet/BottomSheet';
import BodyFatLogModal from './BodyFatLogModal';

/* ─── Config ─────────────────────────────────────────────── */

const CHART_H = sw(140);
const Y_LABEL_W = sw(34);
const GRID_STEPS = 4;
const BAR_RADIUS = sw(3);
const EMA_COLOR = '#3B82F6';
const DELETE_THRESHOLD = -80;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RANGES = [
  { label: '1W', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

type RangeLabel = typeof RANGES[number]['label'];

const METHODS = [
  { key: 'tape' as const, label: 'Tape Method', description: 'Circumference' },
  { key: 'calipers' as const, label: 'Skinfold Calipers', description: 'Skin pinch' },
  { key: 'bia' as const, label: 'Smart Scale', description: 'BIA' },
  { key: 'bod_pod' as const, label: 'Bod Pod', description: 'Air displacement' },
  { key: 'dexa' as const, label: 'DEXA Scan', description: 'X-ray absorptiometry' },
];

/* ─── Helpers ────────────────────────────────────────────── */

function buildSmoothPath(points: { x: number; y: number }[]): ReturnType<typeof Skia.Path.Make> | null {
  const valid = points.filter((p) => !isNaN(p.y) && isFinite(p.y));
  if (valid.length < 2) return null;
  const path = Skia.Path.Make();
  path.moveTo(valid[0].x, valid[0].y);
  if (valid.length === 2) { path.lineTo(valid[1].x, valid[1].y); return path; }
  for (let i = 1; i < valid.length; i++) {
    const p0 = valid[Math.max(0, i - 2)];
    const p1 = valid[i - 1];
    const p2 = valid[i];
    const p3 = valid[Math.min(valid.length - 1, i + 1)];
    path.cubicTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y,
    );
  }
  return path;
}

function fmtDate(d: Date) { return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`; }

/* ─── Component ──────────────────────────────────────────── */

interface Props {
  pageIndicator?: React.ReactNode;
}

export default function BodyFatCard({ pageIndicator }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const defaultMethod = useProfileSettingsStore((s) => s.defaultBodyFatMethod);

  const { current, change, entries, emaPoints } = useBodyFatStore(
    useShallow((s) => ({ current: s.current, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const fetchBodyFatData = useBodyFatStore((s) => s.fetchBodyFatData);
  const logBodyFat = useBodyFatStore((s) => s.logBodyFat);
  const deleteBodyFat = useBodyFatStore((s) => s.deleteBodyFat);

  const [selectedMethod, setSelectedMethod] = useState<BodyFatMethod>(defaultMethod);
  const [selectedRange, setSelectedRange] = useState<RangeLabel>('1Y');
  const [showPicker, setShowPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Sync to global Lab time range
  const globalRangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const globalVersion = useLabTimeRangeStore((s) => s.version);
  useEffect(() => {
    const nearest = nearestRangeOption(globalRangeDays, RANGES);
    setSelectedRange(nearest.label);
  }, [globalVersion]);

  const selectedDays = RANGES.find((r) => r.label === selectedRange)!.days;
  const rangeIndex = RANGES.findIndex((r) => r.label === selectedRange);
  const methodDef = METHODS.find((m) => m.key === selectedMethod)!;

  const chartOpacity = useSharedValue(1);
  const prevKey = useRef(`${selectedMethod}_${selectedRange}`);

  useEffect(() => {
    if (userId) {
      const key = `${selectedMethod}_${selectedRange}`;
      if (prevKey.current !== key) {
        chartOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.ease) });
        prevKey.current = key;
      }
      fetchBodyFatData(userId, selectedMethod, selectedDays);
    }
  }, [userId, selectedMethod, selectedRange]);

  useEffect(() => {
    if (entries.length > 0) {
      chartOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
    }
  }, [entries]);

  const chartAnimStyle = useAnimatedStyle(() => ({ opacity: chartOpacity.value }));

  const hasData = entries.length > 0;
  const changeColor = change !== null ? (change <= 0 ? colors.accentGreen : colors.accentOrange) : colors.textSecondary;

  const goShorter = useCallback(() => {
    const idx = RANGES.findIndex((r) => r.label === selectedRange);
    if (idx > 0) setSelectedRange(RANGES[idx - 1].label);
  }, [selectedRange]);
  const goLonger = useCallback(() => {
    const idx = RANGES.findIndex((r) => r.label === selectedRange);
    if (idx < RANGES.length - 1) setSelectedRange(RANGES[idx + 1].label);
  }, [selectedRange]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - selectedDays + 1);
    return `${fmtDate(start)} – ${fmtDate(now)}`;
  }, [selectedDays]);

  // Chart layout
  const cardInnerW = SCREEN_WIDTH - sw(16) * 4;
  const slotCount = entries.length || 1;
  const slotW = (cardInnerW - Y_LABEL_W) / slotCount;
  const barW = Math.min(sw(20), slotW * 0.6);

  const yScale = useMemo(() => {
    if (!hasData) return { yMin: 0, yMax: 30, yRange: 30 };
    const all = [...entries.map((e) => e.value), ...emaPoints.map((e) => e.value)];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = Math.max((max - min) * 0.15, 0.5);
    return { yMin: min - pad, yMax: max + pad, yRange: max - min + pad * 2 };
  }, [entries, emaPoints, hasData]);

  const peakIndex = useMemo(() => {
    let max = 0, idx = -1;
    entries.forEach((e, i) => { if (e.value > max) { max = e.value; idx = i; } });
    return idx;
  }, [entries]);

  const emaPath = useMemo(() => {
    if (emaPoints.length < 2) return null;
    const { yMin, yRange } = yScale;
    const pts = emaPoints.map((p, i) => ({
      x: Y_LABEL_W + i * slotW + slotW / 2,
      y: CHART_H * (1 - (p.value - yMin) / yRange),
    }));
    return buildSmoothPath(pts);
  }, [emaPoints, yScale, slotW]);

  const labelEvery = entries.length <= 7 ? 1 : entries.length <= 14 ? 2 : Math.ceil(entries.length / 7);

  const handleLog = async (value: number) => {
    if (!userId) return { error: 'Not logged in' };
    return logBodyFat(userId, value, selectedMethod, selectedDays);
  };

  const handleDelete = useCallback((entryId: string) => {
    if (!userId) return;
    deleteBodyFat(userId, entryId, selectedMethod, selectedDays);
  }, [userId, deleteBodyFat, selectedMethod, selectedDays]);

  const handleSelectMethod = useCallback((key: BodyFatMethod) => {
    setSelectedMethod(key);
    setShowPicker(false);
  }, []);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <View style={styles.accentDot} />
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Body Fat %</Text>
              {hasData && current !== null && (
                <Text style={styles.currentVal}>{current}%</Text>
              )}
            </View>
            <View style={styles.subtitleRow}>
              <Text style={styles.dateRange}>{dateRange}</Text>
              {hasData && change !== null && (
                <View style={[styles.deltaBadge, { backgroundColor: changeColor + '18' }]}>
                  <Text style={[styles.deltaText, { color: changeColor }]}>
                    {change > 0 ? '+' : ''}{change}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.logBtn} onPress={() => setShowLogModal(true)} hitSlop={8}>
            <Ionicons name="add" size={ms(16)} color={colors.accent} />
          </Pressable>
          <View style={styles.periodSelector}>
            <Pressable onPress={goShorter} style={[styles.arrowBtn, rangeIndex === 0 && styles.arrowDisabled] as ViewStyle[]} hitSlop={8}>
              <Ionicons name="chevron-back" size={ms(14)} color={rangeIndex === 0 ? colors.textTertiary + '40' : colors.textSecondary} />
            </Pressable>
            <Text style={styles.periodLabel}>{selectedRange}</Text>
            <Pressable onPress={goLonger} style={[styles.arrowBtn, rangeIndex === RANGES.length - 1 && styles.arrowDisabled] as ViewStyle[]} hitSlop={8}>
              <Ionicons name="chevron-forward" size={ms(14)} color={rangeIndex === RANGES.length - 1 ? colors.textTertiary + '40' : colors.textSecondary} />
            </Pressable>
          </View>
          {pageIndicator}
        </View>
      </View>

      {/* Method selector */}
      <Pressable style={styles.methodChip} onPress={() => setShowPicker(true)}>
        <Text style={styles.methodText}>{methodDef.label}</Text>
        <Ionicons name="chevron-down" size={ms(12)} color={colors.textTertiary} />
      </Pressable>

      {/* Chart or empty */}
      {hasData ? (
        <Pressable onPress={() => setShowHistory(true)}>
          <Animated.View style={chartAnimStyle}>
            <View style={{ height: CHART_H }}>
              {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                const val = yScale.yMax - (i / GRID_STEPS) * yScale.yRange;
                return (
                  <Text key={i} style={[styles.yLabel, { position: 'absolute', top: (i / GRID_STEPS) * CHART_H - ms(6), left: 0, width: Y_LABEL_W - sw(4) }]}>
                    {val.toFixed(1)}
                  </Text>
                );
              })}
              <Canvas style={{ position: 'absolute', left: 0, top: 0, width: cardInnerW, height: CHART_H }}>
                {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                  const y = (i / GRID_STEPS) * CHART_H;
                  return <SkiaLine key={i} p1={vec(Y_LABEL_W, y)} p2={vec(cardInnerW, y)} color={colors.cardBorder} strokeWidth={0.5} />;
                })}
                {entries.map((entry, i) => {
                  const x = Y_LABEL_W + i * slotW + (slotW - barW) / 2;
                  const barH = Math.max(BAR_RADIUS * 2, ((entry.value - yScale.yMin) / yScale.yRange) * CHART_H);
                  const y = CHART_H - barH;
                  const isPeak = i === peakIndex;
                  return (
                    <RoundedRect key={entry.id} x={x} y={y} width={barW} height={barH} r={BAR_RADIUS}>
                      <LinearGradient start={vec(0, y)} end={vec(0, CHART_H)} colors={isPeak ? [colors.accent, colors.accent + '90'] : [colors.accent + '60', colors.accent + '20']} />
                    </RoundedRect>
                  );
                })}
                {emaPath && <Path path={emaPath} style="stroke" strokeWidth={sw(1.5)} color={EMA_COLOR} strokeCap="round" />}
              </Canvas>
            </View>
            <View style={[styles.xAxisRow, { paddingLeft: Y_LABEL_W }]}>
              {entries.map((entry, i) => (
                <View key={entry.id} style={{ width: slotW, alignItems: 'center' }}>
                  {(i % labelEvery === 0 || i === entries.length - 1) && (
                    <Text style={styles.xLabel} numberOfLines={1}>{new Date(entry.date + 'T00:00:00').getDate()}</Text>
                  )}
                </View>
              ))}
            </View>
          </Animated.View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Daily</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: EMA_COLOR }]} />
              <Text style={styles.legendText}>EMA Trend</Text>
            </View>
          </View>
        </Pressable>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Log body fat to see trends</Text>
        </View>
      )}

      {/* Modals */}
      <MethodPickerModal visible={showPicker} onClose={() => setShowPicker(false)} onSelect={handleSelectMethod} selected={selectedMethod} colors={colors} />
      <BodyFatHistoryModal visible={showHistory} onClose={() => setShowHistory(false)} entries={entries} label={methodDef.label} onDelete={handleDelete} />
      <BodyFatLogModal visible={showLogModal} onClose={() => setShowLogModal(false)} onSave={handleLog} methodLabel={methodDef.label} />
    </View>
  );
}

/* ─── Method Picker Modal ────────────────────────────────── */

const MethodPickerModal = React.memo(function MethodPickerModal({
  visible, onClose, onSelect, selected, colors,
}: {
  visible: boolean; onClose: () => void; onSelect: (key: BodyFatMethod) => void; selected: BodyFatMethod; colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <BottomSheet visible={visible} onClose={onClose} height="55%" modal bgColor={colors.card}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Method</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.sheetDone}>Done</Text></TouchableOpacity>
      </View>
      <View style={styles.pickerContent}>
        {METHODS.map((m) => {
          const active = m.key === selected;
          return (
            <Pressable key={m.key} style={[styles.pickerItem, active && { backgroundColor: colors.accent }]} onPress={() => onSelect(m.key)}>
              <Text style={[styles.pickerItemText, active && { color: colors.textOnAccent }]}>{m.label}</Text>
              <Text style={[styles.pickerItemSub, active && { color: colors.textOnAccent + 'AA' }]}>{m.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
});

/* ─── Swipeable Row ──────────────────────────────────────── */

const SwipeableRow = React.memo(function SwipeableRow({
  item, onDelete, colors, styles,
}: {
  item: BodyFatEntry; onDelete: (id: string) => void; colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  const translateX = useSharedValue(0);
  const handleDelete = useCallback(() => { onDelete(item.id); }, [item.id, onDelete]);
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10]).failOffsetY([-5, 5])
    .onUpdate((e) => { if (e.translationX < 0) translateX.value = Math.max(e.translationX, DELETE_THRESHOLD - 20); })
    .onEnd((e) => {
      if (e.translationX < DELETE_THRESHOLD) { runOnJS(handleDelete)(); }
      translateX.value = withTiming(0, { duration: 200 });
    });
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const delStyle = useAnimatedStyle(() => ({ opacity: translateX.value < -20 ? 1 : 0 }));
  const dateStr = new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.deleteBackground, delStyle]}><Ionicons name="trash-outline" size={ms(20)} color="#fff" /></Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.historyRow, { backgroundColor: colors.card }, rowStyle]}>
          <Text style={styles.historyDate}>{dateStr}</Text>
          <Text style={styles.historyValue}>{item.value}%</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

/* ─── History Modal ──────────────────────────────────────── */

function BodyFatHistoryModal({
  visible, onClose, entries, label, onDelete,
}: {
  visible: boolean; onClose: () => void; entries: BodyFatEntry[]; label: string; onDelete: (id: string) => void;
}) {
  const reversed = useMemo(() => [...entries].reverse(), [entries]);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="70%" modal bgColor={colors.card}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{label} History</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.sheetDone}>Done</Text></TouchableOpacity>
      </View>
      {reversed.length === 0 ? (
        <View style={styles.historyEmpty}><Text style={styles.historyEmptyText}>No entries yet</Text></View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <SwipeableRow item={item} onDelete={onDelete} colors={colors} styles={styles} />}
        />
      )}
    </BottomSheet>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(16),
      ...colors.cardShadow,
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: sw(10) },
    header: { flexDirection: 'row', alignItems: 'center', gap: sw(8), flex: 1 },
    accentDot: { width: sw(4), height: sw(16), borderRadius: sw(2), backgroundColor: colors.accent },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: sw(8) },
    title: { color: colors.textPrimary, fontSize: ms(15), lineHeight: ms(21), fontFamily: Fonts.bold },
    currentVal: { color: colors.textSecondary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.semiBold },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: sw(6), marginTop: sw(1) },
    dateRange: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium },
    deltaBadge: { paddingHorizontal: sw(6), paddingVertical: sw(2), borderRadius: sw(6) },
    deltaText: { fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.bold },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: sw(6) },
    logBtn: { width: sw(28), height: sw(28), borderRadius: sw(8), backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    periodSelector: { flexDirection: 'row', alignItems: 'center', gap: sw(4), backgroundColor: colors.surface, borderRadius: sw(8), paddingVertical: sw(4), paddingHorizontal: sw(6) },
    arrowBtn: { padding: sw(2) },
    arrowDisabled: { opacity: 0.3 },
    periodLabel: { color: colors.textPrimary, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.bold, minWidth: sw(24), textAlign: 'center' },
    methodChip: { flexDirection: 'row', alignItems: 'center', gap: sw(6), backgroundColor: colors.surface, borderRadius: sw(8), paddingHorizontal: sw(12), paddingVertical: sw(7), marginBottom: sw(10), alignSelf: 'flex-start' },
    methodText: { color: colors.textPrimary, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.semiBold },
    yLabel: { color: colors.textTertiary, fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.medium, textAlign: 'right' },
    xAxisRow: { flexDirection: 'row', marginTop: sw(6) },
    xLabel: { color: colors.textTertiary, fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.medium, textAlign: 'center' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: sw(16), marginTop: sw(10) },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: sw(5) },
    legendLine: { width: sw(12), height: sw(1.5), borderRadius: sw(1) },
    legendText: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium },
    emptyState: { backgroundColor: colors.surface, borderRadius: sw(10), paddingVertical: sw(32), alignItems: 'center' },
    emptyText: { color: colors.textTertiary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.medium },
    pickerContent: { paddingHorizontal: sw(20), paddingTop: sw(16), paddingBottom: sw(34), gap: sw(8) },
    pickerItem: { alignItems: 'center', paddingVertical: sw(14), borderRadius: sw(10), backgroundColor: colors.surface },
    pickerItemText: { color: colors.textPrimary, fontSize: ms(14), lineHeight: ms(19), fontFamily: Fonts.semiBold },
    pickerItemSub: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, marginTop: sw(2) },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sw(20), paddingBottom: sw(12), borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    sheetTitle: { color: colors.textPrimary, fontSize: ms(20), lineHeight: ms(25), fontFamily: Fonts.bold },
    sheetDone: { color: colors.accent, fontSize: ms(16), lineHeight: ms(22), fontFamily: Fonts.semiBold },
    historyList: { paddingHorizontal: sw(20), paddingTop: sw(12), paddingBottom: sw(34) },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: sw(14), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
    historyDate: { color: colors.textSecondary, fontSize: ms(15), lineHeight: ms(21), fontFamily: Fonts.medium },
    historyValue: { color: colors.textPrimary, fontSize: ms(16), lineHeight: ms(22), fontFamily: Fonts.semiBold },
    historyEmpty: { padding: sw(40), alignItems: 'center' },
    historyEmptyText: { color: colors.textTertiary, fontSize: ms(15), lineHeight: ms(21), fontFamily: Fonts.medium },
    swipeContainer: { overflow: 'hidden' },
    deleteBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.accentRed, justifyContent: 'center', alignItems: 'flex-end', paddingRight: sw(20), borderRadius: sw(8) },
  });
