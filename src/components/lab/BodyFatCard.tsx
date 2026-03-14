import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, FlatList } from 'react-native';
import Svg, { Rect, Circle, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import BottomSheet from '../workout-sheet/BottomSheet';

const CHART_HEIGHT = sw(160);
const CHART_PADDING_LEFT = sw(36);
const CHART_PADDING_RIGHT = sw(12);
const CHART_PADDING_TOP = sw(16);
const CHART_PADDING_BOTTOM = sw(20);
const BAR_WIDTH = sw(6);
const EMA_COLOR = '#3B82F6';
const GRID_COLOR = '#2A2A2E';

const RANGES = [
  { label: '1W', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

type RangeLabel = typeof RANGES[number]['label'];

/* ─── Measurement Methods ────────────────────────────────── */

const METHODS = [
  { key: 'tape', label: 'Tape Method', description: 'Circumference' },
  { key: 'calipers', label: 'Skinfold Calipers', description: 'Skin pinch' },
  { key: 'bia', label: 'Smart Scale', description: 'BIA' },
  { key: 'bod_pod', label: 'Bod Pod', description: 'Air displacement' },
  { key: 'dexa', label: 'DEXA Scan', description: 'X-ray absorptiometry' },
] as const;

type MethodKey = typeof METHODS[number]['key'];

/* ─── Mock Data ──────────────────────────────────────────── */

type MockEntry = { date: string; value: number };

const MOCK_DATA: Record<MethodKey, MockEntry[]> = {
  tape: [
    { date: '2025-10-14', value: 18.2 },
    { date: '2025-11-11', value: 17.8 },
    { date: '2025-12-09', value: 17.5 },
    { date: '2026-01-06', value: 17.1 },
    { date: '2026-01-20', value: 16.8 },
    { date: '2026-02-03', value: 16.5 },
    { date: '2026-02-17', value: 16.2 },
    { date: '2026-03-03', value: 15.9 },
    { date: '2026-03-09', value: 15.7 },
  ],
  calipers: [
    { date: '2025-10-14', value: 17.5 },
    { date: '2025-11-11', value: 17.0 },
    { date: '2025-12-09', value: 16.8 },
    { date: '2026-01-06', value: 16.3 },
    { date: '2026-02-03', value: 15.8 },
    { date: '2026-03-03', value: 15.4 },
    { date: '2026-03-09', value: 15.1 },
  ],
  bia: [
    { date: '2025-10-14', value: 19.8 },
    { date: '2025-11-11', value: 19.3 },
    { date: '2025-12-09', value: 18.9 },
    { date: '2026-01-06', value: 18.5 },
    { date: '2026-01-20', value: 18.1 },
    { date: '2026-02-03', value: 17.7 },
    { date: '2026-02-17', value: 17.4 },
    { date: '2026-03-03', value: 17.0 },
    { date: '2026-03-09', value: 16.8 },
  ],
  bod_pod: [
    { date: '2025-11-11', value: 17.2 },
    { date: '2026-01-06', value: 16.5 },
    { date: '2026-03-09', value: 15.6 },
  ],
  dexa: [
    { date: '2025-10-14', value: 18.0 },
    { date: '2026-01-06', value: 16.9 },
    { date: '2026-03-09', value: 15.8 },
  ],
};

/* ─── Component ──────────────────────────────────────────── */

export default function BodyFatCard() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const defaultMethod = useProfileSettingsStore((s) => s.defaultBodyFatMethod);
  const [selectedMethod, setSelectedMethod] = useState<MethodKey>(defaultMethod);
  const [selectedRange, setSelectedRange] = useState<RangeLabel>('1Y');
  const [showPicker, setShowPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const methodDef = METHODS.find((m) => m.key === selectedMethod)!;
  const allData = MOCK_DATA[selectedMethod] ?? [];

  const selectedDays = RANGES.find((r) => r.label === selectedRange)!.days;
  const data = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedDays);
    return allData.filter((d) => new Date(d.date) >= cutoff);
  }, [allData, selectedDays]);
  const hasData = data.length > 0;

  const latest = hasData ? data[data.length - 1] : null;
  const first = hasData ? data[0] : null;
  const changeVal = latest && first ? Math.round((latest.value - first.value) * 10) / 10 : 0;
  const changeStr = `${changeVal > 0 ? '+' : ''}${changeVal}`;

  // Lower BF% is typically the goal
  const changeColor = changeVal <= 0 ? colors.accentGreen : colors.accentOrange;

  const handleSelectMethod = useCallback((key: MethodKey) => {
    setSelectedMethod(key);
    setShowPicker(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Body Fat %</Text>
        <TouchableOpacity style={styles.logButton} onPress={() => {}}>
          <Text style={styles.logButtonText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {/* Time range picker */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = r.label === selectedRange;
          return (
            <Pressable
              key={r.label}
              style={[styles.rangeChip, active && { backgroundColor: colors.accent }]}
              onPress={() => setSelectedRange(r.label)}
            >
              <Text style={[styles.rangeChipText, active && { color: colors.textOnAccent }]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Method selector */}
      <Pressable style={styles.methodDropdown} onPress={() => setShowPicker(true)}>
        <View>
          <Text style={styles.methodDropdownText}>{methodDef.label}</Text>
          <Text style={styles.methodDropdownSub}>{methodDef.description}</Text>
        </View>
        <Ionicons name="chevron-down" size={ms(16)} color={colors.textSecondary} />
      </Pressable>

      {hasData ? (
        <>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{latest!.value}%</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: changeColor }]}>{changeStr}%</Text>
              <Text style={styles.statLabel}>Change</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data.length}</Text>
              <Text style={styles.statLabel}>Entries</Text>
            </View>
          </View>

          {/* Chart */}
          <TouchableOpacity activeOpacity={0.7} onPress={() => setShowHistory(true)}>
            <BodyFatChart data={data} colors={colors} />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.textTertiary }]} />
                <Text style={styles.legendText}>Daily</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: EMA_COLOR }]} />
                <Text style={styles.legendText}>EMA Trend</Text>
              </View>
            </View>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data for {methodDef.label}</Text>
        </View>
      )}

      {/* Method picker modal */}
      <MethodPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelectMethod}
        selected={selectedMethod}
        colors={colors}
      />

      {/* History modal */}
      {hasData && (
        <BodyFatHistoryModal
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          entries={data}
          label={methodDef.label}
        />
      )}
    </View>
  );
}

