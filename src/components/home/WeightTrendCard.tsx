import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
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

export default function WeightTrendCard() {
  const { current, trend, change, entries, emaPoints } = useWeightStore(
    useShallow((s) => ({ current: s.current, trend: s.trend, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const userId = useAuthStore((s) => s.user?.id);
  const goalWeight = useAuthStore((s) => s.profile?.goal_weight ?? null);
  const logWeight = useWeightStore((s) => s.logWeight);
  const deleteWeight = useWeightStore((s) => s.deleteWeight);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
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
        <Text style={styles.title}>Weight Trend</Text>
        <TouchableOpacity style={styles.logButton} onPress={() => setShowLogModal(true)}>
          <Text style={styles.logButtonText}>+ Log</Text>
        </TouchableOpacity>
      </View>

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
});
