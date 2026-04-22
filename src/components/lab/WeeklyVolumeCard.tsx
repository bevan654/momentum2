import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Canvas,
  RoundedRect,
  Path,
  Line as SkiaLine,
  Skia,
  vec,
  LinearGradient,
  DashPathEffect,
} from '@shopify/react-native-skia';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';
import { useLabTimeRangeStore, nearestRangeOption } from '../../stores/useLabTimeRangeStore';

/* ─── Config ─────────────────────────────────────────────── */

const CHART_H = sw(140);
const Y_LABEL_W = sw(34);
const GRID_STEPS = 4;
const BAR_RADIUS = sw(3);
const PLACEHOLDER_H = sw(6);
const REF_LINE_W = sw(1);

type Period = '7D' | '1M' | '3M';
const PERIODS: Period[] = ['7D', '1M', '3M'];
const PERIOD_DAYS: { label: Period; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ─── Types ──────────────────────────────────────────────── */

interface Slot {
  label: string;
  volume: number;
  hasData: boolean;
  endTime: number;
}

/* ─── Helpers ────────────────────────────────────────────── */

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

function formatVol(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function sumVolume(workouts: WorkoutWithDetails[], from: number, to: number): number {
  let sum = 0;
  for (const w of workouts) {
    if (w.totalVolume <= 0) continue;
    const t = new Date(w.created_at).getTime();
    if (t >= from && t <= to) sum += w.totalVolume;
  }
  return sum;
}

/** Period length in days */
function periodDays(period: Period): number {
  return period === '7D' ? 7 : period === '1M' ? 30 : 90;
}

/** Rolling average: for each slot, average session volume in the trailing window */
function computeRollingAvg(
  workouts: WorkoutWithDetails[],
  slots: Slot[],
  windowDays: number,
): number[] {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return slots.map((slot) => {
    const windowStart = slot.endTime - windowMs;
    let sum = 0;
    let count = 0;
    for (const w of workouts) {
      if (w.totalVolume <= 0) continue;
      const t = new Date(w.created_at).getTime();
      if (t >= windowStart && t <= slot.endTime) {
        sum += w.totalVolume;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  });
}

/** Rolling average for the previous period — same slot positions shifted back by one period */
function computePrevRollingAvg(
  workouts: WorkoutWithDetails[],
  slots: Slot[],
  period: Period,
): number[] {
  const days = periodDays(period);
  const offsetMs = days * 24 * 60 * 60 * 1000;
  const shiftedSlots = slots.map((s) => ({ ...s, endTime: s.endTime - offsetMs }));
  return computeRollingAvg(workouts, shiftedSlots, days);
}

/** Build a smooth cubic-bezier path through non-zero points */
function buildSmoothPath(
  points: { x: number; y: number }[],
): ReturnType<typeof Skia.Path.Make> | null {
  const valid = points.filter((p) => p.y > 0);
  if (valid.length < 2) return null;

  const path = Skia.Path.Make();
  path.moveTo(valid[0].x, valid[0].y);

  if (valid.length === 2) {
    path.lineTo(valid[1].x, valid[1].y);
    return path;
  }

  // Catmull-Rom → cubic bezier
  for (let i = 1; i < valid.length; i++) {
    const p0 = valid[Math.max(0, i - 2)];
    const p1 = valid[i - 1];
    const p2 = valid[i];
    const p3 = valid[Math.min(valid.length - 1, i + 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path.cubicTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  return path;
}

/* ─── Slot builders ──────────────────────────────────────── */

function buildSlots(workouts: WorkoutWithDetails[], period: Period, offset: number): Slot[] {
  const now = new Date();
  const days = periodDays(period);
  // Shift the end date back by offset * periodDays
  const shiftDays = offset * days;

  if (period === '3M') {
    const slots: Slot[] = [];
    for (let w = 12; w >= 0; w--) {
      const bucketEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - shiftDays - w * 7));
      const bucketStart = startOfDay(new Date(bucketEnd.getFullYear(), bucketEnd.getMonth(), bucketEnd.getDate() - 6));
      const vol = sumVolume(workouts, bucketStart.getTime(), bucketEnd.getTime());
      slots.push({
        label: `${bucketStart.getDate()} ${MONTH_NAMES[bucketStart.getMonth()]}`,
        volume: vol,
        hasData: vol > 0,
        endTime: bucketEnd.getTime(),
      });
    }
    return slots;
  }

  const slots: Slot[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - shiftDays - d);
    const start = startOfDay(date);
    const end = endOfDay(date);
    const vol = sumVolume(workouts, start.getTime(), end.getTime());
    slots.push({
      label: period === '7D' ? DAY_NAMES[start.getDay()] : String(start.getDate()),
      volume: vol,
      hasData: vol > 0,
      endTime: end.getTime(),
    });
  }
  return slots;
}

/* ─── Component ──────────────────────────────────────────── */

export default function WeeklyVolumeCard() {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [period, setPeriod] = useState<Period>('7D');
  const [offset, setOffset] = useState(0);

  // Sync to global Lab time range
  const globalRangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const globalVersion = useLabTimeRangeStore((s) => s.version);
  useEffect(() => {
    const nearest = nearestRangeOption(globalRangeDays, PERIOD_DAYS);
    setPeriod(nearest.label);
    setOffset(0);
  }, [globalVersion]);

  const slots = useMemo(() => buildSlots(workouts, period, offset), [workouts, period, offset]);

  const dataVolumes = useMemo(
    () => slots.filter((s) => s.hasData).map((s) => s.volume),
    [slots],
  );

  // Current period rolling average (window matches selected period)
  const rollingAvg = useMemo(
    () => computeRollingAvg(workouts, slots, periodDays(period)),
    [workouts, slots, period],
  );

  // Previous period rolling average (same positions, shifted back one period)
  const prevRollingAvg = useMemo(
    () => computePrevRollingAvg(workouts, slots, period),
    [workouts, slots, period],
  );

  const yMax = useMemo(
    () => niceMax(Math.max(...dataVolumes, ...rollingAvg, ...prevRollingAvg, 0)),
    [dataVolumes, rollingAvg, prevRollingAvg],
  );

  // Chart layout
  const cardInnerW = SCREEN_WIDTH - sw(16) * 2 - sw(16) * 2;
  const slotW = slots.length > 0 ? (cardInnerW - Y_LABEL_W) / slots.length : 0;
  const barW = Math.min(sw(20), slotW * 0.6);

  // Current period rolling average curve
  const rollingPath = useMemo(() => {
    const points = rollingAvg.map((v, i) => ({
      x: Y_LABEL_W + i * slotW + slotW / 2,
      y: v > 0 ? CHART_H * (1 - v / yMax) : 0,
    }));
    return buildSmoothPath(points);
  }, [rollingAvg, yMax, slotW]);

  // Previous period rolling average curve
  const prevPath = useMemo(() => {
    const points = prevRollingAvg.map((v, i) => ({
      x: Y_LABEL_W + i * slotW + slotW / 2,
      y: v > 0 ? CHART_H * (1 - v / yMax) : 0,
    }));
    return buildSmoothPath(points);
  }, [prevRollingAvg, yMax, slotW]);

  const labelEvery = period === '7D' ? 1 : period === '1M' ? 5 : 2;
  const goBack = useCallback(() => setOffset((o) => o + 1), []);
  const goForward = useCallback(() => setOffset((o) => Math.max(0, o - 1)), []);
  const cyclePeriod = useCallback(() => {
    setPeriod((p) => PERIODS[(PERIODS.indexOf(p) + 1) % PERIODS.length]);
    setOffset(0);
  }, []);

  const lineColorCurrent = colors.textPrimary;
  const lineColorPrev = colors.accentOrange + '90';

  // Peak bar + delta vs previous period
  const peakIndex = useMemo(() => {
    let max = 0;
    let idx = -1;
    slots.forEach((s, i) => {
      if (s.volume > max) { max = s.volume; idx = i; }
    });
    return idx;
  }, [slots]);

  const delta = useMemo(() => {
    const currentTotal = slots.reduce((sum, s) => sum + s.volume, 0);
    const days = periodDays(period);
    const now = new Date();
    const shiftDays = offset * days;
    const prevEnd = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - shiftDays - days)).getTime() - 1;
    const prevStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - shiftDays - days * 2)).getTime();
    const prevTotal = sumVolume(workouts, prevStart, prevEnd);
    if (prevTotal <= 0) return null;
    return ((currentTotal - prevTotal) / prevTotal) * 100;
  }, [slots, workouts, period, offset]);

  // Date range label
  const dateRange = useMemo(() => {
    if (slots.length === 0) return '';
    const days = periodDays(period);
    const now = new Date();
    const shiftDays = offset * days;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - shiftDays);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1);
    const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    return `${fmt(start)} – ${fmt(end)}`;
  }, [slots, period, offset]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <View style={styles.accentDot} />
          <View>
            <Text style={styles.title}>Training Volume</Text>
            <View style={styles.subtitleRow}>
              <Text style={styles.dateRange}>{dateRange}</Text>
              {delta !== null && (
                <View style={[styles.deltaBadge, { backgroundColor: (delta >= 0 ? colors.accentGreen : colors.accentRed) + '18' }]}>
                  <Text style={[styles.deltaText, { color: delta >= 0 ? colors.accentGreen : colors.accentRed }]}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.periodSelector}>
          <Pressable onPress={goBack} style={styles.arrowBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={ms(14)} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={cyclePeriod} hitSlop={4}>
            <Text style={styles.periodLabel}>{period}</Text>
          </Pressable>
          <Pressable
            onPress={goForward}
            style={[styles.arrowBtn, offset === 0 && styles.arrowDisabled] as ViewStyle[]}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={ms(14)} color={offset === 0 ? colors.textTertiary + '40' : colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Chart */}
      <View>
        <View style={{ height: CHART_H }}>
          {/* Y-axis labels */}
          {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
            const val = yMax * (1 - i / GRID_STEPS);
            return (
              <Text
                key={i}
                style={[
                  styles.yLabel,
                  {
                    position: 'absolute',
                    top: (i / GRID_STEPS) * CHART_H - ms(6),
                    left: 0,
                    width: Y_LABEL_W - sw(4),
                  },
                ]}
              >
                {formatVol(val)}
              </Text>
            );
          })}

          {/* Skia canvas */}
          <Canvas style={{ position: 'absolute', left: 0, top: 0, width: cardInnerW, height: CHART_H }}>
            {/* Grid lines */}
            {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
              const y = (i / GRID_STEPS) * CHART_H;
              return (
                <SkiaLine
                  key={i}
                  p1={vec(Y_LABEL_W, y)}
                  p2={vec(cardInnerW, y)}
                  color={colors.cardBorder}
                  strokeWidth={0.5}
                />
              );
            })}

            {/* Bars */}
            {slots.map((s, i) => {
              const x = Y_LABEL_W + i * slotW + (slotW - barW) / 2;

              if (!s.hasData) {
                return (
                  <RoundedRect
                    key={i}
                    x={x}
                    y={CHART_H - PLACEHOLDER_H}
                    width={barW}
                    height={PLACEHOLDER_H}
                    r={BAR_RADIUS}
                    color={colors.accent + '0F'}
                  />
                );
              }

              const isPeak = i === peakIndex;
              const barH = Math.max(BAR_RADIUS * 2, (s.volume / yMax) * CHART_H);
              const y = CHART_H - barH;
              return (
                <RoundedRect key={i} x={x} y={y} width={barW} height={barH} r={BAR_RADIUS}>
                  <LinearGradient
                    start={vec(0, y)}
                    end={vec(0, CHART_H)}
                    colors={isPeak ? [colors.accent, colors.accent + '90'] : [colors.accent, colors.accent + '40']}
                  />
                </RoundedRect>
              );
            })}

            {/* Previous period — dotted yellow */}
            {prevPath && (
              <Path
                path={prevPath}
                style="stroke"
                strokeWidth={REF_LINE_W}
                color={lineColorPrev}
                strokeCap="round"
              >
                <DashPathEffect intervals={[sw(3), sw(3)]} />
              </Path>
            )}

            {/* Current period rolling average — solid white */}
            {rollingPath && (
              <Path
                path={rollingPath}
                style="stroke"
                strokeWidth={sw(1.5)}
                color={lineColorCurrent}
                strokeCap="round"
              />
            )}
          </Canvas>
        </View>

        {/* X-axis labels */}
        <View style={[styles.xAxisRow, { paddingLeft: Y_LABEL_W }]}>
          {slots.map((s, i) => (
            <View key={i} style={{ width: slotW, alignItems: 'center' }}>
              {(i % labelEvery === 0 || i === slots.length - 1) && (
                <Text style={styles.xLabel} numberOfLines={1}>
                  {s.label}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Legend + delta */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: lineColorCurrent }]} />
            <Text style={styles.legendText}>Avg</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { borderColor: lineColorPrev }]} />
            <Text style={styles.legendText}>Prev {period}</Text>
          </View>
        </View>
      </View>
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
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: sw(10),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    accentDot: {
      width: sw(4),
      height: sw(16),
      borderRadius: sw(2),
      backgroundColor: colors.accent,
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    dateRange: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    /* Period selector */
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

    /* Chart */
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

    /* Legend */
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
  });
