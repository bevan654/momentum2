import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, InteractionManager, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import Body from '../BodyHighlighter';
import type { ExtendedBodyPart } from '../BodyHighlighter';
import Svg, { Line as SvgLine, Circle as SvgCircle } from 'react-native-svg';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { useThemeStore } from '../../stores/useThemeStore';
import { useRankStore } from '../../stores/useRankStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useWeightStore } from '../../stores/useWeightStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import type { WeeklyAnalysis } from '../../stores/useMuscleAnalysisStore';
import type { MuscleGroup } from './musclePathData';
import { getRankColor } from '../workouts/RankBadge';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import {
  calculateMuscleVolume,
  MUSCLE_SLUGS,
  SLUG_LABELS,
  INACTIVE,
  HEAT_MAX,
} from '../../utils/muscleVolume';
import {
  computeFullRank,
  estimateOneRepMax,
  effectiveLoad,
  type ExerciseType,
  type BestSetEntry,
  type SlugScoreDetail,
} from '../../utils/strengthScore';

/* --- Themed color palettes --------------------------------- */
// Index 0 = inactive, 1-5 = heat gradient, 6 = selected highlight

const PALETTES = {
  dark: [
    '#141D28', '#1E3B53', '#255A80', '#3678A3', '#5BA3CC', '#88E3FA', '#56D4F4',
  ],
  light: [
    '#C8CED6', '#94B8D8', '#6B9DC8', '#4882B8', '#2B6CB0', '#1A56A0', '#1D8FE1',
  ],
};

const BORDERS = { dark: '#2A2A2E', light: '#A0A8B4' };
const HIGHLIGHT_TEXT = { dark: '#56D4F4', light: '#1D8FE1' };

/* --- Slug → MuscleGroup for recovery lookup --------------- */

const SLUG_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest',
  'upper-back': 'back',
  'lower-back': 'back',
  trapezius: 'back',
  deltoids: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  abs: 'abs',
  obliques: 'abs',
  quadriceps: 'quads',
  tibialis: 'quads',
  adductors: 'quads',
  hamstring: 'hamstrings',
  gluteal: 'glutes',
  calves: 'calves',
};

/* --- Recovery palette & helpers --------------------------- */

const RECOVERY_PALETTES = {
  dark:  ['#141D28', '#EF4444', '#F97316', '#EAB308', '#16A34A', '#22C55E', '#56D4F4'],
  light: ['#C8CED6', '#EF4444', '#F97316', '#EAB308', '#16A34A', '#22C55E', '#1D8FE1'],
};

function recoveryToIntensity(percent: number): number {
  // Body component uses colors[intensity - 1], so:
  // intensity 2 → colors[1] = red, 6 → colors[5] = green
  if (percent >= 80) return 6;  // light green  → colors[5]
  if (percent >= 60) return 5;  // dark green   → colors[4]
  if (percent >= 40) return 4;  // yellow       → colors[3]
  if (percent >= 20) return 3;  // orange       → colors[2]
  return 2;                      // red          → colors[1]
}

function getRecoveryStatusColor(percent: number, _c: ThemeColors): string {
  if (percent >= 80) return '#22C55E';  // light green — colors[5]
  if (percent >= 60) return '#16A34A';  // dark green  — colors[4]
  if (percent >= 40) return '#EAB308';  // yellow      — colors[3]
  if (percent >= 20) return '#F97316';  // orange      — colors[2]
  return '#EF4444';                      // red         — colors[1]
}

function getRecoveryStatusLabel(percent: number): string {
  if (percent >= 90) return 'Ready';
  if (percent >= 50) return 'Recovering';
  return 'Fatigued';
}

const SELECTED = 7;   // selected highlight intensity

/* --- Pulse overlay & label positions ----------------------- */

const PULSE_COLORS = [
  'transparent', '#3A3A42', '#3A3A42', '#3A3A42', 'transparent', 'transparent', 'transparent',
];

type Callout = {
  id: string;          // unique key
  group: MuscleGroup;  // recovery data lookup
  slug: string;        // rank data lookup (slugScores key)
  mx: number; my: number; // anchor on muscle (fraction)
  lx: number; ly: number; // label position (fraction)
};

