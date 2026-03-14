import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, FlatList } from 'react-native';
import Svg, { Rect, Circle, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWeightStore } from '../../stores/useWeightStore';
import { useAuthStore } from '../../stores/useAuthStore';
import WeightLogModal from './WeightLogModal';
import WeightHistoryModal from './WeightHistoryModal';
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
type BodyTab = 'weight' | 'measurements';

export default function WeightTrendCard() {
  const { current, trend, change, entries, emaPoints } = useWeightStore(
    useShallow((s) => ({ current: s.current, trend: s.trend, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const userId = useAuthStore((s) => s.user?.id);
  const goalWeight = useAuthStore((s) => s.profile?.goal_weight ?? null);
  const logWeight = useWeightStore((s) => s.logWeight);
  const deleteWeight = useWeightStore((s) => s.deleteWeight);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const [activeTab, setActiveTab] = useState<BodyTab>('weight');
  const [selectedRange, setSelectedRange] = useState<RangeLabel>('1W');
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedDays = RANGES.find((r) => r.label === selectedRange)!.days;
  const chartOpacity = useSharedValue(1);
  const prevRange = useRef(selectedRange);

  useEffect(() => {
    if (userId) {
      if (prevRange.current !== selectedRange) {
        chartOpacity.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
          // Data fetch triggers re-render, then fade back in
        });
        prevRange.current = selectedRange;
      }
      fetchWeightData(userId, selectedDays);
    }
  }, [userId, selectedRange]);

  useEffect(() => {
    if (entries.length > 0) {
      chartOpacity.value = withTiming(1, { duration: 250, easing: Easing.in(Easing.ease) });
    }
  }, [entries]);

  const chartAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
  }));

  const hasData = entries.length > 0;
  const changeColor = change !== null ? (change <= 0 ? colors.accentGreen : colors.accentOrange) : colors.textSecondary;

  const handleLog = async (weight: number) => {
    if (!userId) return { error: 'Not logged in' };
    return logWeight(userId, weight, selectedDays);
  };

  const handleDelete = useCallback((date: string) => {
    if (!userId) return;
    deleteWeight(userId, date, selectedDays);
  }, [userId, deleteWeight, selectedDays]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Body Tracker</Text>
        <TouchableOpacity style={styles.logButton} onPress={() => setShowLogModal(true)}>
          <Text style={styles.logButtonText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === 'weight' && { backgroundColor: colors.accent }]}
          onPress={() => setActiveTab('weight')}
        >
          <Text style={[styles.tabText, activeTab === 'weight' && { color: colors.textOnAccent }]}>
            Weight
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'measurements' && { backgroundColor: colors.accent }]}
          onPress={() => setActiveTab('measurements')}
        >
          <Text style={[styles.tabText, activeTab === 'measurements' && { color: colors.textOnAccent }]}>
            Measurements
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabContent}>
      {activeTab === 'weight' ? (
        <>
          {/* Range picker */}
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

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{hasData ? current : '--'}</Text>
              <Text style={styles.statLabel}>Current</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, hasData && { color: changeColor }]}>
                {hasData && trend !== null ? trend : '--'}
              </Text>
              <Text style={styles.statLabel}>Trend</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, hasData && { color: changeColor }]}>
                {change !== null ? `${change > 0 ? '+' : ''}${change}` : '--'}
              </Text>
              <Text style={styles.statLabel}>Change</Text>
            </View>
          </View>

          {/* Goal projection */}
          {hasData && current !== null && (
            goalWeight !== null ? (
              <GoalProjection
                current={current}
                goalWeight={goalWeight}
                change={change}
                entries={entries}
                selectedDays={selectedDays}
                colors={colors}
              />
            ) : (
              <View style={styles.goalSection}>
                <Text style={styles.goalText}>Set a goal weight in Settings</Text>
              </View>
            )
          )}

          {/* Chart or empty state */}
          {hasData ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowHistoryModal(true)}>
              <Animated.View style={chartAnimatedStyle}>
                <WeightChart entries={entries} emaPoints={emaPoints} colors={colors} />
              </Animated.View>
              {/* Legend */}
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
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Log your weight to see trends</Text>
            </View>
          )}
        </>
      ) : (
        <MeasurementsView colors={colors} />
      )}
      </View>

      {/* Modals */}
      <WeightLogModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleLog}
      />
      <WeightHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        entries={entries}
        onDelete={handleDelete}
      />
    </View>
  );
}

