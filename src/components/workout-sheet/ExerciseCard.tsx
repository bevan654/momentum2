import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useWorkoutStore, type WorkoutWithDetails } from '../../stores/useWorkoutStore';
import { useThemeStore } from '../../stores/useThemeStore';
import type { ActiveExercise } from '../../stores/useActiveWorkoutStore';
import { Canvas, Path, Skia, LinearGradient, vec, Circle as SkiaCircle, Line as SkiaLine, DashPathEffect, SkPath } from '@shopify/react-native-skia';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { toSlug, ALL_SLUGS } from '../../utils/muscleVolume';
import SetRow from './SetRow';

/* ─── Focused body map helpers ─────────────────────────── */

const CATEGORY_SLUGS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids', 'rear-deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'],
  Core: ['abs', 'obliques'],
};

const SLUG_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  chest:          { y: 0.32, side: 'front' },
  deltoids:       { y: 0.26, side: 'front' },
  'rear-deltoids':{ y: 0.26, side: 'back' },
  biceps:         { y: 0.37, side: 'front' },
  triceps:        { y: 0.37, side: 'back' },
  forearm:        { y: 0.48, side: 'front' },
  abs:            { y: 0.44, side: 'front' },
  obliques:       { y: 0.44, side: 'front' },
  'upper-back':   { y: 0.32, side: 'back' },
  'lower-back':   { y: 0.44, side: 'back' },
  trapezius:      { y: 0.23, side: 'back' },
  quadriceps:     { y: 0.66, side: 'front' },
  hamstring:      { y: 0.66, side: 'back' },
  gluteal:        { y: 0.53, side: 'back' },
  calves:         { y: 0.83, side: 'back' },
  adductors:      { y: 0.62, side: 'front' },
  tibialis:       { y: 0.80, side: 'front' },
};

const CATEGORY_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  Chest:     { y: 0.32, side: 'front' },
  Back:      { y: 0.32, side: 'back' },
  Shoulders: { y: 0.26, side: 'front' },
  Arms:      { y: 0.37, side: 'front' },
  Legs:      { y: 0.66, side: 'front' },
  Core:      { y: 0.44, side: 'front' },
};

const BODY_SCALE = 0.35;
const BODY_W = 200 * BODY_SCALE;
const BODY_H = 400 * BODY_SCALE;

/* ─── History Graph ────────────────────────────────────── */

const GRAPH_H = sw(140);
const GRAPH_PAD_X = sw(32);
const GRAPH_PAD_TOP = sw(20);
const GRAPH_PAD_BOTTOM = sw(28);

interface HistorySession {
  date: string;
  sets: { kg: number; reps: number; set_type: string | null }[];
}