// Front: left-side labels for left muscles, right-side for right/center
const FRONT_CALLOUTS: Callout[] = [
  // Left column
  { id: 'shoulders', group: 'shoulders', slug: 'deltoids',   mx: 0.32, my: 0.25, lx: 0.04, ly: 0.21 },
  { id: 'chest',     group: 'chest',     slug: 'chest',      mx: 0.45, my: 0.28, lx: 0.04, ly: 0.28 },
  { id: 'biceps',    group: 'biceps',    slug: 'biceps',     mx: 0.19, my: 0.37, lx: 0.04, ly: 0.40 },
  // Right column
  { id: 'traps',     group: 'back',      slug: 'trapezius',  mx: 0.58, my: 0.21, lx: 0.96, ly: 0.17 },
  { id: 'abs',       group: 'abs',       slug: 'abs',        mx: 0.55, my: 0.43, lx: 0.96, ly: 0.43 },
  { id: 'quads',     group: 'quads',     slug: 'quadriceps', mx: 0.60, my: 0.57, lx: 0.96, ly: 0.57 },
];

// Back: traps / upper-back / lats shown separately
const BACK_CALLOUTS: Callout[] = [
  // Left column
  { id: 'upper-back', group: 'back',       slug: 'upper-back', mx: 0.42, my: 0.26, lx: 0.04, ly: 0.24 },
  { id: 'lats',       group: 'back',       slug: 'upper-back', mx: 0.39, my: 0.36, lx: 0.04, ly: 0.41 },
  { id: 'glutes',     group: 'glutes',     slug: 'gluteal',    mx: 0.45, my: 0.50, lx: 0.04, ly: 0.52 },
  // Right column
  { id: 'triceps',    group: 'triceps',    slug: 'triceps',    mx: 0.76, my: 0.34, lx: 0.96, ly: 0.34 },
  { id: 'hamstrings', group: 'hamstrings', slug: 'hamstring',  mx: 0.60, my: 0.60, lx: 0.96, ly: 0.60 },
  { id: 'calves',     group: 'calves',     slug: 'calves',     mx: 0.60, my: 0.75, lx: 0.96, ly: 0.75 },
];

/* --- Sizing ------------------------------------------------ */

// Width-based max scale (two bodies side-by-side)
const DEFAULT_WIDTH_SCALE = Math.min(1, (SCREEN_WIDTH * 0.9 - sw(40)) / (2 * 200));

// Full-page: use nearly all the width for a bigger body
const FILL_WIDTH_SCALE = (SCREEN_WIDTH - sw(8)) / (2 * 200);

// Vertical space reserved for labels, toggle, legend, gaps
const FILL_OVERHEAD = sw(140);

// Slide-toggle pill dimensions
const PILL_W = sw(64);
const PILL_H = sw(40);
const PILL_W_3 = sw(64);    // per-section width when 3 options

/* --- Rank palette ------------------------------------------ */

const RANK_NAMES = [
  'Novice', 'Apprentice', 'Intermediate', 'Advanced', 'Elite',
  'Master', 'Grandmaster', 'Titan', 'Mythic', 'Legend',
] as const;

const RANK_NAME_TO_INTENSITY: Record<string, number> = {};
RANK_NAMES.forEach((name, i) => { RANK_NAME_TO_INTENSITY[name] = i + 2; });

const RANK_SELECTED = RANK_NAMES.length + 2; // 12

// Short labels for the vertical rank legend (bottom = lowest, top = highest)
const RANK_SHORT: Record<string, string> = {
  Novice: 'NOV', Apprentice: 'APP', Intermediate: 'INT', Advanced: 'ADV', Elite: 'ELI',
  Master: 'MAS', Grandmaster: 'GM', Titan: 'TIT', Mythic: 'MYT', Legend: 'LEG',
};

/* --- Toggle modes ------------------------------------------ */

type ViewMode = 'intensity' | 'rank' | 'recovery';

/* --- Props ------------------------------------------------- */

