import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import {
  Canvas,
  RoundedRect,
  Path,
  Line as SkiaLine,
  DashPathEffect,
  Skia,
  vec,
  LinearGradient,
} from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { useWeightStore } from '../../stores/useWeightStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import { useLabTimeRangeStore, nearestRangeOption } from '../../stores/useLabTimeRangeStore';
import WeightLogModal from '../home/WeightLogModal';
import WeightHistoryModal from '../home/WeightHistoryModal';

/* ─── Config ─────────────────────────────────────────────── */

const CHART_H = sw(140);
const Y_LABEL_W = sw(34);
const GRID_STEPS = 4;
const BAR_RADIUS = sw(3);
const EMA_COLOR = '#3B82F6';
const GOAL_COLOR = '#10B981';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Placeholder curve shown when the user has no weight entries yet.
// Normalised 0..1 (0 = top of chart, 1 = bottom). Gentle downward trend with some noise.
const PLACEHOLDER_CURVE = [0.18, 0.22, 0.30, 0.28, 0.38, 0.45, 0.42, 0.52, 0.60, 0.58, 0.66, 0.72];

const RANGES = [
  { label: '1W', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

type RangeLabel = typeof RANGES[number]['label'];

/* ─── Helpers ────────────────────────────────────────────── */

function buildSmoothPath(points: { x: number; y: number }[]): ReturnType<typeof Skia.Path.Make> | null {
  const valid = points.filter((p) => !isNaN(p.y) && isFinite(p.y));
  if (valid.length < 2) return null;
  const path = Skia.Path.Make();
  path.moveTo(valid[0].x, valid[0].y);
  if (valid.length === 2) {
    path.lineTo(valid[1].x, valid[1].y);
    return path;
  }
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

function fmtDate(d: Date) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

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

  const { current, trend, change, entries, emaPoints } = useWeightStore(
    useShallow((s) => ({ current: s.current, trend: s.trend, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const logWeight = useWeightStore((s) => s.logWeight);
  const deleteWeight = useWeightStore((s) => s.deleteWeight);

  const [selectedRange, setSelectedRange] = useState<RangeLabel>(defaultRange as RangeLabel);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Sync to global Lab time range when user taps the global bar
  const globalRangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const globalVersion = useLabTimeRangeStore((s) => s.version);
  useEffect(() => {
    const nearest = nearestRangeOption(globalRangeDays, RANGES);
    setSelectedRange(nearest.label);
  }, [globalVersion]);
  const selectedDays = RANGES.find((r) => r.label === selectedRange)!.days;
  const rangeIndex = RANGES.findIndex((r) => r.label === selectedRange);

  const chartOpacity = useSharedValue(1);
  const prevRange = useRef(selectedRange);

  useEffect(() => {
    if (userId) {
      if (prevRange.current !== selectedRange) {
        chartOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.ease) });
        prevRange.current = selectedRange;
      }
      fetchWeightData(userId, selectedDays);
    }
  }, [userId, selectedRange]);

  useEffect(() => {
    if (entries.length > 0) {
      chartOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
    }
  }, [entries]);

  const chartAnimStyle = useAnimatedStyle(() => ({ opacity: chartOpacity.value }));

  const hasData = entries.length > 0;
  const changeColor = change !== null ? (change <= 0 ? colors.accentGreen : colors.accentOrange) : colors.textSecondary;

  // Period nav
  const goShorter = useCallback(() => {
    const idx = RANGES.findIndex((r) => r.label === selectedRange);
    if (idx > 0) setSelectedRange(RANGES[idx - 1].label);
  }, [selectedRange]);
  const goLonger = useCallback(() => {
    const idx = RANGES.findIndex((r) => r.label === selectedRange);
    if (idx < RANGES.length - 1) setSelectedRange(RANGES[idx + 1].label);
  }, [selectedRange]);

  // Date range string
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - selectedDays + 1);
    return `${fmtDate(start)} – ${fmtDate(now)}`;
  }, [selectedDays]);

  // Chart layout
  const cardInnerW = SCREEN_WIDTH - sw(16) * 4;
  const slotCount = entries.length || 1;
  const projSlots = goalWeight !== null && hasData && entries.length >= 2 ? Math.max(3, Math.ceil(slotCount * 0.3)) : 0;
  const slotW = (cardInnerW - Y_LABEL_W) / (slotCount + projSlots);
  const barW = Math.min(sw(20), slotW * 0.6);

  // Y-axis
  const yScale = useMemo(() => {
    if (!hasData) return { yMin: 0, yMax: 100, yRange: 100 };
    const all = [...entries.map((e) => e.weight), ...emaPoints.map((e) => e.value)];
    if (goalWeight !== null) all.push(goalWeight);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = Math.max((max - min) * 0.15, 0.5);
    return { yMin: min - pad, yMax: max + pad, yRange: max - min + pad * 2 };
  }, [entries, emaPoints, hasData, goalWeight]);

  // Peak bar
  const peakIndex = useMemo(() => {
    let max = 0, idx = -1;
    entries.forEach((e, i) => { if (e.weight > max) { max = e.weight; idx = i; } });
    return idx;
  }, [entries]);

  // EMA path
  const emaPath = useMemo(() => {
    if (emaPoints.length < 2) return null;
    const { yMin, yRange } = yScale;
    const pts = emaPoints.map((p, i) => ({
      x: Y_LABEL_W + i * slotW + slotW / 2,
      y: CHART_H * (1 - (p.value - yMin) / yRange),
    }));
    return buildSmoothPath(pts);
  }, [emaPoints, yScale, slotW]);

  // Goal line
  const goalLineInfo = useMemo(() => {
    if (goalWeight === null || !hasData) return null;
    const goalY = CHART_H * (1 - (goalWeight - yScale.yMin) / yScale.yRange);
    if (goalY < 0 || goalY > CHART_H) return null;
    const path = Skia.Path.Make();
    path.moveTo(Y_LABEL_W, goalY);
    path.lineTo(cardInnerW, goalY);
    return { path, y: goalY };
  }, [goalWeight, yScale, cardInnerW, hasData]);

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
      const px = Math.min(lastX + h * slotW, cardInnerW);
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
  }, [hasData, emaPoints, entries, goalWeight, current, change, yScale, slotW, projSlots, cardInnerW]);

  // X-axis labels
  const labelEvery = entries.length <= 7 ? 1 : entries.length <= 14 ? 2 : Math.ceil(entries.length / 7);

  const handleLog = async (weight: number) => {
    if (!userId) return { error: 'Not logged in' };
    return logWeight(userId, weight, selectedDays);
  };

  const handleDelete = useCallback((date: string) => {
    if (!userId) return;
    deleteWeight(userId, date, selectedDays);
  }, [userId, deleteWeight, selectedDays]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <View style={styles.accentDot} />
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Weight</Text>
              {hasData && current !== null && (
                <Text style={styles.currentVal}>{current} kg</Text>
              )}
            </View>
            <View style={styles.subtitleRow}>
              <Text style={styles.dateRange}>{dateRange}</Text>
              {hasData && change !== null && (
                <View style={[styles.deltaBadge, { backgroundColor: changeColor + '18' }]}>
                  <Text style={[styles.deltaText, { color: changeColor }]}>
                    {change > 0 ? '+' : ''}{change} kg
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

      {/* Chart or empty */}
      {hasData ? (
        <Pressable onPress={() => setShowHistoryModal(true)}>
          <Animated.View style={chartAnimStyle}>
            <View style={{ height: CHART_H }}>
              {/* Y-axis labels */}
              {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                const val = yScale.yMax - (i / GRID_STEPS) * yScale.yRange;
                return (
                  <Text
                    key={i}
                    style={[styles.yLabel, {
                      position: 'absolute',
                      top: (i / GRID_STEPS) * CHART_H - ms(6),
                      left: 0,
                      width: Y_LABEL_W - sw(4),
                    }]}
                  >
                    {val.toFixed(1)}
                  </Text>
                );
              })}

              {/* Canvas */}
              <Canvas style={{ position: 'absolute', left: 0, top: 0, width: cardInnerW, height: CHART_H }}>
                {/* Grid */}
                {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                  const y = (i / GRID_STEPS) * CHART_H;
                  return (
                    <SkiaLine key={i} p1={vec(Y_LABEL_W, y)} p2={vec(cardInnerW, y)} color={colors.cardBorder} strokeWidth={0.5} />
                  );
                })}

                {/* Bars */}
                {entries.map((entry, i) => {
                  const x = Y_LABEL_W + i * slotW + (slotW - barW) / 2;
                  const barH = Math.max(BAR_RADIUS * 2, ((entry.weight - yScale.yMin) / yScale.yRange) * CHART_H);
                  const y = CHART_H - barH;
                  const isPeak = i === peakIndex;
                  return (
                    <RoundedRect key={entry.date} x={x} y={y} width={barW} height={barH} r={BAR_RADIUS}>
                      <LinearGradient
                        start={vec(0, y)}
                        end={vec(0, CHART_H)}
                        colors={isPeak ? [colors.accent, colors.accent + '90'] : [colors.accent + '60', colors.accent + '20']}
                      />
                    </RoundedRect>
                  );
                })}

                {/* EMA curve */}
                {emaPath && (
                  <Path path={emaPath} style="stroke" strokeWidth={sw(1.5)} color={colors.textPrimary} strokeCap="round" />
                )}

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
              </Canvas>

              {/* Goal label */}
              {goalLineInfo && goalWeight !== null && (
                <Text style={[styles.goalLabel, { top: goalLineInfo.y - ms(7), color: GOAL_COLOR }]}>
                  {goalWeight} kg{projection?.etaLabel ? ` · ${projection.etaLabel}` : ''}
                </Text>
              )}
            </View>

            {/* X-axis labels */}
            <View style={[styles.xAxisRow, { paddingLeft: Y_LABEL_W }]}>
              {entries.map((entry, i) => (
                <View key={entry.date} style={{ width: slotW, alignItems: 'center' }}>
                  {(i % labelEvery === 0 || i === entries.length - 1) && (
                    <Text style={styles.xLabel} numberOfLines={1}>
                      {new Date(entry.date + 'T00:00:00').getDate()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Daily</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.textPrimary }]} />
              <Text style={styles.legendText}>Trend</Text>
            </View>
            {goalLineInfo && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDash, { borderColor: GOAL_COLOR }]} />
                <Text style={styles.legendText}>Goal</Text>
              </View>
            )}
            {projection?.path && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDash, { borderColor: EMA_COLOR }]} />
                <Text style={styles.legendText}>Projected</Text>
              </View>
            )}
          </View>
        </Pressable>
      ) : (
        <Pressable onPress={() => setShowLogModal(true)} style={styles.emptyWrap}>
          <View style={{ height: CHART_H }}>
            {/* Faint Y-axis labels (no real values) */}
            {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: (i / GRID_STEPS) * CHART_H - ms(6),
                  left: 0,
                  width: Y_LABEL_W - sw(4),
                  height: ms(10),
                }}
              />
            ))}

            <Canvas
              style={{ position: 'absolute', left: 0, top: 0, width: cardInnerW, height: CHART_H }}
            >
              {/* Grid */}
              {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                const y = (i / GRID_STEPS) * CHART_H;
                return (
                  <SkiaLine
                    key={i}
                    p1={vec(Y_LABEL_W, y)}
                    p2={vec(cardInnerW, y)}
                    color={colors.cardBorder + '80'}
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* Ghosted line path */}
              {(() => {
                const chartW = cardInnerW - Y_LABEL_W;
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
                return <Path path={path} style="stroke" strokeWidth={2} color={EMA_COLOR + '55'} />;
              })()}
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
      )}

      {/* Modals */}
      <WeightLogModal visible={showLogModal} onClose={() => setShowLogModal(false)} onSave={handleLog} />
      <WeightHistoryModal visible={showHistoryModal} onClose={() => setShowHistoryModal(false)} entries={entries} onDelete={handleDelete} />
    </View>
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: sw(10),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      flex: 1,
    },
    accentDot: {
      width: sw(4),
      height: sw(16),
      borderRadius: sw(2),
      backgroundColor: colors.accent,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: sw(8),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    currentVal: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      marginTop: sw(1),
    },
    dateRange: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    deltaBadge: {
      paddingHorizontal: sw(6),
      paddingVertical: sw(2),
      borderRadius: sw(6),
    },
    deltaText: {
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    logBtn: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(8),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      paddingVertical: sw(4),
      paddingHorizontal: sw(6),
    },
    arrowBtn: {
      padding: sw(2),
    },
    arrowDisabled: {
      opacity: 0.3,
    },
    periodLabel: {
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
      minWidth: sw(24),
      textAlign: 'center',
    },
    goalLabel: {
      position: 'absolute',
      right: 0,
      fontSize: ms(9),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      backgroundColor: colors.card,
      paddingHorizontal: sw(4),
    },
    yLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
      textAlign: 'right',
    },
    xAxisRow: {
      flexDirection: 'row',
      marginTop: sw(6),
    },
    xLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(16),
      marginTop: sw(10),
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
    },
    legendLine: {
      width: sw(12),
      height: sw(1.5),
      borderRadius: sw(1),
    },
    legendDash: {
      width: sw(12),
      height: 0,
      borderTopWidth: sw(1.5),
      borderStyle: 'dashed',
    },
    legendText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
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
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      paddingVertical: sw(32),
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
  });