function ExerciseHistoryGraph({ history, colors }: { history: HistorySession[]; colors: ThemeColors }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    // Reverse so oldest first (left → right)
    const reversed = [...history].reverse();
    return reversed.map((s) => {
      const vol = s.sets.reduce((sum, set) => sum + set.kg * set.reps, 0);
      const maxKg = Math.max(...s.sets.map((set) => set.kg), 0);
      const d = new Date(s.date);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      return { vol, maxKg, label, sets: s.sets.length };
    });
  }, [history]);

  const chartW = sw(340);
  const drawW = chartW - GRAPH_PAD_X * 2;
  const drawH = GRAPH_H - GRAPH_PAD_TOP - GRAPH_PAD_BOTTOM;

  const buildCurve = useCallback((values: number[]) => {
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    if (data.length < 2) return { linePath: null, fillPath: null, points: [] as { x: number; y: number }[], rawMin, rawMax };

    const range = rawMax - rawMin;
    const minVal = range > 0 ? rawMin - range * 0.15 : rawMax * 0.8;
    const maxVal = range > 0 ? rawMax + range * 0.15 : rawMax * 1.2;
    const span = maxVal - minVal || 1;

    const pts = values.map((v, i) => ({
      x: GRAPH_PAD_X + (i / (data.length - 1)) * drawW,
      y: GRAPH_PAD_TOP + drawH - ((v - minVal) / span) * drawH,
    }));

    const lp = Skia.Path.Make();
    lp.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      lp.cubicTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }

    const fp = Skia.Path.Make();
    fp.addPath(lp);
    fp.lineTo(pts[pts.length - 1].x, GRAPH_PAD_TOP + drawH);
    fp.lineTo(pts[0].x, GRAPH_PAD_TOP + drawH);
    fp.close();

    return { linePath: lp, fillPath: fp, points: pts, rawMin, rawMax };
  }, [data.length, drawW, drawH]);

  const volCurve = useMemo(() => buildCurve(data.map((d) => d.vol)), [data, buildCurve]);
  const kgCurve = useMemo(() => buildCurve(data.map((d) => d.maxKg)), [data, buildCurve]);

  const KG_COLOR = '#F59E0B';

  if (data.length === 0) {
    return (
      <View style={{ paddingVertical: sw(20), alignItems: 'center' }}>
        <Text style={{ fontSize: ms(10), fontFamily: Fonts.medium, color: colors.textTertiary }}>
          No previous sessions
        </Text>
      </View>
    );
  }

  const latest = data[data.length - 1];
  const prev = data.length >= 2 ? data[data.length - 2] : null;
  const volDiff = prev ? latest.vol - prev.vol : 0;
  const volPct = prev && prev.vol > 0 ? Math.round((volDiff / prev.vol) * 100) : 0;
  const kgDiff = prev ? latest.maxKg - prev.maxKg : 0;
  const kgPctDiff = prev && prev.maxKg > 0 ? Math.round((kgDiff / prev.maxKg) * 100) : 0;

  return (
    <View style={{ marginTop: sw(6) }}>
      {/* Legend row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: sw(4), paddingHorizontal: sw(4) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sw(10) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sw(4) }}>
            <View style={{ width: sw(8), height: sw(3), borderRadius: sw(1.5), backgroundColor: colors.accent }} />
            <Text style={{ fontSize: ms(9), fontFamily: Fonts.medium, color: colors.textTertiary }}>Volume</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sw(4) }}>
            <View style={{ width: sw(8), height: sw(3), borderRadius: sw(1.5), backgroundColor: KG_COLOR }} />
            <Text style={{ fontSize: ms(9), fontFamily: Fonts.medium, color: colors.textTertiary }}>Top Weight</Text>
          </View>
        </View>
        {prev ? (
          <View style={{ flexDirection: 'row', gap: sw(8) }}>
            <Text style={{ fontSize: ms(9), fontFamily: Fonts.bold, color: volDiff >= 0 ? '#34C759' : colors.accentRed }}>
              {volDiff >= 0 ? '+' : ''}{volPct}%
            </Text>
            <Text style={{ fontSize: ms(9), fontFamily: Fonts.bold, color: kgDiff >= 0 ? '#34C759' : colors.accentRed }}>
              {kgDiff >= 0 ? '+' : ''}{kgPctDiff}%
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: sw(8) }}>
            <Text style={{ fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.accent }}>{latest.vol.toLocaleString()} kg</Text>
            <Text style={{ fontSize: ms(9), fontFamily: Fonts.semiBold, color: KG_COLOR }}>{latest.maxKg} kg</Text>
          </View>
        )}
      </View>

      {/* Skia graph with Y-axis labels */}
      <View style={{ position: 'relative' }}>
        {/* Left Y-axis: Volume */}
        <Text style={{ position: 'absolute', left: 0, top: GRAPH_PAD_TOP - sw(4), fontSize: ms(7), fontFamily: Fonts.medium, color: colors.accent + '80' }}>
          {volCurve.rawMax >= 1000 ? `${(volCurve.rawMax / 1000).toFixed(1)}k` : volCurve.rawMax}
        </Text>
        <Text style={{ position: 'absolute', left: 0, top: GRAPH_PAD_TOP + drawH - sw(4), fontSize: ms(7), fontFamily: Fonts.medium, color: colors.accent + '80' }}>
          {volCurve.rawMin >= 1000 ? `${(volCurve.rawMin / 1000).toFixed(1)}k` : volCurve.rawMin}
        </Text>
        {/* Right Y-axis: Weight */}
        <Text style={{ position: 'absolute', right: 0, top: GRAPH_PAD_TOP - sw(4), fontSize: ms(7), fontFamily: Fonts.medium, color: KG_COLOR + '80', textAlign: 'right' }}>
          {kgCurve.rawMax}
        </Text>
        <Text style={{ position: 'absolute', right: 0, top: GRAPH_PAD_TOP + drawH - sw(4), fontSize: ms(7), fontFamily: Fonts.medium, color: KG_COLOR + '80', textAlign: 'right' }}>
          {kgCurve.rawMin}
        </Text>

        <Canvas style={{ width: chartW, height: GRAPH_H }}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((pct) => (
            <SkiaLine
              key={pct}
              p1={vec(GRAPH_PAD_X, GRAPH_PAD_TOP + drawH * (1 - pct))}
              p2={vec(GRAPH_PAD_X + drawW, GRAPH_PAD_TOP + drawH * (1 - pct))}
              color={colors.cardBorder}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}

          {/* Volume fill gradient */}
          {volCurve.fillPath && (
            <Path path={volCurve.fillPath}>
              <LinearGradient
                start={vec(0, GRAPH_PAD_TOP)}
                end={vec(0, GRAPH_PAD_TOP + drawH)}
                colors={[colors.accent + '25', colors.accent + '03']}
              />
            </Path>
          )}

          {/* Volume line */}
          {volCurve.linePath && (
            <Path
              path={volCurve.linePath}
              style="stroke"
              strokeWidth={sw(1)}
              color={colors.accent}
              strokeCap="round"
              strokeJoin="round"
            />
          )}

          {/* Volume dots */}
          {volCurve.points.map((pt, i) => (
            <SkiaCircle key={`v${i}`} cx={pt.x} cy={pt.y} r={sw(3)} color={colors.accent} />
          ))}

          {/* Weight line */}
          {kgCurve.linePath && (
            <Path
              path={kgCurve.linePath}
              style="stroke"
              strokeWidth={sw(1)}
              color={KG_COLOR}
              strokeCap="round"
              strokeJoin="round"
            />
          )}

          {/* Weight dots */}
          {kgCurve.points.map((pt, i) => (
            <SkiaCircle key={`k${i}`} cx={pt.x} cy={pt.y} r={sw(3)} color={KG_COLOR} />
          ))}

          {/* Selected indicator line */}
          {selectedIdx !== null && volCurve.points[selectedIdx] && (
            <SkiaLine
              p1={vec(volCurve.points[selectedIdx].x, GRAPH_PAD_TOP)}
              p2={vec(volCurve.points[selectedIdx].x, GRAPH_PAD_TOP + drawH)}
              color="#FFFFFF"
              strokeWidth={1}
            >
              <DashPathEffect intervals={[sw(4), sw(3)]} />
            </SkiaLine>
          )}

          {/* Highlighted dots for selected point */}
          {selectedIdx !== null && volCurve.points[selectedIdx] && (
            <>
              <SkiaCircle cx={volCurve.points[selectedIdx].x} cy={volCurve.points[selectedIdx].y} r={sw(5)} color={colors.accent + '30'} />
              <SkiaCircle cx={volCurve.points[selectedIdx].x} cy={volCurve.points[selectedIdx].y} r={sw(3.5)} color={colors.accent} />
            </>
          )}
          {selectedIdx !== null && kgCurve.points[selectedIdx] && (
            <>
              <SkiaCircle cx={kgCurve.points[selectedIdx].x} cy={kgCurve.points[selectedIdx].y} r={sw(4.5)} color={KG_COLOR + '30'} />
              <SkiaCircle cx={kgCurve.points[selectedIdx].x} cy={kgCurve.points[selectedIdx].y} r={sw(3)} color={KG_COLOR} />
            </>
          )}
        </Canvas>

        {/* Touch targets */}
        {data.length >= 2 && data.map((_, i) => {
          const x = GRAPH_PAD_X + (i / (data.length - 1)) * drawW;
          const sliceW = data.length > 1 ? drawW / (data.length - 1) : drawW;
          return (
            <Pressable
              key={`hit${i}`}
              onPress={() => setSelectedIdx(selectedIdx === i ? null : i)}
              style={{
                position: 'absolute',
                left: x - sliceW / 2,
                top: 0,
                width: sliceW,
                height: GRAPH_H,
              }}
            />
          );
        })}
      </View>


      {/* Selected details */}
      {selectedIdx !== null && data[selectedIdx] && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: sw(12),
          paddingTop: sw(6),
        }}>
          <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: colors.textSecondary }}>
            {data[selectedIdx].label}
          </Text>
          <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: colors.accent }}>
            Vol: {data[selectedIdx].vol.toLocaleString()} kg
          </Text>
          <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: KG_COLOR }}>
            Top: {data[selectedIdx].maxKg} kg
          </Text>
        </View>
      )}
    </View>
  );
}