interface Props {
  exercises: ExerciseWithSets[];
  refreshKey?: number;
  embedded?: boolean;
  compact?: boolean;
  fillHeight?: number;
  onMuscleSelect?: (slug: string | null) => void;
  analysis?: WeeklyAnalysis | null;
}

/* --- Component --------------------------------------------- */

function MuscleHeatmap({ exercises, refreshKey, embedded, compact, fillHeight, onMuscleSelect, analysis }: Props) {
  const bodyScale = useMemo(() => {
    if (fillHeight) {
      const heightScale = (fillHeight - FILL_OVERHEAD) / 400;
      return Math.max(0.3, Math.min(heightScale, FILL_WIDTH_SCALE));
    }
    return compact ? DEFAULT_WIDTH_SCALE * 0.7 : DEFAULT_WIDTH_SCALE;
  }, [fillHeight, compact]);

  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const globalSlugScores = useRankStore((s) => s.slugScores);

  // When embedded (workout summary), compute rank from only this workout's exercises
  const localSlugScores = useMemo<Partial<Record<string, SlugScoreDetail>>>(() => {
    if (!embedded) return {};
    const catalogMap = useWorkoutStore.getState().catalogMap;
    const ciCatalog: Record<string, any> = {};
    for (const [n, e] of Object.entries(catalogMap)) ciCatalog[n.toLowerCase()] = e;
    const bodyweight = useWeightStore.getState().current ?? 70;

    const bestSets: Record<string, BestSetEntry> = {};
    for (const ex of exercises) {
      const cat = catalogMap[ex.name] ?? ciCatalog[ex.name.toLowerCase()];
      const exType = (ex.exercise_type || cat?.exercise_type || 'weighted') as ExerciseType;
      for (const s of ex.sets) {
        if (!s.completed) continue;
        if (s.set_type && s.set_type !== 'working') continue;
        const kg = Number(s.kg) || 0;
        const reps = Number(s.reps) || 0;
        if (reps <= 0) continue;
        const load = effectiveLoad(kg, bodyweight, exType);
        if (load <= 0) continue;
        const e1rm = estimateOneRepMax(load, reps);
        const prev = bestSets[ex.name];
        if (!prev || e1rm > prev.e1rm) {
          bestSets[ex.name] = { kg, reps, exerciseType: exType, e1rm };
        }
      }
    }
    if (Object.keys(bestSets).length === 0) return {};
    return computeFullRank({ bestSets, bodyweight, catalog: ciCatalog, totalWorkouts: 1 }).slugScores;
  }, [embedded, exercises]);

  const slugScores = embedded ? localSlugScores : globalSlugScores;

  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLab = !!fillHeight;
  const basePalette = PALETTES[mode];
  const palette = useMemo(() => isLab ? ['#3A3A42', ...basePalette.slice(1)] : basePalette, [isLab, basePalette]);
  const legendColors = palette.slice(1, 6);
  const [ready, setReady] = useState(!embedded);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(analysis ? 'recovery' : 'intensity');
  const showPct = useProfileSettingsStore((s) => s.showRecoveryPercent);
  const showRankLabels = useProfileSettingsStore((s) => s.showRankLabels);
  const toggleAnim = useSharedValue(0);

  // Switch to recovery mode once analysis loads for the first time
  const hasAutoSwitched = React.useRef(false);
  useEffect(() => {
    if (analysis && !embedded && !hasAutoSwitched.current) {
      setViewMode('recovery');
      toggleAnim.value = 0;
      hasAutoSwitched.current = true;
    }
  }, [analysis, embedded]);

  useEffect(() => {
    if (!embedded) return;
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, [embedded]);

  useEffect(() => {
    setSelected(null);
  }, [refreshKey]);

  const { bodyData, volumeMap, maxVolume } = useMemo(
    () => calculateMuscleVolume(exercises),
    [exercises],
  );

  // Override selected muscle with highlight color
  const displayData = useMemo(() => {
    if (!selected) return bodyData;
    return bodyData.map((d) =>
      d.slug === selected ? { ...d, intensity: SELECTED } : d,
    );
  }, [bodyData, selected]);

  const handlePress = useCallback((part: ExtendedBodyPart) => {
    if (!part.slug || !MUSCLE_SLUGS.has(part.slug)) return;
    const next = selected === part.slug ? null : part.slug!;
    setSelected(next);
    onMuscleSelect?.(next);
  }, [selected, onMuscleSelect]);

  /* --- Rank mode data -------------------------------------- */

  // Palette for rank mode: [inactive, ...10 rank colors, selected highlight]
  const rankPalette = useMemo(() => [
    palette[0],
    ...RANK_NAMES.map((name) => getRankColor(name)),
    palette[6],
  ], [palette]);

  // Body data colored by each slug's own rank
  const rankBodyData = useMemo(() => {
    return bodyData.map((d) => {
      const slugDetail = slugScores[d.slug!];
      if (!slugDetail) return { ...d, intensity: 1 };
      const rankName = slugDetail.rank.name;
      const intensity = RANK_NAME_TO_INTENSITY[rankName] ?? 1;
      return { ...d, intensity };
    });
  }, [bodyData, slugScores]);

  // Apply selection highlight on top of rank data
  const rankDisplayData = useMemo(() => {
    if (!selected) return rankBodyData;
    return rankBodyData.map((d) =>
      d.slug === selected ? { ...d, intensity: RANK_SELECTED } : d,
    );
  }, [rankBodyData, selected]);

  /* --- Recovery mode data ----------------------------------- */

  const hasRecovery = !embedded && !!analysis;
  const pillW = hasRecovery ? PILL_W_3 : PILL_W;

  const baseRecoveryPalette = RECOVERY_PALETTES[mode];
  const recoveryPalette = useMemo(() => isLab ? ['#3A3A42', ...baseRecoveryPalette.slice(1)] : baseRecoveryPalette, [isLab, baseRecoveryPalette]);
  const recoveryLegendColors = recoveryPalette.slice(1, 6);

  const recoveryBodyData = useMemo(() => {
    if (!analysis) return bodyData;
    return bodyData.map((d) => {
      const group = SLUG_TO_GROUP[d.slug!];
      if (!group) return { ...d, intensity: 1 }; // no mapping → neutral
      const groupData = analysis.groups[group];
      if (!groupData || !groupData.lastTrainedAt) return { ...d, intensity: 1 }; // untrained → neutral
      return { ...d, intensity: recoveryToIntensity(groupData.recoveryPercent) };
    });
  }, [bodyData, analysis]);

  const recoveryDisplayData = useMemo(() => {
    if (!selected) return recoveryBodyData;
    return recoveryBodyData.map((d) =>
      d.slug === selected ? { ...d, intensity: SELECTED } : d,
    );
  }, [recoveryBodyData, selected]);

  /* --- Pulse animation for recovery mode -------------------- */

  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    if (viewMode === 'recovery') {
      pulseAnim.value = withRepeat(
        withTiming(0.35, { duration: 1500 }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulseAnim);
      pulseAnim.value = withTiming(0, { duration: 300 });
    }
  }, [viewMode]);

  const pulseOpacityStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  // Overlay data — only non-recovered muscles get white flash
  const pulseOverlayData = useMemo(() => {
    if (!analysis) return bodyData.map((d) => ({ ...d, intensity: INACTIVE }));
    return bodyData.map((d) => {
      const group = SLUG_TO_GROUP[d.slug!];
      if (!group) return { ...d, intensity: INACTIVE };
      const groupData = analysis.groups[group];
      if (!groupData || !groupData.lastTrainedAt || groupData.recoveryPercent >= 90) {
        return { ...d, intensity: INACTIVE };
      }
      return { ...d, intensity: 2 };
    });
  }, [bodyData, analysis]);

  // Callout renderer — dots + sticks + labels (recovery & rank modes)
  const renderCallouts = useCallback((side: 'front' | 'back', calloutMode: 'recovery' | 'rank') => {
    const callouts = side === 'front' ? FRONT_CALLOUTS : BACK_CALLOUTS;
    const bodyW = 200 * bodyScale;
    const bodyH = 400 * bodyScale;
    const dotR = sw(2.5);

    const getCalloutData = (c: Callout): { color: string; label: string } | null => {
      if (calloutMode === 'recovery') {
        if (!analysis) return null;
        const groupData = analysis.groups[c.group];
        const pct = groupData?.lastTrainedAt ? groupData.recoveryPercent : 100;
        return { color: getRecoveryStatusColor(pct, colors), label: `${Math.round(pct)}%` };
      }
      // rank mode
      const detail = slugScores[c.slug];
      if (!detail) return { color: colors.textTertiary, label: 'N/A' };
      const rankName = detail.rank.name;
      return { color: getRankColor(rankName), label: rankName };
    };

    return (
      <>
        <Svg width={bodyW} height={bodyH} style={StyleSheet.absoluteFill} pointerEvents="none">
          {callouts.map((c) => {
            const data = getCalloutData(c);
            if (!data) return null;
            return (
              <React.Fragment key={`${side}-${c.id}`}>
                <SvgCircle
                  cx={c.mx * bodyW}
                  cy={c.my * bodyH}
                  r={dotR}
                  fill={data.color}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={0.5}
                />
                <SvgLine
                  x1={c.mx * bodyW}
                  y1={c.my * bodyH}
                  x2={c.lx * bodyW}
                  y2={c.ly * bodyH}
                  stroke={data.color}
                  strokeWidth={sw(0.8)}
                  opacity={0.7}
                />
              </React.Fragment>
            );
          })}
        </Svg>
        {callouts.map((c) => {
          const data = getCalloutData(c);
          if (!data) return null;
          const isLeft = c.lx < 0.5;
          return (
            <View
              key={`${side}-${c.id}-lbl`}
              pointerEvents="none"
              style={[
                styles.calloutLabel,
                {
                  left: isLeft ? sw(1) : undefined,
                  right: isLeft ? undefined : sw(1),
                  top: c.ly * bodyH - sw(7),
                },
              ]}
            >
              <Text style={[styles.calloutText, { color: data.color }]}>
                {data.label}
              </Text>
            </View>
          );
        })}
      </>
    );
  }, [analysis, bodyScale, colors, styles, slugScores]);

  /* --- Slide toggle animation ------------------------------- */

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toggleAnim.value * pillW }],
  }));

  const handleToggle = useCallback((next: ViewMode) => {
    setViewMode(next);
    const idx = hasRecovery
      ? (next === 'recovery' ? 0 : next === 'intensity' ? 1 : 2)
      : (next === 'intensity' ? 0 : 1);
    toggleAnim.value = withTiming(idx, { duration: 200 });
  }, [hasRecovery]);

  if (!ready) return <View style={{ height: 400 * bodyScale + sw(50) }} />;

  const isRank = viewMode === 'rank';
  const isRecovery = viewMode === 'recovery';

  // Detail chip data
  const selVol = selected ? (volumeMap[selected] || 0) : 0;
  const selPct = maxVolume > 0 ? Math.round((selVol / maxVolume) * 100) : 0;
  const selSlugDetail = selected ? slugScores[selected] : undefined;
  const selRank = selSlugDetail ? selSlugDetail.rank.name : null;
  const selRankColor = selRank ? getRankColor(selRank) : null;

  // Recovery detail chip data
  const selRecoveryGroup = selected ? SLUG_TO_GROUP[selected] : null;
  const selRecoveryData = selRecoveryGroup && analysis ? analysis.groups[selRecoveryGroup] : null;
  const selRecoveryPct = selRecoveryData?.recoveryPercent ?? null;
  const selRecoveryColor = selRecoveryPct !== null ? getRecoveryStatusColor(selRecoveryPct, colors) : null;
  const selRecoveryStatus = selRecoveryPct !== null ? getRecoveryStatusLabel(selRecoveryPct) : null;

  return (
    <View style={[styles.container, fillHeight != null && styles.containerFill]}>
      {/* Front / Back labels */}
      <View style={[styles.labelRow, { width: 200 * bodyScale * 2 + sw(12) }]}>
        <Text style={styles.viewLabel}>FRONT</Text>
        <Text style={styles.viewLabel}>BACK</Text>
      </View>

      {/* Bodies with vertical legend on left */}
      <View style={styles.bodyWithLegend}>
        {/* Vertical legend bar */}
        {isRank ? (
          <View style={styles.rankLegend}>
            {[...RANK_NAMES].reverse().map((name) => (
              <View key={name} style={styles.rankLegendItem}>
                <View style={[styles.rankLegendDot, { backgroundColor: getRankColor(name) }]} />
                <Text style={[styles.rankLegendText, { color: getRankColor(name) }]}>
                  {RANK_SHORT[name]}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.verticalLegend}>
            <Text style={styles.verticalLegendLabel}>{isRecovery ? 'R' : 'H'}</Text>
            <View style={styles.verticalLegendBar}>
              {[...(isRecovery ? recoveryLegendColors : legendColors)].reverse().map((c) => (
                <View key={c} style={[styles.verticalLegendSeg, { backgroundColor: c }]} />
              ))}
            </View>
            <Text style={styles.verticalLegendLabel}>{isRecovery ? 'F' : 'L'}</Text>
          </View>
        )}

        {/* Two body views side-by-side */}
        <View style={[styles.bodyRow, fillHeight != null && styles.bodyRowFill]}>
        <View style={{ width: 200 * bodyScale, height: 400 * bodyScale }}>
          <Body
            data={isRecovery ? recoveryDisplayData : isRank ? rankDisplayData : displayData}
            side="front"
            gender="male"
            scale={bodyScale}
            colors={isRecovery ? recoveryPalette : isRank ? rankPalette : palette}
            border={BORDERS[mode]}
            backColor={isLab ? '#3A3A42' : undefined}
            onBodyPartPress={handlePress}
          />
          {isRecovery && showPct && (
            <Animated.View style={[StyleSheet.absoluteFill, pulseOpacityStyle]} pointerEvents="none">
              <Body
                data={pulseOverlayData}
                side="front"
                gender="male"
                scale={bodyScale}
                colors={PULSE_COLORS}
                border="none"
                backColor="transparent"
              />
            </Animated.View>
          )}
          {isRecovery && showPct && renderCallouts('front', 'recovery')}
          {isRank && showRankLabels && renderCallouts('front', 'rank')}
        </View>
        <View style={{ width: 200 * bodyScale, height: 400 * bodyScale }}>
          <Body
            data={isRecovery ? recoveryDisplayData : isRank ? rankDisplayData : displayData}
            side="back"
            gender="male"
            scale={bodyScale}
            colors={isRecovery ? recoveryPalette : isRank ? rankPalette : palette}
            border={BORDERS[mode]}
            backColor={isLab ? '#3A3A42' : undefined}
            onBodyPartPress={handlePress}
          />
          {isRecovery && showPct && (
            <Animated.View style={[StyleSheet.absoluteFill, pulseOpacityStyle]} pointerEvents="none">
              <Body
                data={pulseOverlayData}
                side="back"
                gender="male"
                scale={bodyScale}
                colors={PULSE_COLORS}
                border="none"
                backColor="transparent"
              />
            </Animated.View>
          )}
          {isRecovery && showPct && renderCallouts('back', 'recovery')}
          {isRank && showRankLabels && renderCallouts('back', 'rank')}
        </View>
        </View>
      </View>

      {/* Detail chip */}
      {selected && (isRecovery ? selRecoveryData?.lastTrainedAt : isRank ? selRank : selVol > 0) && (
        <View style={styles.detailChip}>
          <View
            style={[
              styles.detailDot,
              {
                backgroundColor: isRecovery
                  ? selRecoveryColor!
                  : isRank
                    ? selRankColor!
                    : palette[Math.min(HEAT_MAX, bodyData.find((d) => d.slug === selected)?.intensity ?? INACTIVE) - 1],
              },
            ]}
          />
          <Text style={styles.detailName}>{SLUG_LABELS[selected] || selected}</Text>
          <View style={styles.detailDivider} />
          {isRecovery ? (
            <Text style={[styles.detailPct, { color: selRecoveryColor! }]}>
              {selRecoveryStatus} {'\u00B7'} {selRecoveryPct}%
            </Text>
          ) : isRank ? (
            <Text style={[styles.detailPct, { color: selRankColor! }]}>{selRank}</Text>
          ) : (
            <Text style={[styles.detailPct, { color: HIGHLIGHT_TEXT[mode] }]}>{selPct}%</Text>
          )}
        </View>
      )}

      {/* Toggle: Recovery / Intensity / Rank */}
      <View style={styles.toggleContainer}>
        <Animated.View style={[styles.togglePill, { backgroundColor: colors.accent, width: pillW }, pillStyle]} />
        {hasRecovery && (
          <Pressable style={[styles.toggleHalf, { width: pillW }]} onPress={() => handleToggle('recovery')}>
            <Ionicons name="heart-outline" size={ms(14)} color={viewMode === 'recovery' ? colors.textOnAccent : colors.textTertiary} />
            <Text style={[styles.toggleLabel, viewMode === 'recovery' && { color: colors.textOnAccent }]}>Recovery</Text>
          </Pressable>
        )}
        <Pressable style={[styles.toggleHalf, { width: pillW }]} onPress={() => handleToggle('intensity')}>
          <Ionicons name="flame-outline" size={ms(14)} color={viewMode === 'intensity' ? colors.textOnAccent : colors.textTertiary} />
          <Text style={[styles.toggleLabel, viewMode === 'intensity' && { color: colors.textOnAccent }]}>Volume</Text>
        </Pressable>
        <Pressable style={[styles.toggleHalf, { width: pillW }]} onPress={() => handleToggle('rank')}>
          <Ionicons name="trophy-outline" size={ms(14)} color={viewMode === 'rank' ? colors.textOnAccent : colors.textTertiary} />
          <Text style={[styles.toggleLabel, viewMode === 'rank' && { color: colors.textOnAccent }]}>Rank</Text>
        </Pressable>
      </View>

    </View>
  );
}

export default React.memo(MuscleHeatmap);

/* --- Styles ------------------------------------------------ */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: sw(6),
    marginVertical: sw(4),
    overflow: 'hidden',
  },
  containerFill: {
    flex: 1,
    marginVertical: 0,
    paddingVertical: sw(4),
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  viewLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    letterSpacing: 1.5,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sw(4),
  },
  bodyRowFill: {
    gap: sw(2),
  },

  /* Callout labels */
  calloutLabel: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: sw(4),
    paddingHorizontal: sw(4),
    paddingVertical: sw(1),
  },
  calloutText: {
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    lineHeight: ms(11),
    textAlign: 'center' as const,
  },

  /* Detail chip */
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: sw(12),
    paddingVertical: sw(5),
    borderRadius: sw(10),
    gap: sw(6),
    marginTop: sw(2),
  },
  detailDot: {
    width: sw(7),
    height: sw(7),
    borderRadius: sw(4),
  },
  detailName: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
  detailDivider: {
    width: 1,
    height: sw(12),
    backgroundColor: colors.cardBorder,
  },
  detailPct: {
    fontSize: ms(12),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(16),
  },

  /* Slide toggle */
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    padding: sw(2),
    gap: sw(2),
    alignSelf: 'center',
  },
  togglePill: {
    position: 'absolute',
    top: sw(2),
    left: sw(2),
    width: PILL_W,
    height: PILL_H,
    borderRadius: sw(8),
  },
  toggleHalf: {
    width: PILL_W,
    height: PILL_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(1),
  },
  toggleLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(10),
  },

  /* Vertical legend */
  bodyWithLegend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalLegend: {
    alignItems: 'center',
    gap: sw(4),
    marginRight: sw(6),
  },
  verticalLegendLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(10),
  },
  verticalLegendBar: {
    width: sw(5),
    borderRadius: sw(3),
    overflow: 'hidden',
    height: sw(100),
  },
  verticalLegendSeg: {
    flex: 1,
  },

  /* Rank legend */
  rankLegend: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: sw(6),
    gap: sw(1),
  },
  rankLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
  },
  rankLegendDot: {
    width: sw(4),
    height: sw(4),
    borderRadius: sw(2),
  },
  rankLegendText: {
    fontSize: ms(6),
    fontFamily: Fonts.bold,
    lineHeight: ms(8),
  },
});
