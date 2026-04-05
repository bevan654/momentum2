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
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import type { WeeklyAnalysis } from '../../stores/useMuscleAnalysisStore';
import type { MuscleGroup } from './musclePathData';
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

/* --- Themed color palettes --------------------------------- */
// Index 0 = inactive, 1-5 = heat gradient, 6 = selected highlight

const PALETTES = {
  dark: [
    '#141414', '#2A2A2E', '#4A4A4E', '#6E6E72', '#9A9A9E', '#CDCDD0', '#FFFFFF',
  ],
  light: [
    '#E0E0E2', '#B8B8BC', '#909096', '#6E6E72', '#4A4A4E', '#2A2A2E', '#1A1A1A',
  ],
};

const BORDERS = { dark: '#1C1C1E', light: '#A0A0A4' };
const HIGHLIGHT_TEXT = { dark: '#FFFFFF', light: '#1A1A1A' };

/* --- Slug → MuscleGroup for recovery lookup (derived from muscles.ts) --- */

import { SVG_SLUG_TO_BODY_GROUP } from '../../constants/muscles';

const SLUG_TO_GROUP = SVG_SLUG_TO_BODY_GROUP as Record<string, MuscleGroup>;

/* --- Recovery palette & helpers --------------------------- */

const RECOVERY_PALETTES = {
  dark:  ['#141D28', '#EF4444', '#F97316', '#EAB308', '#16A34A', '#22C55E', '#56D4F4'],
  light: ['#C8CED6', '#EF4444', '#F97316', '#EAB308', '#16A34A', '#22C55E', '#1D8FE1'],
};

function recoveryToIntensity(percent: number): number {
  if (percent >= 80) return 6;
  if (percent >= 60) return 5;
  if (percent >= 40) return 4;
  if (percent >= 20) return 3;
  return 2;
}

function getRecoveryStatusColor(percent: number, _c: ThemeColors): string {
  if (percent >= 80) return '#22C55E';
  if (percent >= 60) return '#16A34A';
  if (percent >= 40) return '#EAB308';
  if (percent >= 20) return '#F97316';
  return '#EF4444';
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
  id: string;
  group: MuscleGroup;
  slug: string;
  mx: number; my: number;
  lx: number; ly: number;
};

// Front: left-side labels for left muscles, right-side for right/center
const FRONT_CALLOUTS: Callout[] = [
  { id: 'shoulders', group: 'shoulders', slug: 'deltoids',   mx: 0.32, my: 0.25, lx: 0.04, ly: 0.21 },
  { id: 'chest',     group: 'chest',     slug: 'chest',      mx: 0.45, my: 0.28, lx: 0.04, ly: 0.28 },
  { id: 'biceps',    group: 'biceps',    slug: 'biceps',     mx: 0.19, my: 0.37, lx: 0.04, ly: 0.40 },
  { id: 'traps',     group: 'back',      slug: 'trapezius',  mx: 0.58, my: 0.21, lx: 0.96, ly: 0.17 },
  { id: 'abs',       group: 'abs',       slug: 'abs',        mx: 0.55, my: 0.43, lx: 0.96, ly: 0.43 },
  { id: 'quads',     group: 'quads',     slug: 'quadriceps', mx: 0.60, my: 0.57, lx: 0.96, ly: 0.57 },
];

const BACK_CALLOUTS: Callout[] = [
  { id: 'upper-back', group: 'back',       slug: 'upper-back', mx: 0.42, my: 0.26, lx: 0.04, ly: 0.24 },
  { id: 'lats',       group: 'back',       slug: 'upper-back', mx: 0.39, my: 0.36, lx: 0.04, ly: 0.41 },
  { id: 'glutes',     group: 'glutes',     slug: 'gluteal',    mx: 0.45, my: 0.50, lx: 0.04, ly: 0.52 },
  { id: 'triceps',    group: 'triceps',    slug: 'triceps',    mx: 0.76, my: 0.34, lx: 0.96, ly: 0.34 },
  { id: 'hamstrings', group: 'hamstrings', slug: 'hamstring',  mx: 0.60, my: 0.60, lx: 0.96, ly: 0.60 },
  { id: 'calves',     group: 'calves',     slug: 'calves',     mx: 0.60, my: 0.75, lx: 0.96, ly: 0.75 },
];

/* --- Sizing ------------------------------------------------ */

const DEFAULT_WIDTH_SCALE = Math.min(1, (SCREEN_WIDTH * 0.9 - sw(40)) / (2 * 200));
const FILL_WIDTH_SCALE = (SCREEN_WIDTH - sw(8)) / (2 * 200);
const FILL_OVERHEAD = sw(140);

// Slide-toggle pill dimensions
const PILL_W = sw(64);
const PILL_H = sw(40);

/* --- Toggle modes ------------------------------------------ */

