import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Canvas, Path, Line as SkiaLine, DashPathEffect, Skia, vec } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWeightStore, type WeightEntry } from '../../stores/useWeightStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import { BODYWEIGHT_RANGE_KG } from '../../constants/muscleMap';
import { isPlausibleBodyweight } from '../../utils/muscleLoad';
import { buildSmoothPath } from '../../utils/smoothPath';
import TrendCard from './trend/TrendCard';
import TrendChart, { type TrendLegendItem } from './trend/TrendChart';
import EntryHistorySheet from './trend/EntryHistorySheet';
import NumberLogModal from './trend/NumberLogModal';
import { useTrendRange, useTrendLoad } from './trend/useTrendRange';
import { useTrendLayout } from './trend/useTrendLayout';
import { CHART_H, Y_LABEL_W, GRID_STEPS, EMA_COLOR, CARD_INNER_W, type TrendRangeLabel } from './trend/trendConfig';

/* ─── Config ─────────────────────────────────────────────── */

const GOAL_COLOR = '#10B981';

// Placeholder curve shown when the user has no weight entries yet.
// Normalised 0..1 (0 = top of chart, 1 = bottom). Gentle downward trend with some noise.
const PLACEHOLDER_CURVE = [0.18, 0.22, 0.30, 0.28, 0.38, 0.45, 0.42, 0.52, 0.60, 0.58, 0.66, 0.72];

const entryKey = (e: WeightEntry) => e.date;
const entryValueText = (e: WeightEntry) => `${e.weight} kg`;
const WEIGHT_INVALID = `Enter a weight between ${BODYWEIGHT_RANGE_KG.min} and ${BODYWEIGHT_RANGE_KG.max} kg`;

/* ─── Component ──────────────────────────────────────────── */

interface Props {
  pageIndicator?: React.ReactNode;
}