/* ─── Mock Data for Measurements Preview ─────────────────── */

const BODY_PARTS = [
  { key: 'chest', label: 'Chest', group: 'Core', hasSides: false },
  { key: 'waist', label: 'Waist', group: 'Core', hasSides: false },
  { key: 'hips', label: 'Hips', group: 'Core', hasSides: false },
  { key: 'neck', label: 'Neck', group: 'Core', hasSides: false },
  { key: 'shoulders', label: 'Shoulders', group: 'Core', hasSides: false },
  { key: 'bicep', label: 'Bicep', group: 'Arms', hasSides: true },
  { key: 'forearm', label: 'Forearm', group: 'Arms', hasSides: true },
  { key: 'thigh', label: 'Thigh', group: 'Legs', hasSides: true },
  { key: 'calf', label: 'Calf', group: 'Legs', hasSides: true },
] as const;

type BodyPartKey = typeof BODY_PARTS[number]['key'];
type Side = 'left' | 'right';
type PumpState = 'no_pump' | 'pumped';

function getMeasKey(part: BodyPartKey, side: Side | null): string {
  return side ? `${part}_${side}` : part;
}

// Growth metrics — increase = green
const GROWTH_KEYS = new Set<string>(['chest', 'shoulders', 'bicep', 'forearm', 'thigh', 'calf']);

type MockEntry = { date: string; value: number };
const MOCK_DATA: Record<string, Record<PumpState, MockEntry[]>> = {
  chest: {
    no_pump: [
      { date: '2026-02-10', value: 104.0 },
      { date: '2026-02-17', value: 104.2 },
      { date: '2026-02-24', value: 104.5 },
      { date: '2026-03-03', value: 105.0 },
      { date: '2026-03-09', value: 105.3 },
    ],
    pumped: [
      { date: '2026-02-10', value: 106.5 },
      { date: '2026-02-17', value: 106.8 },
      { date: '2026-02-24', value: 107.0 },
      { date: '2026-03-03', value: 107.5 },
      { date: '2026-03-09', value: 107.9 },
    ],
  },
  waist: {
    no_pump: [
      { date: '2026-02-10', value: 86.5 },
      { date: '2026-02-17', value: 86.0 },
      { date: '2026-02-24', value: 85.2 },
      { date: '2026-03-03', value: 84.8 },
      { date: '2026-03-09', value: 84.3 },
    ],
    pumped: [],
  },
  hips: {
    no_pump: [
      { date: '2026-02-10', value: 98.0 },
      { date: '2026-02-24', value: 97.5 },
      { date: '2026-03-09', value: 97.0 },
    ],
    pumped: [],
  },
  neck: {
    no_pump: [
      { date: '2026-02-10', value: 39.0 },
      { date: '2026-03-09', value: 39.2 },
    ],
    pumped: [],
  },
  shoulders: {
    no_pump: [
      { date: '2026-02-10', value: 122.0 },
      { date: '2026-02-24', value: 122.5 },
      { date: '2026-03-09', value: 123.0 },
    ],
    pumped: [
      { date: '2026-02-10', value: 124.0 },
      { date: '2026-02-24', value: 124.8 },
      { date: '2026-03-09', value: 125.2 },
    ],
  },
  bicep_left: {
    no_pump: [
      { date: '2026-02-10', value: 37.5 },
      { date: '2026-02-17', value: 37.7 },
      { date: '2026-02-24', value: 37.8 },
      { date: '2026-03-03', value: 38.0 },
      { date: '2026-03-09', value: 38.2 },
    ],
    pumped: [
      { date: '2026-02-10', value: 39.5 },
      { date: '2026-02-17', value: 39.7 },
      { date: '2026-02-24', value: 39.9 },
      { date: '2026-03-03', value: 40.1 },
      { date: '2026-03-09', value: 40.4 },
    ],
  },
  bicep_right: {
    no_pump: [
      { date: '2026-02-10', value: 38.0 },
      { date: '2026-02-17', value: 38.2 },
      { date: '2026-02-24', value: 38.3 },
      { date: '2026-03-03', value: 38.5 },
      { date: '2026-03-09', value: 38.8 },
    ],
    pumped: [
      { date: '2026-02-10', value: 40.0 },
      { date: '2026-02-17', value: 40.3 },
      { date: '2026-02-24', value: 40.5 },
      { date: '2026-03-03', value: 40.7 },
      { date: '2026-03-09', value: 41.0 },
    ],
  },
  forearm_left: {
    no_pump: [
      { date: '2026-02-10', value: 29.0 },
      { date: '2026-02-24', value: 29.2 },
      { date: '2026-03-09', value: 29.5 },
    ],
    pumped: [
      { date: '2026-02-10', value: 30.2 },
      { date: '2026-02-24', value: 30.5 },
      { date: '2026-03-09', value: 30.8 },
    ],
  },
  forearm_right: {
    no_pump: [
      { date: '2026-02-10', value: 29.5 },
      { date: '2026-02-24', value: 29.7 },
      { date: '2026-03-09', value: 30.0 },
    ],
    pumped: [
      { date: '2026-02-10', value: 30.8 },
      { date: '2026-02-24', value: 31.0 },
      { date: '2026-03-09', value: 31.3 },
    ],
  },
  thigh_left: {
    no_pump: [
      { date: '2026-02-10', value: 59.5 },
      { date: '2026-02-24', value: 60.0 },
      { date: '2026-03-09', value: 60.5 },
    ],
    pumped: [
      { date: '2026-02-10', value: 61.0 },
      { date: '2026-02-24', value: 61.5 },
      { date: '2026-03-09', value: 62.0 },
    ],
  },
  thigh_right: {
    no_pump: [
      { date: '2026-02-10', value: 60.0 },
      { date: '2026-02-24', value: 60.5 },
      { date: '2026-03-09', value: 61.0 },
    ],
    pumped: [
      { date: '2026-02-10', value: 61.5 },
      { date: '2026-02-24', value: 62.0 },
      { date: '2026-03-09', value: 62.5 },
    ],
  },
  calf_left: {
    no_pump: [
      { date: '2026-02-10', value: 38.0 },
      { date: '2026-03-09', value: 38.3 },
    ],
    pumped: [
      { date: '2026-02-10', value: 39.5 },
      { date: '2026-03-09', value: 39.8 },
    ],
  },
  calf_right: {
    no_pump: [
      { date: '2026-02-10', value: 38.5 },
      { date: '2026-03-09', value: 38.8 },
    ],
    pumped: [
      { date: '2026-02-10', value: 40.0 },
      { date: '2026-03-09', value: 40.3 },
    ],
  },
};