/* ─── Method Picker Modal ────────────────────────────────── */

const MethodPickerModal = React.memo(function MethodPickerModal({
  visible,
  onClose,
  onSelect,
  selected,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: MethodKey) => void;
  selected: MethodKey;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="55%" modal bgColor={colors.card}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Method</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.historyCloseText}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pickerContent}>
        {METHODS.map((method) => {
          const active = method.key === selected;
          return (
            <Pressable
              key={method.key}
              style={[styles.pickerItem, active && { backgroundColor: colors.accent }]}
              onPress={() => onSelect(method.key)}
            >
              <Text style={[styles.pickerItemText, active && { color: colors.textOnAccent }]}>
                {method.label}
              </Text>
              <Text style={[styles.pickerItemSub, active && { color: colors.textOnAccent + 'AA' }]}>
                {method.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
});

/* ─── Body Fat Chart ─────────────────────────────────────── */

function computeEma(data: { value: number }[], alpha = 0.2): number[] {
  if (data.length === 0) return [];
  const ema = [data[0].value];
  for (let i = 1; i < data.length; i++) {
    ema.push(alpha * data[i].value + (1 - alpha) * ema[i - 1]);
  }
  return ema.map((v) => Math.round(v * 10) / 10);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const BodyFatChart = React.memo(function BodyFatChart({
  data,
  colors,
}: {
  data: { date: string; value: number }[];
  colors: ThemeColors;
}) {
  const chartWidth = sw(340);
  const drawWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const drawHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const emaValues = useMemo(() => computeEma(data), [data]);

  const allValues = [...data.map((d) => d.value), ...emaValues];
  const minV = Math.floor(Math.min(...allValues) - 1);
  const maxV = Math.ceil(Math.max(...allValues) + 1);
  const range = maxV - minV || 1;
  const midV = Math.round((minV + maxV) / 2 * 10) / 10;

  const yFor = (v: number) =>
    CHART_PADDING_TOP + drawHeight - ((v - minV) / range) * drawHeight;
  const xFor = (i: number) =>
    CHART_PADDING_LEFT + (data.length === 1 ? drawWidth / 2 : (i / (data.length - 1)) * drawWidth);

  const emaLinePoints = emaValues
    .map((v, i) => `${xFor(i)},${yFor(v)}`)
    .join(' ');

  return (
    <Svg width={chartWidth} height={CHART_HEIGHT}>
      <Line x1={CHART_PADDING_LEFT} y1={yFor(maxV)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yFor(maxV)} stroke={GRID_COLOR} strokeWidth={1} />
      <Line x1={CHART_PADDING_LEFT} y1={yFor(midV)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yFor(midV)} stroke={GRID_COLOR} strokeWidth={1} />
      <Line x1={CHART_PADDING_LEFT} y1={yFor(minV)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yFor(minV)} stroke={GRID_COLOR} strokeWidth={1} />

      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yFor(maxV) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">{maxV}</SvgText>
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yFor(midV) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">{midV}</SvgText>
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yFor(minV) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">{minV}</SvgText>

      {data.map((entry, i) => {
        const x = xFor(i);
        const barTop = yFor(entry.value);
        const barBottom = yFor(minV);
        const barHeight = barBottom - barTop;
        return (
          <Rect
            key={entry.date}
            x={x - BAR_WIDTH / 2}
            y={barTop}
            width={BAR_WIDTH}
            height={Math.max(barHeight, 1)}
            rx={BAR_WIDTH / 2}
            fill={colors.textTertiary}
            opacity={0.4}
          />
        );
      })}

      {emaValues.length > 1 && (
        <Polyline
          points={emaLinePoints}
          fill="none"
          stroke={EMA_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {emaValues.map((v, i) => (
        <Circle
          key={data[i].date}
          cx={xFor(i)}
          cy={yFor(v)}
          r={sw(3)}
          fill={EMA_COLOR}
        />
      ))}
    </Svg>
  );
});

/* ─── Body Fat History Modal ─────────────────────────────── */

function BodyFatHistoryModal({
  visible,
  onClose,
  entries,
  label,
}: {
  visible: boolean;
  onClose: () => void;
  entries: { date: string; value: number }[];
  label: string;
}) {
  const reversed = useMemo(() => [...entries].reverse(), [entries]);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="70%" modal bgColor={colors.card}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>{label} History</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.historyCloseText}>Done</Text>
        </TouchableOpacity>
      </View>
      {reversed.length === 0 ? (
        <View style={styles.historyEmpty}>
          <Text style={styles.historyEmptyText}>No entries yet</Text>
        </View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatShortDate(item.date)}</Text>
              <Text style={styles.historyValue}>{item.value}%</Text>
            </View>
          )}
        />
      )}
    </BottomSheet>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(20),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(12),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  logButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: sw(8),
    paddingHorizontal: sw(14),
    paddingVertical: sw(6),
  },
  logButtonText: {
    color: colors.accent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(16),
  },
  rangeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  rangeChipText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  methodDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(14),
    paddingVertical: sw(10),
    marginBottom: sw(16),
  },
  methodDropdownText: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  methodDropdownSub: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
    marginTop: sw(1),
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: sw(16),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(27),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
    marginBottom: sw(4),
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sw(20),
    marginTop: sw(8),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  legendDot: {
    width: sw(8),
    height: sw(8),
    borderRadius: sw(4),
  },
  legendText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    paddingVertical: sw(36),
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  pickerContent: {
    paddingHorizontal: sw(20),
    paddingTop: sw(16),
    paddingBottom: sw(34),
    gap: sw(8),
  },
  pickerItem: {
    alignItems: 'center',
    paddingVertical: sw(14),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
  },
  pickerItemText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(19),
    fontFamily: Fonts.semiBold,
  },
  pickerItemSub: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sw(20),
    paddingBottom: sw(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  historyTitle: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  historyCloseText: {
    color: colors.accent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  historyList: {
    paddingHorizontal: sw(20),
    paddingTop: sw(12),
    paddingBottom: sw(34),
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  historyDate: {
    color: colors.textSecondary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
  },
  historyValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  historyEmpty: {
    padding: sw(40),
    alignItems: 'center',
  },
  historyEmptyText: {
    color: colors.textTertiary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
  },
});