export default function WeightCard({ pageIndicator }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const goalWeight = useAuthStore((s) => s.profile?.goal_weight ?? null);
  const defaultRange = useProfileSettingsStore((s) => s.defaultWeightRange);

  const { current, change, entries, emaPoints } = useWeightStore(
    useShallow((s) => ({ current: s.current, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const logWeight = useWeightStore((s) => s.logWeight);
  const deleteWeight = useWeightStore((s) => s.deleteWeight);

  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const { selectedRange, selectedDays, rangeIndex, goShorter, goLonger, dateRange } =
    useTrendRange(defaultRange as TrendRangeLabel);

  const chartAnimStyle = useTrendLoad(
    userId,
    selectedRange,
    (uid) => fetchWeightData(uid, selectedDays),
    [userId, selectedRange],
    entries,
  );

  const hasData = entries.length > 0;
  const bars = useMemo(() => entries.map((e) => ({ date: e.date, value: e.weight })), [entries]);

  // Chart layout (extra empty slots on the right for the projection)
  const slotCount = entries.length || 1;
  const projSlots = goalWeight !== null && hasData && entries.length >= 2 ? Math.max(3, Math.ceil(slotCount * 0.3)) : 0;
  const layout = useTrendLayout(bars, emaPoints, projSlots, goalWeight);
  const { slotW, yScale } = layout;

  // Goal line
  const goalLineInfo = useMemo(() => {
    if (goalWeight === null || !hasData) return null;
    const goalY = CHART_H * (1 - (goalWeight - yScale.yMin) / yScale.yRange);
    if (goalY < 0 || goalY > CHART_H) return null;
    const path = Skia.Path.Make();
    path.moveTo(Y_LABEL_W, goalY);
    path.lineTo(CARD_INNER_W, goalY);
    return { path, y: goalY };
  }, [goalWeight, yScale, hasData]);

  // Projection curve (weighted velocity + acceleration from EMA trend)
  const projection = useMemo(() => {
    if (!hasData || emaPoints.length < 3 || projSlots === 0) return null;
    const { yMin, yRange } = yScale;
    const lastIdx = emaPoints.length - 1;
    const lastVal = emaPoints[lastIdx].value;
    const lastX = Y_LABEL_W + lastIdx * slotW + slotW / 2;
    const lastY = CHART_H * (1 - (lastVal - yMin) / yRange);

    // Weighted velocity from recent EMA deltas (recent = higher weight)
    const N = Math.min(emaPoints.length, 7);
    const recent = emaPoints.slice(-N);
    const velocities: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      velocities.push(recent[i].value - recent[i - 1].value);
    }
    let wSum = 0, wVel = 0;
    for (let i = 0; i < velocities.length; i++) {
      const w = Math.pow(0.8, velocities.length - 1 - i);
      wVel += w * velocities[i];
      wSum += w;
    }
    const avgVelocity = wSum > 0 ? wVel / wSum : 0;

    // Weighted acceleration (dampened to prevent wild projections)
    let avgAccel = 0;
    if (velocities.length >= 2) {
      const accels: number[] = [];
      for (let i = 1; i < velocities.length; i++) {
        accels.push(velocities[i] - velocities[i - 1]);
      }
      let aSum = 0, aAcc = 0;
      for (let i = 0; i < accels.length; i++) {
        const w = Math.pow(0.8, accels.length - 1 - i);
        aAcc += w * accels[i];
        aSum += w;
      }
      avgAccel = aSum > 0 ? (aAcc / aSum) * 0.5 : 0;
    }

    // Generate curved projection points: y(h) = last + v*h + ½*a*h²
    const points: { x: number; y: number }[] = [{ x: lastX, y: lastY }];
    for (let h = 1; h <= projSlots; h++) {
      const projVal = lastVal + avgVelocity * h + 0.5 * avgAccel * h * h;
      const px = Math.min(lastX + h * slotW, CARD_INNER_W);
      const py = Math.max(0, Math.min(CHART_H, CHART_H * (1 - (projVal - yMin) / yRange)));
      points.push({ x: px, y: py });
    }

    const path = buildSmoothPath(points);

    // Time-to-goal from actual raw data (not EMA — avoids smoothing lag)
    let etaLabel: string | null = null;
    if (goalWeight !== null && current !== null && entries.length >= 2) {
      const remaining = goalWeight - current;
      if (Math.abs(remaining) < 0.1) {
        etaLabel = 'Reached!';
      } else {
        const firstDate = new Date(entries[0].date);
        const lastDate = new Date(entries[entries.length - 1].date);
        const daySpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / 86400000);
        const ratePerDay = change !== null ? change / daySpan : 0;
        const movingToward = (remaining > 0 && ratePerDay > 0) || (remaining < 0 && ratePerDay < 0);

        if (movingToward && Math.abs(ratePerDay) > 0.001) {
          const daysToGoal = Math.abs(remaining / ratePerDay);
          if (daysToGoal < 7) etaLabel = `~${Math.max(1, Math.round(daysToGoal))}d`;
          else if (daysToGoal < 60) etaLabel = `~${Math.max(1, Math.round(daysToGoal / 7))}w`;
          else if (daysToGoal < 365) etaLabel = `~${Math.round(daysToGoal / 30)}mo`;
          else etaLabel = `~${(daysToGoal / 365).toFixed(1)}y`;
        } else {
          etaLabel = `${Math.abs(Math.round(remaining * 10) / 10)} kg to go`;
        }
      }
    }

    return { path, etaLabel };
  }, [hasData, emaPoints, entries, goalWeight, current, change, yScale, slotW, projSlots]);

  const legend = useMemo(() => {
    const items: TrendLegendItem[] = [{ label: 'Trend', color: colors.textPrimary }];
    if (goalLineInfo) items.push({ label: 'Goal', color: GOAL_COLOR, dashed: true });
    if (projection?.path) items.push({ label: 'Projected', color: EMA_COLOR, dashed: true });
    return items;
  }, [colors.textPrimary, goalLineInfo, projection]);

  const handleLog = async (weight: number) => {
    if (!userId) return { error: 'Not logged in' };
    return logWeight(userId, weight, selectedDays);
  };

  const handleDelete = useCallback((date: string) => {
    if (!userId) return;
    deleteWeight(userId, date, selectedDays);
  }, [userId, deleteWeight, selectedDays]);

  const openHistory = useCallback(() => setShowHistoryModal(true), []);
  const openLog = useCallback(() => setShowLogModal(true), []);

  return (
    <TrendCard
      title="Weight"
      unit=" kg"
      hasData={hasData}
      current={current}
      change={change}
      dateRange={dateRange}
      selectedRange={selectedRange}
      rangeIndex={rangeIndex}
      onShorter={goShorter}
      onLonger={goLonger}
      onLog={openLog}
      pageIndicator={pageIndicator}
    >
      {/* Chart or empty */}
      {hasData ? (
        <TrendChart
          entries={bars}
          layout={layout}
          trendColor={colors.textPrimary}
          legend={legend}
          animStyle={chartAnimStyle}
          onPress={openHistory}
          canvasOverlay={
            <>
              {/* Goal line */}
              {goalLineInfo && (
                <Path path={goalLineInfo.path} style="stroke" strokeWidth={sw(1)} color={GOAL_COLOR} strokeCap="round">
                  <DashPathEffect intervals={[sw(6), sw(4)]} />
                </Path>
              )}

              {/* Projection */}
              {projection?.path && (
                <Path path={projection.path} style="stroke" strokeWidth={sw(1.5)} color={EMA_COLOR} strokeCap="round">
                  <DashPathEffect intervals={[sw(4), sw(4)]} />
                </Path>
              )}
            </>
          }
          chartOverlay={
            goalLineInfo && goalWeight !== null && (
              <Text style={[styles.goalLabel, { top: goalLineInfo.y - ms(7), color: GOAL_COLOR }]}>
                {goalWeight} kg{projection?.etaLabel ? ` · ${projection.etaLabel}` : ''}
              </Text>
            )
          }
        />
      ) : (
        <WeightEmptyChart onPress={openLog} colors={colors} styles={styles} />
      )}

      {/* Modals */}
      <NumberLogModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleLog}
        title="Log Weight"
        placeholder="Weight (kg)"
        isValid={isPlausibleBodyweight}
        invalidMessage={WEIGHT_INVALID}
      />
      <EntryHistorySheet
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Weight History"
        emptyText="No weight entries yet"
        entries={entries}
        keyOf={entryKey}
        valueText={entryValueText}
        onDelete={handleDelete}
      />
    </TrendCard>
  );
}

/* ─── Empty state: ghosted placeholder chart ─────────────── */

const WeightEmptyChart = React.memo(function WeightEmptyChart({
  onPress, colors, styles,
}: {
  onPress: () => void; colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  const ghostPath = useMemo(() => {
    const chartW = CARD_INNER_W - Y_LABEL_W;
    const stepX = chartW / (PLACEHOLDER_CURVE.length - 1);
    const path = Skia.Path.Make();
    PLACEHOLDER_CURVE.forEach((v, i) => {
      const x = Y_LABEL_W + i * stepX;
      const y = v * CHART_H;
      if (i === 0) path.moveTo(x, y);
      else {
        const prev = PLACEHOLDER_CURVE[i - 1];
        const prevX = Y_LABEL_W + (i - 1) * stepX;
        const prevY = prev * CHART_H;
        const cpX = (prevX + x) / 2;
        path.cubicTo(cpX, prevY, cpX, y, x, y);
      }
    });
    return path;
  }, []);

  return (
    <Pressable onPress={onPress} style={styles.emptyWrap}>
      <View style={{ height: CHART_H }}>
        <Canvas style={{ position: 'absolute', left: 0, top: 0, width: CARD_INNER_W, height: CHART_H }}>
          {/* Grid */}
          {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
            const y = (i / GRID_STEPS) * CHART_H;
            return (
              <SkiaLine key={i} p1={vec(Y_LABEL_W, y)} p2={vec(CARD_INNER_W, y)} color={colors.cardBorder + '80'} strokeWidth={0.5} />
            );
          })}

          {/* Ghosted line path */}
          <Path path={ghostPath} style="stroke" strokeWidth={2} color={EMA_COLOR + '55'} />
        </Canvas>
      </View>

      <View style={styles.emptyOverlay}>
        <View style={[styles.emptyBadge, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="add-circle" size={ms(14)} color={colors.accent} />
          <Text style={[styles.emptyBadgeText, { color: colors.accent }]}>Log your first weight</Text>
        </View>
        <Text style={styles.emptyCaption}>Track trends, projections, and goal pace</Text>
      </View>
    </Pressable>
  );
});

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    goalLabel: {
      position: 'absolute',
      right: 0,
      fontSize: ms(9),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      backgroundColor: colors.card,
      paddingHorizontal: sw(4),
    },
    emptyWrap: {
      position: 'relative',
    },
    emptyOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
    },
    emptyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      paddingHorizontal: sw(12),
      paddingVertical: sw(8),
      borderRadius: sw(16),
    },
    emptyBadgeText: {
      fontSize: ms(12),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
    },
    emptyCaption: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
  });
