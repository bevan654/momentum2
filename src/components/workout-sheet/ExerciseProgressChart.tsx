import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Rect, RoundedRect, DashPathEffect, Skia, Group, BlurMask, LinearGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { ActiveSet } from '../../stores/useActiveWorkoutStore';
import {
  beatsTarget,
  completedSetsToday,
  formatVolume,
  paceTarget,
  sessionVolume,
  volumeLabel,
  type ExerciseType,
} from '../../utils/exerciseProgress';

const CHART_H = sw(68);
const PAD_TOP = sw(6);
const PAD_X = sw(4);
const BAR_MAX_W = sw(16);
const Y_LABEL_W = sw(28);
const EMPTY_SESSIONS: never[] = [];

interface Props {
  exerciseName: string;
  exerciseType: ExerciseType;
  sets: ActiveSet[];
  /** Opens the full exercise history modal */
  onOpenHistory?: (exerciseName: string) => void;
}

/**
 * Inline progressive-overload chart for one exercise in the active workout.
 * - Bars: volume of the last sessions. Sessions that beat the one before
 *   (an overload) are solid accent with a soft glow; others are faint.
 * - Today's bar fills as sets are logged toward a ghost outline at last
 *   session's volume, and goes solid with a glow pulse + haptic once beaten.
 * - Dashed target line: steady overload pace from the first session shown
 *   (OVERLOAD_PACE_PER_SESSION, compounding), projected through today.
 */
function ExerciseProgressChart({ exerciseName, exerciseType, sets, onOpenHistory }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sessions = useWorkoutStore((s) => s.sessionHistoryMap[exerciseName]) ?? EMPTY_SESSIONS;

  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Oldest → newest; sessions are stored newest-first.
  const ordered = useMemo(() => [...sessions].reverse(), [sessions]);
  const pastVol = useMemo(() => ordered.map((s) => sessionVolume(s.sets, exerciseType)), [ordered, exerciseType]);
  const target = pastVol.length > 0 ? pastVol[pastVol.length - 1] : 0;
  const todayVol = useMemo(() => sessionVolume(completedSetsToday(sets), exerciseType), [sets, exerciseType]);
  const achieved = beatsTarget(todayVol, target);
  // Pace line needs a start point plus at least one session to measure against.
  const showPace = pastVol.length >= 2 && pastVol[0] > 0;
  const paceToday = showPace ? paceTarget(pastVol[0], pastVol.length) : 0;

  const geom = useMemo(() => {
    const plotW = width - Y_LABEL_W;
    if (plotW <= 0 || pastVol.length < 1) return null;
    const slots = pastVol.length + 1; // + today
    const slotW = (plotW - PAD_X * 2) / slots;
    const barW = Math.min(BAR_MAX_W, slotW * 0.6);
    const cx = (i: number) => PAD_X + slotW * i + slotW / 2;
    const usable = CHART_H - PAD_TOP;

    // One volume scale for bars, ghost, today and pace (so overshoots still fit),
    // rounded up to a clean number so the y-axis labels read nicely.
    const volMax = niceCeil(Math.max(...pastVol, target, todayVol, paceToday, 1));
    const barH = (v: number) => (v / volMax) * usable;
    const ticks = [volMax, volMax / 2].map((v) => ({ v, y: CHART_H - barH(v) }));
    const gridPath = Skia.Path.Make();
    for (const t of ticks) {
      gridPath.moveTo(0, t.y);
      gridPath.lineTo(plotW, t.y);
    }
    const bars = pastVol.map((v, i) => {
      const h = barH(v);
      // An overload session beat the session before it.
      const overload = i > 0 && beatsTarget(v, pastVol[i - 1]);
      return { x: cx(i) - barW / 2, y: CHART_H - h, h, overload };
    });
    const todayX = cx(pastVol.length) - barW / 2;
    const ghostH = barH(target);
    const ghostPath = Skia.Path.Make();
    ghostPath.addRect(Skia.XYWHRect(todayX, CHART_H - ghostH, barW, ghostH));

    let pacePath = null;
    if (showPace) {
      pacePath = Skia.Path.Make();
      for (let i = 0; i <= pastVol.length; i++) {
        const y = CHART_H - barH(paceTarget(pastVol[0], i));
        if (i === 0) pacePath.moveTo(cx(i), y);
        else pacePath.lineTo(cx(i), y);
      }
    }

    return { plotW, barW, bars, todayX, ghostPath, pacePath, barH, ticks, gridPath };
  }, [width, pastVol, target, todayVol, paceToday, showPace]);

  // Today's bar grows as sets are completed.
  const todayH = useSharedValue(0);
  useEffect(() => {
    if (geom) todayH.value = withTiming(geom.barH(todayVol), { duration: 350 });
  }, [geom, todayVol, todayH]);
  const todayY = useDerivedValue(() => CHART_H - todayH.value);

  // Celebrate the moment today's volume beats last session: glow pulse +
  // success haptic. Only on the transition, not on mount or every later set.
  const glow = useSharedValue(achieved ? 0.55 : 0);
  const wasAchieved = useRef(achieved);
  useEffect(() => {
    if (achieved && !wasAchieved.current) {
      glow.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0.55, { duration: 500 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (!achieved) {
      glow.value = withTiming(0, { duration: 200 });
    }
    wasAchieved.current = achieved;
  }, [achieved, glow]);

  if (pastVol.length < 1) return null;

  // Today's bar: muted while working toward the target, solid once beaten.
  const fillColor = achieved ? colors.accent : colors.accent + '99';
  const firstDate = ordered.length > 0 ? formatShortDate(ordered[0].date) : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={[styles.title, achieved && { color: colors.accent }]} numberOfLines={1}>
          {achieved ? '✓ Overload achieved' : 'Progressive overload'}
        </Text>
        <Text style={styles.progress} numberOfLines={1}>
          <Text style={[styles.progressNow, { color: fillColor }]}>
            {formatVolume(todayVol, exerciseType, false)}
          </Text>
          {' / '}
          {formatVolume(target, exerciseType)}
        </Text>
      </View>

      <Pressable onPress={() => onOpenHistory?.(exerciseName)} onLayout={onLayout} style={styles.chartArea}>
        {geom && (
          <>
          <View style={styles.yLabels} pointerEvents="none">
            {geom.ticks.map((t) => (
              <Text key={t.v} style={[styles.yLabel, { top: t.y - ms(6) }]} numberOfLines={1}>
                {formatAxis(t.v, exerciseType)}
              </Text>
            ))}
          </View>
          <Canvas style={{ width: geom.plotW, height: CHART_H, marginLeft: Y_LABEL_W }}>
            <Path path={geom.gridPath} style="stroke" strokeWidth={StyleSheet.hairlineWidth} color={colors.cardBorder} />
            {geom.bars.map((b, i) =>
              b.overload ? (
                <Group key={i}>
                  <RoundedRect x={b.x} y={b.y} width={geom.barW} height={b.h} r={sw(2)} color={colors.accent + '45'}>
                    <BlurMask blur={sw(4)} style="normal" />
                  </RoundedRect>
                  <RoundedRect x={b.x} y={b.y} width={geom.barW} height={b.h} r={sw(2)}>
                    <LinearGradient start={vec(0, b.y)} end={vec(0, CHART_H)} colors={[colors.accent, colors.accent + '99']} />
                  </RoundedRect>
                </Group>
              ) : (
                <RoundedRect key={i} x={b.x} y={b.y} width={geom.barW} height={b.h} r={sw(2)} color={colors.accent + '26'} />
              ),
            )}
            {/* Last session's volume as a ghost outline: today's bar fills toward it */}
            <Path path={geom.ghostPath} style="stroke" strokeWidth={sw(1)} color={colors.textTertiary}>
              <DashPathEffect intervals={[sw(3), sw(3)]} />
            </Path>
            <Group opacity={glow}>
              <Rect x={geom.todayX} y={todayY} width={geom.barW} height={todayH} color={colors.accent + '80'}>
                <BlurMask blur={sw(5)} style="normal" />
              </Rect>
            </Group>
            <Rect x={geom.todayX} y={todayY} width={geom.barW} height={todayH} color={fillColor} />
            {geom.pacePath && (
              <Path path={geom.pacePath} style="stroke" strokeWidth={sw(1.5)} color={colors.textPrimary} strokeCap="round">
                <DashPathEffect intervals={[sw(4), sw(3)]} />
              </Path>
            )}
          </Canvas>
          </>
        )}
      </Pressable>

      <View style={styles.bottomRow}>
        <Text style={styles.axisLabel}>{firstDate}</Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colors.accent + '99' }]} />
            <Text style={styles.legendText}>{volumeLabel(exerciseType)}</Text>
          </View>
          {showPace && (
            <View style={styles.legendItem}>
              <View style={styles.legendDash}>
                <View style={[styles.legendDashSeg, { backgroundColor: colors.textPrimary }]} />
                <View style={[styles.legendDashSeg, { backgroundColor: colors.textPrimary }]} />
              </View>
              <Text style={styles.legendText}>Target</Text>
            </View>
          )}
        </View>
        <Text style={styles.axisLabel}>Today</Text>
      </View>
    </View>
  );
}