const GROUPS: string[] = ['Core', 'Arms', 'Legs'];

const MeasurementsView = React.memo(function MeasurementsView({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedPart, setSelectedPart] = useState<BodyPartKey>('chest');
  const [selectedSide, setSelectedSide] = useState<Side>('left');
  const [pumpState, setPumpState] = useState<PumpState>('no_pump');
  const [measRange, setMeasRange] = useState<RangeLabel>('1M');
  const [showPicker, setShowPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const partDef = BODY_PARTS.find((p) => p.key === selectedPart)!;
  const measKey = getMeasKey(selectedPart, partDef.hasSides ? selectedSide : null);
  const allDataForPump = MOCK_DATA[measKey]?.[pumpState] ?? [];
  const allData = allDataForPump.length > 0 ? allDataForPump : (MOCK_DATA[measKey]?.no_pump ?? []);

  // Filter by selected time range
  const selectedDays = RANGES.find((r) => r.label === measRange)!.days;
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

  const isGrowth = GROWTH_KEYS.has(selectedPart);
  const actualChangeColor = isGrowth
    ? (changeVal >= 0 ? colors.accentGreen : colors.accentOrange)
    : (changeVal <= 0 ? colors.accentGreen : colors.accentOrange);

  const displayLabel = partDef.hasSides
    ? `${partDef.label} (${selectedSide === 'left' ? 'L' : 'R'})`
    : partDef.label;

  const handleSelectPart = useCallback((key: BodyPartKey) => {
    setSelectedPart(key);
    setShowPicker(false);
  }, []);

  return (
    <View>
      {/* Time range picker — same position as weight tab */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = r.label === measRange;
          return (
            <Pressable
              key={r.label}
              style={[styles.rangeChip, active && { backgroundColor: colors.accent }]}
              onPress={() => setMeasRange(r.label)}
            >
              <Text style={[styles.rangeChipText, active && { color: colors.textOnAccent }]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Dropdown selector */}
      <Pressable style={styles.measDropdown} onPress={() => setShowPicker(true)}>
        <Text style={styles.measDropdownText}>{partDef.label}</Text>
        <Ionicons name="chevron-down" size={ms(16)} color={colors.textSecondary} />
      </Pressable>

      {/* L/R side toggle — only for limbs */}
      {partDef.hasSides && (
        <View style={styles.measSideRow}>
          <Pressable
            style={[styles.measSideChip, selectedSide === 'left' && { backgroundColor: colors.accent }]}
            onPress={() => setSelectedSide('left')}
          >
            <Text style={[styles.measSideText, selectedSide === 'left' && { color: colors.textOnAccent }]}>
              Left
            </Text>
          </Pressable>
          <Pressable
            style={[styles.measSideChip, selectedSide === 'right' && { backgroundColor: colors.accent }]}
            onPress={() => setSelectedSide('right')}
          >
            <Text style={[styles.measSideText, selectedSide === 'right' && { color: colors.textOnAccent }]}>
              Right
            </Text>
          </Pressable>
        </View>
      )}

      {/* Pump toggle */}
      <View style={styles.measPumpRow}>
        <Pressable
          style={[styles.measPumpChip, pumpState === 'no_pump' && { backgroundColor: colors.accent }]}
          onPress={() => setPumpState('no_pump')}
        >
          <Text style={[styles.measPumpText, pumpState === 'no_pump' && { color: colors.textOnAccent }]}>
            No Pump
          </Text>
        </Pressable>
        <Pressable
          style={[styles.measPumpChip, pumpState === 'pumped' && { backgroundColor: colors.accent }]}
          onPress={() => setPumpState('pumped')}
        >
          <Text style={[styles.measPumpText, pumpState === 'pumped' && { color: colors.textOnAccent }]}>
            Pumped
          </Text>
        </Pressable>
      </View>

      {hasData ? (
        <>
          {/* Stats row — matches weight tab layout */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{latest!.value}</Text>
              <Text style={styles.statLabel}>Current (cm)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: actualChangeColor }]}>
                {changeStr}
              </Text>
              <Text style={styles.statLabel}>Change (cm)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{data.length}</Text>
              <Text style={styles.statLabel}>Entries</Text>
            </View>
          </View>

          {/* Chart — tappable for history */}
          <TouchableOpacity activeOpacity={0.7} onPress={() => setShowHistory(true)}>
            <MeasurementChart data={data} colors={colors} />
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
          <Text style={styles.emptyText}>No {pumpState === 'pumped' ? 'pumped ' : ''}data for {displayLabel}</Text>
        </View>
      )}

      {/* Picker modal */}
      <BodyPartPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelectPart}
        selected={selectedPart}
        colors={colors}
      />

      {/* History modal */}
      {hasData && (
        <MeasurementHistoryModal
          visible={showHistory}
          onClose={() => setShowHistory(false)}
          entries={data}
          label={`${displayLabel}${pumpState === 'pumped' ? ' (Pumped)' : ''}`}
        />
      )}
    </View>
  );
});