/* ─── ExerciseCard ─────────────────────────────────────── */

interface Props {
  exercise: ActiveExercise;
  exerciseIndex: number;
  isLast: boolean;
  totalExercises: number;
  isCurrent?: boolean;
  overloadTracker?: React.ReactNode;
  onReplace: (exerciseIndex: number) => void;
  onExerciseFocus?: (exerciseIndex: number) => void;
  onInputFocus?: (y: number) => void;
}

function ExerciseCard({ exercise, exerciseIndex, isLast, totalExercises, isCurrent, overloadTracker, onReplace, onExerciseFocus, onInputFocus }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useActiveWorkoutStore((s) => s.toggleSetComplete);
  const cycleSetType = useActiveWorkoutStore((s) => s.cycleSetType);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const aliasMap = useWorkoutStore((s) => s.aliasMap);
  const workouts = useWorkoutStore((s) => s.workouts);
  const themeMode = useThemeStore((s) => s.mode);

  const [showHistory, setShowHistory] = useState(false);

  // Pull history sessions for this exercise (most recent first)
  const exerciseHistory = useMemo(() => {
    const name = exercise.name.toLowerCase();
    // Build a set of all matching names (canonical + aliases)
    const canonical = aliasMap[name] || name;
    const matchNames = new Set<string>([name, canonical]);
    // Also add any aliases that resolve to the same canonical
    for (const [alias, canon] of Object.entries(aliasMap)) {
      if (canon.toLowerCase() === canonical) matchNames.add(alias.toLowerCase());
    }

    // Group all sets by date (merge multiple workouts on the same day)
    const sessionMap = new Map<string, { date: string; sets: { kg: number; reps: number; set_type: string | null }[] }>();
    for (const w of workouts) {
      for (const ex of w.exercises) {
        if (matchNames.has(ex.name.toLowerCase())) {
          const completedSets = ex.sets.filter((s) => s.completed);
          if (completedSets.length > 0) {
            const d = new Date(w.created_at);
            const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const existing = sessionMap.get(dateKey);
            const mapped = completedSets.map((s) => ({ kg: s.kg, reps: s.reps, set_type: s.set_type }));
            if (existing) {
              existing.sets.push(...mapped);
            } else {
              sessionMap.set(dateKey, { date: w.created_at, sets: mapped });
            }
          }
        }
      }
    }
    return [...sessionMap.values()].slice(0, 20);
  }, [workouts, exercise.name, aliasMap]);

  // Build body highlight data + focus region
  const { bodyData, focusY, bodySide, hasMuscles } = useMemo(() => {
    const entry = catalogMap[exercise.name];
    const primarySlugs = new Set<string>();
    const secondarySlugs = new Set<string>();

    if (entry) {
      for (const m of entry.primary_muscles) {
        const s = toSlug(m);
        if (s) primarySlugs.add(s);
      }
      for (const m of entry.secondary_muscles) {
        const s = toSlug(m);
        if (s) secondarySlugs.add(s);
      }
    }

    const category = exercise.category || entry?.category || null;
    if (primarySlugs.size === 0 && category) {
      const slugs = CATEGORY_SLUGS[category];
      if (slugs) slugs.forEach((s) => primarySlugs.add(s));
    }

    const firstSlug = [...primarySlugs][0];
    let fy = 0.35;
    let bs: 'front' | 'back' = 'front';

    if (firstSlug && SLUG_FOCUS[firstSlug]) {
      fy = SLUG_FOCUS[firstSlug].y;
      bs = SLUG_FOCUS[firstSlug].side;
    } else if (category && CATEGORY_FOCUS[category]) {
      fy = CATEGORY_FOCUS[category].y;
      bs = CATEGORY_FOCUS[category].side;
    }

    const bd: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
      slug,
      intensity: primarySlugs.has(slug) ? 6 : secondarySlugs.has(slug) ? 3 : 1,
    }));

    return { bodyData: bd, focusY: fy, bodySide: bs, hasMuscles: primarySlugs.size > 0 };
  }, [exercise.name, exercise.category, catalogMap]);

  const bodyPalette = useMemo(() => {
    const a = colors.accent;
    if (themeMode === 'dark') {
      return ['#1A1A1E', '#2A2A2E', a + '40', a + '60', a + '80', a, a];
    }
    return ['#E8E4DE', '#C8C4BE', a + '40', a + '60', a + '80', a, a];
  }, [themeMode, colors.accent]);

  const MAP_W = sw(44);
  const MAP_H = sw(52);
  const bodyOffsetX = -(BODY_W - MAP_W) / 2;
  const bodyOffsetY = -(BODY_H * focusY) + MAP_H / 2;

  // Summary
  const repRange = useMemo(() => {
    if (exercise.sets.length === 0) return '0';
    const reps = exercise.sets.map((s) => {
      const n = parseInt(s.reps, 10);
      return isNaN(n) ? 0 : n;
    });
    const min = Math.min(...reps);
    const max = Math.max(...reps);
    return min === max ? `${min}` : `${min}-${max}`;
  }, [exercise.sets]);

  const summary = `${exercise.sets.length} sets · ${repRange} reps`;

  const swipeableRef = React.useRef<Swipeable>(null);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        removeExercise(exerciseIndex);
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="trash" size={ms(22)} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  ), [removeExercise, exerciseIndex, styles]);

  return (
    <Pressable
      style={[styles.swipeContainer, isCurrent && styles.currentBorder]}
      onPress={() => onExerciseFocus?.(exerciseIndex)}
    >
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {exercise.name.replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <View style={{ flex: 1 }} />
          {exerciseHistory.length > 0 && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, !showHistory && styles.tabActive]}
                onPress={() => setShowHistory(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, !showHistory && styles.tabTextActive]}>Live</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, showHistory && styles.tabActive]}
                onPress={() => setShowHistory(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, showHistory && styles.tabTextActive]}>History</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.reorderBtns}>
              <TouchableOpacity
                onPress={() => moveExercise(exerciseIndex, 'up')}
                disabled={exerciseIndex === 0}
                style={styles.reorderBtn}
                activeOpacity={0.5}
              >
                <Ionicons name="chevron-up" size={ms(14)} color={exerciseIndex === 0 ? colors.textTertiary + '30' : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => moveExercise(exerciseIndex, 'down')}
                disabled={isLast}
                style={styles.reorderBtn}
                activeOpacity={0.5}
              >
                <Ionicons name="chevron-down" size={ms(14)} color={isLast ? colors.textTertiary + '30' : colors.textSecondary} />
              </TouchableOpacity>
          </View>
        </View>

        {showHistory ? (
          <ExerciseHistoryGraph history={exerciseHistory} colors={colors} />
        ) : (
          <>
            {/* Overload tracker */}
            {overloadTracker}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Column headers */}
            <View style={styles.colHeaders}>
              <Text style={[styles.colHeader, { width: sw(28) }]}>SET</Text>
              <Text style={[styles.colHeader, { width: sw(46) }]}>PREV</Text>
              <Text style={[styles.colHeader, { flex: 1 }]}>KG</Text>
              <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
              <View style={{ width: sw(24) }} />
            </View>

            {/* Sets */}
            {exercise.sets.map((set, setIdx) => (
              <SetRow
                key={`${set.id}-${setIdx}`}
                index={setIdx}
                set={set}
                prevSet={exercise.prevSets?.[setIdx] || null}
                onUpdate={(field, value) => { onExerciseFocus?.(exerciseIndex); updateSet(exerciseIndex, setIdx, field, value); }}
                onToggle={() => { onExerciseFocus?.(exerciseIndex); toggleSetComplete(exerciseIndex, setIdx); }}
                onCycleSetType={() => cycleSetType(exerciseIndex, setIdx)}
                onDelete={exercise.sets.length > 1 ? () => removeSet(exerciseIndex, setIdx) : null}
                onInputFocus={(y) => { onExerciseFocus?.(exerciseIndex); onInputFocus?.(y); }}
              />
            ))}

            {/* Add Set button */}
            <TouchableOpacity
              style={styles.addSetBtn}
              onPress={() => addSet(exerciseIndex)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={ms(14)} color={colors.accent} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Swipeable>
    </Pressable>
  );
}

