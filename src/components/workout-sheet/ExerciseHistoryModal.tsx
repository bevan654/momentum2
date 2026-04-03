import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Canvas, Path as SkiaPath, Skia, vec, LinearGradient, Line as SkiaLine } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';

/* ─── Constants ─────────────────────────────────────────── */

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;
const BACKDROP_MAX = 0.6;

const CHART_H = sw(140);
const Y_LABEL_W = sw(34);
const GRID_STEPS = 4;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ─── Types ─────────────────────────────────────────────── */

interface HistoryEntry {
  workoutId: string;
  date: string;
  sets: { kg: number; reps: number; completed: boolean; set_type: string | null }[];
  maxWeight: number;
  totalVolume: number;
  totalReps: number;
}

interface PRData {
  heaviestKg: number;
  heaviestReps: number;
  mostReps: number;
  mostRepsKg: number;
  bestVolume: number;
}

interface Props {
  exerciseName: string | null;
  visible: boolean;
  onClose: () => void;
}

/* ─── Helpers ───────────────────────────────────────────── */

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

function fmtDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} week${Math.floor(diff / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diff / 30)} month${Math.floor(diff / 30) > 1 ? 's' : ''} ago`;
}

function titleCase(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component ─────────────────────────────────────────── */

function ExerciseHistoryModal({ exerciseName, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);

  const [alive, setAlive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chartMode, setChartMode] = useState<'weight' | 'volume'>('weight');
  const openRef = useRef(false);
  const closingRef = useRef(false);

  /* ─── Animation ──────────────────────────────────────── */

  const translateX = useSharedValue(SCREEN_W);
  const ctx = useSharedValue(0);

  const cleanup = useCallback(() => {
    setAlive(false);
    setHistory([]);
    setLoading(true);
    setChartMode('weight');
  }, []);

  const handleDismiss = useCallback(() => {
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setAlive(true);
      openRef.current = true;
      closingRef.current = false;
      cancelAnimation(translateX);
      translateX.value = 0;
    } else if (openRef.current) {
      openRef.current = false;
      cancelAnimation(translateX);
      translateX.value = SCREEN_W;
      cleanup();
      closingRef.current = false;
    }
  }, [visible]);

  useEffect(() => () => cancelAnimation(translateX), []);

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = 1 - translateX.value / SCREEN_W;
    return { opacity: Math.max(0, progress * BACKDROP_MAX) };
  });

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: Math.max(0, translateX.value) }] };
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(10)
        .failOffsetY([-15, 15])
        .onStart(() => { ctx.value = translateX.value; })
        .onUpdate((e) => { translateX.value = Math.max(0, ctx.value + e.translationX); })
        .onEnd((e) => {
          if (e.translationX > DISMISS_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD) {
            translateX.value = SCREEN_W;
            runOnJS(handleDismiss)();
          } else {
            translateX.value = 0;
          }
        }),
    [handleDismiss],
  );

  /* ─── Data fetching ──────────────────────────────────── */

  useEffect(() => {
    if (!visible || !exerciseName || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id, workout_id, exercise_type, sets(set_number, kg, reps, completed, set_type), workouts!inner(id, created_at, user_id)')
          .eq('name', exerciseName)
          .eq('workouts.user_id', userId)
          .order('created_at', { referencedTable: 'workouts', ascending: false })
          .limit(100);

        if (cancelled) return;
        if (error) {
          console.error('[ExerciseHistory] query error:', error);
          setLoading(false);
          return;
        }

        const entries: HistoryEntry[] = (data || []).map((ex: any) => {
          const workout = ex.workouts;
          const sets = (ex.sets || [])
            .sort((a: any, b: any) => a.set_number - b.set_number)
            .map((s: any) => ({
              kg: Number(s.kg) || 0,
              reps: Number(s.reps) || 0,
              completed: !!s.completed,
              set_type: s.set_type || null,
            }));

          const completedSets = sets.filter((s: any) => s.completed);
          const maxWeight = completedSets.reduce((max: number, s: any) => Math.max(max, s.kg), 0);
          const totalVolume = completedSets.reduce((sum: number, s: any) => sum + s.kg * s.reps, 0);
          const totalReps = completedSets.reduce((sum: number, s: any) => sum + s.reps, 0);

          return {
            workoutId: workout?.id || ex.workout_id,
            date: workout?.created_at || '',
            sets,
            maxWeight,
            totalVolume,
            totalReps,
          };
        });

        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(entries);

        // Default to volume chart for bodyweight exercises
        const catEntry = catalogMap[exerciseName];
        if (catEntry?.exercise_type === 'bodyweight') {
          setChartMode('volume');
        }
      } catch (err) {
        console.error('[ExerciseHistory] fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, exerciseName, userId]);

  /* ─── Derived data ───────────────────────────────────── */

  const prs = useMemo<PRData>(() => {
    let heaviestKg = 0, heaviestReps = 0;
    let mostReps = 0, mostRepsKg = 0;
    let bestVolume = 0;

    for (const entry of history) {
      if (entry.totalVolume > bestVolume) bestVolume = entry.totalVolume;
      for (const s of entry.sets) {
        if (!s.completed) continue;
        if (s.kg > heaviestKg || (s.kg === heaviestKg && s.reps > heaviestReps)) {
          heaviestKg = s.kg;
          heaviestReps = s.reps;
        }
        if (s.reps > mostReps || (s.reps === mostReps && s.kg > mostRepsKg)) {
          mostReps = s.reps;
          mostRepsKg = s.kg;
        }
      }
    }

    return { heaviestKg, heaviestReps, mostReps, mostRepsKg, bestVolume };
  }, [history]);

  const avgWeight = useMemo(() => {
    let total = 0, count = 0;
    for (const entry of history) {
      for (const s of entry.sets) {
        if (s.completed && s.kg > 0) { total += s.kg; count++; }
      }
    }
    return count > 0 ? Math.round(total / count * 10) / 10 : 0;
  }, [history]);

  const lastEntry = history[0] || null;

  const suggestedNext = useMemo(() => {
    if (!lastEntry) return null;
    const completed = lastEntry.sets.filter((s) => s.completed);
    if (completed.length === 0) return null;
    const maxKg = Math.max(...completed.map((s) => s.kg));
    const maxReps = Math.max(...completed.filter((s) => s.kg === maxKg).map((s) => s.reps));
    return { kg: maxKg, reps: maxReps + 1 };
  }, [lastEntry]);

  const exerciseType = exerciseName ? catalogMap[exerciseName]?.exercise_type : null;
  const isBodyweight = exerciseType === 'bodyweight';

  /* ─── Chart data ─────────────────────────────────────── */

  const chartWidth = SCREEN_WIDTH - sw(32) - Y_LABEL_W;

  const { chartPoints, yScale } = useMemo(() => {
    if (history.length < 2) return { chartPoints: [], yScale: { yMin: 0, yMax: 100, yRange: 100 } };

    const sorted = [...history].reverse(); // oldest first
    const points = sorted.map((entry) => ({
      value: chartMode === 'weight' ? entry.maxWeight : entry.totalVolume,
      date: new Date(entry.date),
    }));

    const values = points.map((p) => p.value).filter((v) => v > 0);
    if (values.length < 2) return { chartPoints: [], yScale: { yMin: 0, yMax: 100, yRange: 100 } };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.15, chartMode === 'weight' ? 2.5 : 50);
    const yMin = min - pad;
    const yMax = max + pad;
    const yRange = yMax - yMin;

    const slotW = chartWidth / (points.length - 1 || 1);
    const chartPts = points.map((p, i) => ({
      x: Y_LABEL_W + i * slotW,
      y: CHART_H * (1 - (p.value - yMin) / yRange),
      value: p.value,
      date: p.date,
    }));

    return { chartPoints: chartPts, yScale: { yMin, yMax, yRange } };
  }, [history, chartMode, chartWidth]);

  const linePath = useMemo(() => buildSmoothPath(chartPoints), [chartPoints]);

  const fillPath = useMemo(() => {
    if (!linePath || chartPoints.length < 2) return null;
    const fill = linePath.copy();
    fill.lineTo(chartPoints[chartPoints.length - 1].x, CHART_H);
    fill.lineTo(chartPoints[0].x, CHART_H);
    fill.close();
    return fill;
  }, [linePath, chartPoints]);

  /* ─── Render guard ───────────────────────────────────── */

  if (!alive) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, { paddingTop: insets.top }]}>
          {/* Header with pan gesture */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.header}>
              <TouchableOpacity onPress={handleDismiss} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {exerciseName ? titleCase(exerciseName) : ''}
              </Text>
              <View style={{ width: sw(32) }} />
            </Animated.View>
          </GestureDetector>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={ms(40)} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No History</Text>
              <Text style={styles.emptySub}>Complete a workout with this exercise to see your history here</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + sw(20) }]}
              showsVerticalScrollIndicator={false}
            >
              {/* ─── Summary ─── */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SUMMARY</Text>
                {/* Stats grid */}
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{history.length}</Text>
                    <Text style={styles.summaryCellLabel}>Sessions</Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{avgWeight > 0 ? `${avgWeight}` : '—'}</Text>
                    <Text style={styles.summaryCellLabel}>Avg kg</Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{daysAgo(lastEntry!.date)}</Text>
                    <Text style={styles.summaryCellLabel}>Last Done</Text>
                  </View>
                </View>
                {/* Suggested next */}
                {suggestedNext && suggestedNext.kg > 0 && (
                  <View style={styles.suggestedCard}>
                    <Ionicons name="trending-up" size={ms(14)} color={colors.accentGreen} />
                    <Text style={styles.suggestedLabel}>Next target</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.suggestedValue}>
                      {suggestedNext.kg}kg × {suggestedNext.reps}
                    </Text>
                  </View>
                )}
              </View>

              {/* ─── Personal Records ─── */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PERSONAL RECORDS</Text>
                <View style={styles.prRow}>
                  <View style={styles.prCard}>
                    <Ionicons name="trophy" size={ms(16)} color={colors.accentOrange} />
                    <Text style={styles.prValue}>{prs.heaviestKg > 0 ? `${prs.heaviestKg}kg` : '—'}</Text>
                    <Text style={styles.prSub}>{prs.heaviestKg > 0 ? `${prs.heaviestReps} reps` : ''}</Text>
                    <Text style={styles.prLabel}>Heaviest</Text>
                  </View>
                  <View style={styles.prCard}>
                    <Ionicons name="repeat" size={ms(16)} color={colors.accentBlue} />
                    <Text style={styles.prValue}>{prs.mostReps > 0 ? `${prs.mostReps}` : '—'}</Text>
                    <Text style={styles.prSub}>{prs.mostReps > 0 ? `${prs.mostRepsKg}kg` : ''}</Text>
                    <Text style={styles.prLabel}>Most Reps</Text>
                  </View>
                  <View style={styles.prCard}>
                    <Ionicons name="flame" size={ms(16)} color={colors.accentRed} />
                    <Text style={styles.prValue}>{prs.bestVolume > 0 ? `${prs.bestVolume}` : '—'}</Text>
                    <Text style={styles.prSub}>{prs.bestVolume > 0 ? 'kg' : ''}</Text>
                    <Text style={styles.prLabel}>Best Volume</Text>
                  </View>
                </View>
              </View>

              {/* ─── Progress Chart ─── */}
              {chartPoints.length >= 2 && (
                <View style={styles.section}>
                  <View style={styles.chartHeaderRow}>
                    <Text style={styles.sectionLabel}>PROGRESS</Text>
                    {!isBodyweight && (
                      <View style={styles.chartToggle}>
                        <TouchableOpacity
                          style={[styles.chartChip, chartMode === 'weight' && styles.chartChipActive]}
                          onPress={() => setChartMode('weight')}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chartChipText, chartMode === 'weight' && styles.chartChipTextActive]}>Weight</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.chartChip, chartMode === 'volume' && styles.chartChipActive]}
                          onPress={() => setChartMode('volume')}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chartChipText, chartMode === 'volume' && styles.chartChipTextActive]}>Volume</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <View style={styles.card}>
                    <Canvas style={{ width: SCREEN_WIDTH - sw(64), height: CHART_H }}>
                      {/* Grid lines */}
                      {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                        const y = (CHART_H / GRID_STEPS) * i;
                        return (
                          <SkiaLine
                            key={`grid-${i}`}
                            p1={vec(Y_LABEL_W, y)}
                            p2={vec(SCREEN_WIDTH - sw(64), y)}
                            color={colors.cardBorder}
                            strokeWidth={0.5}
                          />
                        );
                      })}
                      {/* Fill gradient */}
                      {fillPath && (
                        <SkiaPath path={fillPath} style="fill">
                          <LinearGradient
                            start={vec(0, 0)}
                            end={vec(0, CHART_H)}
                            colors={[colors.accent + '30', colors.accent + '00']}
                          />
                        </SkiaPath>
                      )}
                      {/* Line */}
                      {linePath && (
                        <SkiaPath path={linePath} style="stroke" strokeWidth={sw(2)} color={colors.accent} />
                      )}
                      {/* Data dots */}
                      {chartPoints.map((pt, i) => {
                        const dotPath = Skia.Path.Make();
                        dotPath.addCircle(pt.x, pt.y, sw(3));
                        return (
                          <SkiaPath key={`dot-${i}`} path={dotPath} color={colors.accent} style="fill" />
                        );
                      })}
                    </Canvas>
                    {/* Y-axis labels */}
                    <View style={styles.yLabels}>
                      {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
                        const val = yScale.yMax - (yScale.yRange / GRID_STEPS) * i;
                        const label = chartMode === 'weight'
                          ? `${Math.round(val)}`
                          : val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`;
                        return (
                          <Text key={`ylabel-${i}`} style={styles.yLabel}>{label}</Text>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}

              {/* ─── History Table ─── */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>HISTORY</Text>
                {history.map((entry, idx) => (
                  <View key={entry.workoutId + idx} style={styles.historyCard}>
                    {/* Date row */}
                    <View style={styles.historyDateRow}>
                      <Text style={styles.historyDate}>{fmtDate(new Date(entry.date))}</Text>
                      <Text style={styles.historyAgo}>{daysAgo(entry.date)}</Text>
                    </View>

                    {/* Table header */}
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.tableColSet]}>SET</Text>
                      <Text style={[styles.tableHeaderCell, styles.tableColKg]}>KG</Text>
                      <Text style={[styles.tableHeaderCell, styles.tableColReps]}>REPS</Text>
                      <View style={styles.tableColType} />
                    </View>

                    {/* Table rows */}
                    {entry.sets.map((s, si) => (
                      <View
                        key={si}
                        style={[
                          styles.tableRow,
                          si % 2 === 0 && styles.tableRowAlt,
                          !s.completed && styles.tableRowSkipped,
                        ]}
                      >
                        <Text style={[styles.tableCell, styles.tableCellSet, styles.tableColSet]}>{si + 1}</Text>
                        <Text style={[styles.tableCell, styles.tableColKg, !s.completed && styles.tableCellDim]}>
                          {s.kg > 0 ? `${s.kg}` : '—'}
                        </Text>
                        <Text style={[styles.tableCell, styles.tableColReps, !s.completed && styles.tableCellDim]}>
                          {s.reps}
                        </Text>
                        <View style={styles.tableColType}>
                          {s.set_type && s.set_type !== 'working' ? (
                            <View style={styles.setTypeBadge}>
                              <Text style={styles.setTypeBadgeText}>
                                {s.set_type === 'warmup' ? 'W' : s.set_type === 'drop' ? 'D' : s.set_type === 'failure' ? 'F' : s.set_type.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          ) : !s.completed ? (
                            <Text style={styles.tableSkipLabel}>skip</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}

                    {/* Summary footer */}
                    <View style={styles.tableFooter}>
                      <Text style={styles.tableFooterText}>
                        {entry.totalVolume > 0 ? `${entry.totalVolume.toLocaleString()}kg vol` : '—'}
                      </Text>
                      <Text style={styles.tableFooterDot}> · </Text>
                      <Text style={styles.tableFooterText}>{entry.totalReps} reps</Text>
                      {entry.maxWeight > 0 && (
                        <>
                          <Text style={styles.tableFooterDot}> · </Text>
                          <Text style={styles.tableFooterText}>top {entry.maxWeight}kg</Text>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default React.memo(ExerciseHistoryModal);

/* ─── Styles ────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(12),
    paddingVertical: sw(12),
    gap: sw(4),
  },
  backBtn: {
    width: sw(32),
    height: sw(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(8),
    paddingHorizontal: sw(32),
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: ms(16),
    fontFamily: Fonts.semiBold,
  },
  emptySub: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    gap: sw(16),
  },

  /* Section */
  section: {
    gap: sw(8),
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    padding: sw(14),
    gap: sw(10),
  },

  /* Summary */
  summaryGrid: {
    flexDirection: 'row',
    gap: sw(8),
  },
  summaryCell: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: sw(12),
    paddingHorizontal: sw(10),
    alignItems: 'center',
    gap: sw(4),
  },
  summaryCellValue: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
  },
  summaryCellLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    letterSpacing: 0.3,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGreen + '10',
    paddingVertical: sw(10),
    paddingHorizontal: sw(12),
    gap: sw(8),
  },
  suggestedLabel: {
    color: colors.accentGreen,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
  },
  suggestedValue: {
    color: colors.accentGreen,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },

  /* PRs */
  prRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  prCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: sw(12),
    alignItems: 'center',
    gap: sw(4),
  },
  prValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
  },
  prSub: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  prLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },

  /* Chart */
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartToggle: {
    flexDirection: 'row',
    gap: sw(4),
  },
  chartChip: {
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    backgroundColor: colors.surface,
  },
  chartChipActive: {
    backgroundColor: colors.accent,
  },
  chartChipText: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
  },
  chartChipTextActive: {
    color: colors.textOnAccent,
  },
  yLabels: {
    position: 'absolute',
    top: sw(14),
    left: sw(14),
    height: CHART_H,
    width: Y_LABEL_W,
    justifyContent: 'space-between',
  },
  yLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    textAlign: 'right',
  },

  /* History table */
  historyCard: {
    backgroundColor: colors.surface,
    padding: sw(12),
    gap: sw(0),
    overflow: 'hidden',
  },
  historyDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(8),
  },
  historyDate: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  historyAgo: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  tableHeaderCell: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  tableColSet: {
    width: sw(32),
    textAlign: 'center',
  },
  tableColKg: {
    flex: 1,
    textAlign: 'center',
  },
  tableColReps: {
    flex: 1,
    textAlign: 'center',
  },
  tableColType: {
    width: sw(30),
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(7),
  },
  tableRowAlt: {
    backgroundColor: colors.cardBorder + '20',
  },
  tableRowSkipped: {
    opacity: 0.5,
  },
  tableCell: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  tableCellSet: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
  },
  tableCellDim: {
    color: colors.textTertiary,
  },
  tableSkipLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  setTypeBadge: {
    paddingHorizontal: sw(5),
    paddingVertical: sw(1),
    backgroundColor: colors.cardBorder,
    borderRadius: sw(3),
  },
  setTypeBadgeText: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
  },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: sw(8),
    marginTop: sw(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  tableFooterText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  tableFooterDot: {
    color: colors.textTertiary + '60',
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
});