/** Round up to a clean axis maximum that stays close to the data (1, 1.2, 1.5 … 8 × 10ⁿ). */
function niceCeil(v: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * mag >= v) return step * mag;
  }
  return 10 * mag;
}

/** Compact y-axis label: 1.2k, 500, or m:ss for timed exercises. */
function formatAxis(v: number, type: ExerciseType): string {
  if (type === 'duration') {
    const s = Math.round(v);
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
  }
  if (v >= 1000) return `${(Math.round(v / 100) / 10).toString()}k`;
  return String(Math.round(v));
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default React.memo(ExerciseProgressChart);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    marginTop: sw(10),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sw(8),
    marginBottom: sw(6),
  },
  title: {
    flexShrink: 1,
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progress: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(13),
  },
  progressNow: {
    fontFamily: Fonts.bold,
  },
  chartArea: {
    height: CHART_H,
  },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Y_LABEL_W - sw(4),
  },
  yLabel: {
    position: 'absolute',
    right: 0,
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    lineHeight: ms(12),
    textAlign: 'right',
  },
  bottomRow: {
    paddingLeft: Y_LABEL_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sw(4),
  },
  axisLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    lineHeight: ms(11),
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  legendBar: {
    width: sw(6),
    height: sw(8),
    borderRadius: sw(1),
  },
  legendDash: {
    flexDirection: 'row',
    gap: sw(2),
  },
  legendDashSeg: {
    width: sw(4),
    height: sw(1.5),
    borderRadius: sw(1),
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    lineHeight: ms(12),
  },
});