export default React.memo(ExerciseCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: sw(8),
    borderWidth: sw(2),
    borderColor: colors.cardBorder,
  },
  currentBorder: {
    borderWidth: sw(1),
    borderColor: colors.textTertiary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(12),
  },
  deleteAction: {
    backgroundColor: colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: sw(80),
    gap: sw(4),
  },
  deleteText: {
    color: '#fff',
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
    flexShrink: 1,
  },
  categoryChip: {
    backgroundColor: colors.accent + '15',
    paddingHorizontal: sw(8),
    paddingVertical: sw(2),
    borderRadius: sw(4),
  },
  categoryText: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Reorder buttons
  reorderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(2),
  },
  reorderBtn: {
    padding: sw(2),
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(10),
  },

  // Tab toggle
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(2),
  },
  tab: {
    paddingHorizontal: sw(8),
    paddingVertical: sw(2),
    borderRadius: sw(6),
  },
  tabActive: {
    backgroundColor: colors.accent + '15',
  },
  tabText: {
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    color: colors.textTertiary,
    lineHeight: ms(16),
  },
  tabTextActive: {
    color: colors.accent,
  },

  // Column headers
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(6),
    marginBottom: sw(1),
    gap: sw(6),
  },
  colHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Add Set
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(7),
    marginTop: sw(3),
    gap: sw(4),
  },
  addSetText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
});