type ViewMode = 'intensity' | 'recovery';

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

  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLab = !!fillHeight;
  const basePalette = PALETTES[mode];
  const palette = useMemo(() => isLab ? ['#3A3A42', ...basePalette.slice(1)] : basePalette, [isLab, basePalette]);
  const legendColors = palette.slice(1, 6);
  const [ready, setReady] = useState(!embedded);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(analysis ? 'recovery' : 'intensity');
  const showPct = useProfileSettingsStore((s) => s.showRecoveryPercent);
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

  // Compact mode: flatten all worked muscles to same intensity (simple highlight)
  const compactData = useMemo(() => {
    if (!compact) return bodyData;
    return bodyData.map((d) =>
      d.intensity > INACTIVE ? { ...d, intensity: HEAT_MAX } : d,
    );
  }, [compact, bodyData]);

  // Override selected muscle with highlight color
  const displayData = useMemo(() => {
    const base = compact ? compactData : bodyData;
    if (!selected) return base;
    return base.map((d) =>
      d.slug === selected ? { ...d, intensity: SELECTED } : d,
    );
  }, [compact, compactData, bodyData, selected]);

  const handlePress = useCallback((part: ExtendedBodyPart) => {
    if (!part.slug || !MUSCLE_SLUGS.has(part.slug)) return;
    const next = selected === part.slug ? null : part.slug!;
    setSelected(next);
    onMuscleSelect?.(next);
  }, [selected, onMuscleSelect]);

  /* --- Recovery mode data ----------------------------------- */

  const hasRecovery = !embedded && !!analysis;

  const baseRecoveryPalette = RECOVERY_PALETTES[mode];
  const recoveryPalette = useMemo(() => isLab ? ['#3A3A42', ...baseRecoveryPalette.slice(1)] : baseRecoveryPalette, [isLab, baseRecoveryPalette]);
  const recoveryLegendColors = recoveryPalette.slice(1, 6);

  const recoveryBodyData = useMemo(() => {
    if (!analysis) return bodyData;
    return bodyData.map((d) => {
      const group = SLUG_TO_GROUP[d.slug!];
      if (!group) return { ...d, intensity: 1 };
      const groupData = analysis.groups[group];
      if (!groupData || !groupData.lastTrainedAt) return { ...d, intensity: 1 };
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

  // Callout renderer — dots + sticks + labels (recovery mode)
  const renderCallouts = useCallback((side: 'front' | 'back') => {
    const callouts = side === 'front' ? FRONT_CALLOUTS : BACK_CALLOUTS;
    const bodyW = 200 * bodyScale;
    const bodyH = 400 * bodyScale;
    const dotR = sw(2.5);

    const getCalloutData = (c: Callout): { color: string; label: string } | null => {
      if (!analysis) return null;
      const groupData = analysis.groups[c.group];
      const pct = groupData?.lastTrainedAt ? groupData.recoveryPercent : 100;
      return { color: getRecoveryStatusColor(pct, colors), label: `${Math.round(pct)}%` };
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
  }, [analysis, bodyScale, colors, styles]);

  /* --- Slide toggle animation ------------------------------- */

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toggleAnim.value * PILL_W }],
  }));

  const handleToggle = useCallback((next: ViewMode) => {
    setViewMode(next);
    const idx = next === 'recovery' ? 0 : 1;
    toggleAnim.value = withTiming(idx, { duration: 200 });
  }, []);

  if (!ready) return <View style={{ height: 400 * bodyScale + sw(50) }} />;

  const isRecovery = viewMode === 'recovery';

  // Detail chip data
  const selVol = selected ? (volumeMap[selected] || 0) : 0;
  const selPct = maxVolume > 0 ? Math.round((selVol / maxVolume) * 100) : 0;

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
        {/* Vertical legend bar — hidden in compact mode */}
        {compact ? null : (
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
            data={isRecovery ? recoveryDisplayData : displayData}
            side="front"
            gender="male"
            scale={bodyScale}
            colors={isRecovery ? recoveryPalette : palette}
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
          {isRecovery && showPct && renderCallouts('front')}
        </View>
        <View style={{ width: 200 * bodyScale, height: 400 * bodyScale }}>
          <Body
            data={isRecovery ? recoveryDisplayData : displayData}
            side="back"
            gender="male"
            scale={bodyScale}
            colors={isRecovery ? recoveryPalette : palette}
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
          {isRecovery && showPct && renderCallouts('back')}
        </View>
        </View>
      </View>

      {/* Detail chip */}
      {selected && (isRecovery ? selRecoveryData?.lastTrainedAt : selVol > 0) && (
        <View style={styles.detailChip}>
          <View
            style={[
              styles.detailDot,
              {
                backgroundColor: isRecovery
                  ? selRecoveryColor!
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
          ) : (
            <Text style={[styles.detailPct, { color: HIGHLIGHT_TEXT[mode] }]}>{selPct}%</Text>
          )}
        </View>
      )}

      {/* Toggle: Recovery / Volume */}
      {compact ? null : hasRecovery ? (
        <View style={styles.toggleContainer}>
          <Animated.View style={[styles.togglePill, { backgroundColor: colors.accent, width: PILL_W }, pillStyle]} />
          <Pressable style={[styles.toggleHalf, { width: PILL_W }]} onPress={() => handleToggle('recovery')}>
            <Ionicons name="heart-outline" size={ms(14)} color={viewMode === 'recovery' ? colors.textOnAccent : colors.textTertiary} />
            <Text style={[styles.toggleLabel, viewMode === 'recovery' && { color: colors.textOnAccent }]}>Recovery</Text>
          </Pressable>
          <Pressable style={[styles.toggleHalf, { width: PILL_W }]} onPress={() => handleToggle('intensity')}>
            <Ionicons name="flame-outline" size={ms(14)} color={viewMode === 'intensity' ? colors.textOnAccent : colors.textTertiary} />
            <Text style={[styles.toggleLabel, viewMode === 'intensity' && { color: colors.textOnAccent }]}>Volume</Text>
          </Pressable>
        </View>
      ) : null}

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
});