/* ─── Body Part Picker Modal ─────────────────────────────── */

const BodyPartPickerModal = React.memo(function BodyPartPickerModal({
  visible,
  onClose,
  onSelect,
  selected,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: BodyPartKey) => void;
  selected: BodyPartKey;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="55%"
      modal
      bgColor={colors.card}
    >
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Body Part</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.historyCloseText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pickerContent}>
        {GROUPS.map((group) => (
          <View key={group as string}>
            <Text style={styles.pickerGroupLabel}>{group}</Text>
            <View style={styles.pickerGroupGrid}>
              {BODY_PARTS.filter((p) => p.group === group).map((part) => {
                const active = part.key === selected;
                return (
                  <Pressable
                    key={part.key}
                    style={[styles.pickerItem, active && { backgroundColor: colors.accent }]}
                    onPress={() => onSelect(part.key)}
                  >
                    <Text style={[styles.pickerItemText, active && { color: colors.textOnAccent }]}>
                      {part.label}
                    </Text>
                    {part.hasSides && (
                      <Text style={[styles.pickerItemSub, active && { color: colors.textOnAccent + 'AA' }]}>
                        L / R
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
});

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function computeEma(data: { value: number }[], alpha = 0.2): number[] {
  if (data.length === 0) return [];
  const ema = [data[0].value];
  for (let i = 1; i < data.length; i++) {
    ema.push(alpha * data[i].value + (1 - alpha) * ema[i - 1]);
  }
  return ema.map((v) => Math.round(v * 10) / 10);
}

const MeasurementChart = React.memo(function MeasurementChart({
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
      {/* Grid lines */}
      <Line x1={CHART_PADDING_LEFT} y1={yFor(maxV)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yFor(maxV)} stroke={GRID_COLOR} strokeWidth={1} />
      <Line x1={CHART_PADDING_LEFT} y1={yFor(midV)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yFor(midV)} stroke={GRID_COLOR} strokeWidth={1} />
      <Line x1={CHART_PADDING_LEFT} y1={yFor(minV)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yFor(minV)} stroke={GRID_COLOR} strokeWidth={1} />

      {/* Y-axis labels */}
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yFor(maxV) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">{maxV}</SvgText>
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yFor(midV) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">{midV}</SvgText>
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yFor(minV) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">{minV}</SvgText>

      {/* Bars */}
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

      {/* EMA line */}
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

      {/* EMA dots */}
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

/* ─── Measurement History Modal ──────────────────────────── */

function MeasurementHistoryModal({
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="70%"
      modal
      bgColor={colors.card}
    >
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
              <Text style={styles.historyValue}>{item.value} cm</Text>
            </View>
          )}
        />
      )}
    </BottomSheet>
  );
}

const GoalProjection = React.memo(function GoalProjection({
  current,
  goalWeight,
  change,
  entries,
  selectedDays,
  colors,
}: {
  current: number;
  goalWeight: number;
  change: number | null;
  entries: { date: string; weight: number }[];
  selectedDays: number;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const remaining = goalWeight - current;
  const needsToLose = remaining < 0;
  const needsToGain = remaining > 0;

  // Goal already reached (within 0.1 kg tolerance)
  if (Math.abs(remaining) < 0.1) {
    return (
      <View style={styles.goalSection}>
        <Text style={styles.goalLabel}>Goal: {goalWeight} kg</Text>
        <Text style={[styles.goalText, { color: colors.accentGreen }]}>
          Goal reached!
        </Text>
        <Text style={[styles.goalDisclaimer, { opacity: 0 }]}>Based on limited data</Text>
      </View>
    );
  }

  // Use actual tracking span instead of selected range
  const firstDate = new Date(entries[0].date);
  const lastDate = new Date(entries[entries.length - 1].date);
  const actualDays = Math.max(Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)), 1);
  const limitedData = actualDays < selectedDays * 0.75;
  const actualWeeks = Math.max(Math.round(actualDays / 7), 1);
  const limitedLabel = `Only ${actualWeeks} week${actualWeeks !== 1 ? 's' : ''} of data available`;

  const weightPerDay = change !== null ? change / actualDays : 0;

  // Not enough data to project
  if (Math.abs(weightPerDay) < 0.001) {
    return (
      <View style={styles.goalSection}>
        <Text style={styles.goalLabel}>Goal: {goalWeight} kg</Text>
        <Text style={styles.goalText}>{Math.abs(Math.round(remaining * 10) / 10)} kg to {needsToLose ? 'lose' : 'gain'}</Text>
        <Text style={[styles.goalDisclaimer, { opacity: 0 }]}>Based on limited data</Text>
      </View>
    );
  }

  const isLosingWeight = weightPerDay < 0;
  const isGainingWeight = weightPerDay > 0;
  const movingTowardGoal = (needsToLose && isLosingWeight) || (needsToGain && isGainingWeight);

  if (!movingTowardGoal) {
    const directionWord = isGainingWeight ? 'Gaining' : 'Losing';
    const goalWord = needsToLose ? 'lose' : 'gain';
    return (
      <View style={styles.goalSection}>
        <Text style={styles.goalLabel}>Goal: {goalWeight} kg</Text>
        <Text style={[styles.goalText, { color: colors.accentOrange }]}>
          {directionWord}: Need to {goalWord} {Math.abs(Math.round(remaining * 10) / 10)} kg
        </Text>
        <Text style={[styles.goalDisclaimer, !limitedData && { opacity: 0 }]}>{limitedLabel}</Text>
      </View>
    );
  }

  // Moving toward goal — estimate time
  const daysToGoal = Math.abs(remaining / weightPerDay);
  let timeString: string;
  if (daysToGoal < 60) {
    const weeks = Math.round(daysToGoal / 7);
    timeString = `~${Math.max(weeks, 1)} week${weeks !== 1 ? 's' : ''}`;
  } else {
    const months = Math.round(daysToGoal / 30);
    timeString = `~${months} month${months !== 1 ? 's' : ''}`;
  }

  const remainingKg = Math.abs(Math.round(remaining * 10) / 10);

  return (
    <View style={styles.goalSection}>
      <Text style={styles.goalLabel}>Goal: {goalWeight} kg</Text>
      <Text style={[styles.goalText, { color: colors.accent }]}>
        {timeString} to goal ({remainingKg} kg to {needsToLose ? 'lose' : 'gain'})
      </Text>
      <Text style={[styles.goalDisclaimer, !limitedData && { opacity: 0 }]}>{limitedLabel}</Text>
    </View>
  );
});

const WeightChart = React.memo(function WeightChart({
  entries,
  emaPoints,
  colors,
}: {
  entries: { date: string; weight: number }[];
  emaPoints: { date: string; value: number }[];
  colors: ThemeColors;
}) {
  const chartWidth = sw(340);
  const drawWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const drawHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const allWeights = [...entries.map((e) => e.weight), ...emaPoints.map((e) => e.value)];
  const minW = Math.floor(Math.min(...allWeights) - 1);
  const maxW = Math.ceil(Math.max(...allWeights) + 1);
  const range = maxW - minW || 1;

  const midW = Math.round((minW + maxW) / 2 * 10) / 10;

  const yForWeight = (w: number) =>
    CHART_PADDING_TOP + drawHeight - ((w - minW) / range) * drawHeight;

  const xForIndex = (i: number) =>
    CHART_PADDING_LEFT + (entries.length === 1 ? drawWidth / 2 : (i / (entries.length - 1)) * drawWidth);

  // EMA polyline points
  const emaLinePoints = emaPoints
    .map((_, i) => `${xForIndex(i)},${yForWeight(emaPoints[i].value)}`)
    .join(' ');

  return (
    <Svg width={chartWidth} height={CHART_HEIGHT}>
      {/* Grid lines */}
      <Line x1={CHART_PADDING_LEFT} y1={yForWeight(maxW)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yForWeight(maxW)} stroke={GRID_COLOR} strokeWidth={1} />
      <Line x1={CHART_PADDING_LEFT} y1={yForWeight(midW)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yForWeight(midW)} stroke={GRID_COLOR} strokeWidth={1} />
      <Line x1={CHART_PADDING_LEFT} y1={yForWeight(minW)} x2={chartWidth - CHART_PADDING_RIGHT} y2={yForWeight(minW)} stroke={GRID_COLOR} strokeWidth={1} />

      {/* Y-axis labels */}
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yForWeight(maxW) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">
        {maxW}
      </SvgText>
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yForWeight(midW) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">
        {midW}
      </SvgText>
      <SvgText x={CHART_PADDING_LEFT - sw(6)} y={yForWeight(minW) + 4} fill={colors.textTertiary} fontSize={ms(10)} textAnchor="end">
        {minW}
      </SvgText>

      {/* Bars */}
      {entries.map((entry, i) => {
        const x = xForIndex(i);
        const barTop = yForWeight(entry.weight);
        const barBottom = yForWeight(minW);
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

      {/* EMA line */}
      {emaPoints.length > 1 && (
        <Polyline
          points={emaLinePoints}
          fill="none"
          stroke={EMA_COLOR}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* EMA dots */}
      {emaPoints.map((point, i) => (
        <Circle
          key={point.date}
          cx={xForIndex(i)}
          cy={yForWeight(point.value)}
          r={sw(3)}
          fill={EMA_COLOR}
        />
      ))}
    </Svg>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(20),
    marginTop: sw(10),
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
  goalSection: {
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingHorizontal: sw(14),
    paddingVertical: sw(10),
    marginBottom: sw(16),
    alignItems: 'center',
  },
  goalLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginBottom: sw(2),
    textAlign: 'center',
  },
  goalText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  goalDisclaimer: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: sw(4),
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
  // Tab toggle
  tabRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(14),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(7),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  tabContent: {
    minHeight: CHART_HEIGHT + sw(100),
  },
  // Measurement dropdown selector
  measDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(14),
    paddingVertical: sw(10),
    marginBottom: sw(10),
  },
  measDropdownText: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  // L/R side toggle
  measSideRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(10),
  },
  measSideChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  measSideText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  // Pump toggle
  measPumpRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(16),
  },
  measPumpChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  measPumpText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  // Picker modal
  pickerContent: {
    paddingHorizontal: sw(20),
    paddingTop: sw(16),
    paddingBottom: sw(34),
  },
  pickerGroupLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sw(8),
    marginTop: sw(4),
  },
  pickerGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    marginBottom: sw(16),
  },
  pickerItem: {
    flexBasis: '29%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
  } as any,
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
  // Measurement history modal
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
