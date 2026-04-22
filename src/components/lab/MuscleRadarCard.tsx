import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Canvas,
  Path,
  Skia,
  vec,
  Line as SkiaLine,
  Circle,
} from '@shopify/react-native-skia';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';
import { useLabTimeRangeStore, LAB_RANGE_OPTIONS, nearestRangeOption } from '../../stores/useLabTimeRangeStore';
import MiniBodyMap from '../body/MiniBodyMap';
import { calculateMuscleVolume, ALL_SLUGS } from '../../utils/muscleVolume';
import type { ExtendedBodyPart } from '../BodyHighlighter';

/* ─── Config ─────────────────────────────────────────────── */

const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as const;
const RINGS = 4;

const CARD_PAD = sw(12);
const SECTION_GAP = sw(10);
const CARD_INNER = SCREEN_WIDTH - sw(16) * 2 - CARD_PAD * 2;
const SECTION_W = (CARD_INNER - SECTION_GAP) / 2;

/* Radar sizing */
const CHART_SIZE = SECTION_W;
const CENTER = CHART_SIZE / 2;
const RADIUS = CENTER - sw(28);
const DOT_R = sw(2);

/* Body sizing */
const BODY_GAP = sw(4);
const BODY_W = (SECTION_W - BODY_GAP) / 2;
const BODY_SCALE = BODY_W / 200;

/* ─── Muscle → Group mapping (derived from muscles.ts) ────── */

import { toCanonical, CANONICAL_TO_UI_CATEGORY } from '../../constants/muscles';

function muscleToGroup(raw: string): string | undefined {
  const canonical = toCanonical(raw);
  return canonical ? CANONICAL_TO_UI_CATEGORY[canonical] : undefined;
}

/* ─── Helpers ────────────────────────────────────────────── */

function computeGroupSets(
  workouts: WorkoutWithDetails[],
  days: number,
): Record<string, number> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffMs = cutoff.getTime();

  const counts: Record<string, number> = {};
  for (const g of GROUPS) counts[g] = 0;

  for (const w of workouts) {
    const t = new Date(w.created_at).getTime();
    if (t < cutoffMs) continue;

    for (const ex of w.exercises) {
      const completedSets = ex.sets.filter((s) => s.completed).length;
      if (completedSets === 0) continue;

      const counted = new Set<string>();
      for (const muscle of ex.primary_muscles) {
        const group = muscleToGroup(muscle);
        if (group && !counted.has(group)) {
          counted.add(group);
          counts[group] += completedSets;
        }
      }
    }
  }

  return counts;
}

function computeBodyData(workouts: WorkoutWithDetails[], days: number): ExtendedBodyPart[] {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffMs = cutoff.getTime();

  const slugVol: Record<string, number> = {};

  for (const w of workouts) {
    if (new Date(w.created_at).getTime() < cutoffMs) continue;
    const { volumeMap } = calculateMuscleVolume(w.exercises);
    for (const [slug, vol] of Object.entries(volumeMap)) {
      slugVol[slug] = (slugVol[slug] || 0) + vol;
    }
  }

  const maxVol = Math.max(...Object.values(slugVol), 1);

  return ALL_SLUGS.map((slug) => {
    const vol = slugVol[slug] || 0;
    if (vol <= 0) return { slug, intensity: 1 };
    const ratio = vol / maxVol;
    const intensity = 2 + Math.round(ratio * 4);
    return { slug, intensity: Math.min(intensity, 6) };
  });
}

function polarXY(angle: number, r: number): { x: number; y: number } {
  return {
    x: CENTER + r * Math.cos(angle - Math.PI / 2),
    y: CENTER + r * Math.sin(angle - Math.PI / 2),
  };
}

/* ─── Component ──────────────────────────────────────────── */

export default function MuscleRadarCard() {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const globalRangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const globalVersion = useLabTimeRangeStore((s) => s.version);
  const [localOverrideDays, setLocalOverrideDays] = useState<number | null>(null);

  // Reset local override when the global bar is tapped
  useEffect(() => {
    setLocalOverrideDays(null);
  }, [globalVersion]);

  const effectiveDays = localOverrideDays ?? globalRangeDays;
  const currentOption = nearestRangeOption(effectiveDays, LAB_RANGE_OPTIONS);
  const rangeIndex = LAB_RANGE_OPTIONS.findIndex((o) => o.days === currentOption.days);

  const goShorter = useCallback(() => {
    if (rangeIndex > 0) setLocalOverrideDays(LAB_RANGE_OPTIONS[rangeIndex - 1].days);
  }, [rangeIndex]);
  const goLonger = useCallback(() => {
    if (rangeIndex < LAB_RANGE_OPTIONS.length - 1) setLocalOverrideDays(LAB_RANGE_OPTIONS[rangeIndex + 1].days);
  }, [rangeIndex]);

  const groupSets = useMemo(
    () => computeGroupSets(workouts, effectiveDays),
    [workouts, effectiveDays],
  );
  const bodyData = useMemo(
    () => computeBodyData(workouts, effectiveDays),
    [workouts, effectiveDays],
  );

  const dateRangeLabel = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - effectiveDays);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(now)}`;
  }, [effectiveDays]);

  const maxSets = useMemo(() => {
    const vals = GROUPS.map((g) => groupSets[g]);
    const m = Math.max(...vals, 0);
    return m > 0 ? m : 10;
  }, [groupSets]);

  const totalSets = useMemo(
    () => GROUPS.reduce((sum, g) => sum + groupSets[g], 0),
    [groupSets],
  );

  const hasData = totalSets > 0;
  const angleStep = (2 * Math.PI) / GROUPS.length;

  const ringPaths = useMemo(() => {
    return Array.from({ length: RINGS }, (_, ring) => {
      const r = (RADIUS * (ring + 1)) / RINGS;
      const p = Skia.Path.Make();
      for (let i = 0; i < GROUPS.length; i++) {
        const { x, y } = polarXY(i * angleStep, r);
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.close();
      return p;
    });
  }, [angleStep]);

  const dataPath = useMemo(() => {
    if (!hasData) return null;
    const p = Skia.Path.Make();
    for (let i = 0; i < GROUPS.length; i++) {
      const ratio = Math.max(0.08, groupSets[GROUPS[i]] / maxSets);
      const r = ratio * RADIUS;
      const { x, y } = polarXY(i * angleStep, r);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    p.close();
    return p;
  }, [groupSets, maxSets, hasData, angleStep]);

  const dataPoints = useMemo(() => {
    if (!hasData) return [];
    return GROUPS.map((g, i) => {
      const ratio = Math.max(0.08, groupSets[g] / maxSets);
      return polarXY(i * angleStep, ratio * RADIUS);
    });
  }, [groupSets, maxSets, hasData, angleStep]);

  const labels = useMemo(() => {
    return GROUPS.map((g, i) => {
      const { x, y } = polarXY(i * angleStep, RADIUS + sw(10));
      return { group: g, x, y, sets: groupSets[g] };
    });
  }, [groupSets, angleStep]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.accentDot} />
        <Text style={styles.title}>Training Balance</Text>
        <View style={styles.headerRight}>
          <Text style={styles.dateRange}>{dateRangeLabel}</Text>
          <View style={styles.periodSelector}>
            <Pressable
              onPress={goShorter}
              style={[styles.arrowBtn, rangeIndex === 0 && styles.arrowDisabled] as ViewStyle[]}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-back"
                size={ms(12)}
                color={rangeIndex === 0 ? colors.textTertiary + '40' : colors.textSecondary}
              />
            </Pressable>
            <Text style={styles.periodLabel}>{currentOption.label}</Text>
            <Pressable
              onPress={goLonger}
              style={[
                styles.arrowBtn,
                rangeIndex === LAB_RANGE_OPTIONS.length - 1 && styles.arrowDisabled,
              ] as ViewStyle[]}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-forward"
                size={ms(12)}
                color={
                  rangeIndex === LAB_RANGE_OPTIONS.length - 1
                    ? colors.textTertiary + '40'
                    : colors.textSecondary
                }
              />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.contentRow}>
        {/* Radar section */}
        <View style={styles.radarSection}>
          <View style={{ width: CHART_SIZE, height: CHART_SIZE, overflow: 'visible' as const }}>
            <Canvas style={{ width: CHART_SIZE, height: CHART_SIZE }}>
              {ringPaths.map((rp, i) => (
                <Path
                  key={`ring-${i}`}
                  path={rp}
                  style="stroke"
                  strokeWidth={0.5}
                  color={colors.cardBorder + '60'}
                />
              ))}

              {GROUPS.map((_, i) => {
                const { x, y } = polarXY(i * angleStep, RADIUS);
                return (
                  <SkiaLine
                    key={`axis-${i}`}
                    p1={vec(CENTER, CENTER)}
                    p2={vec(x, y)}
                    color={colors.cardBorder + '40'}
                    strokeWidth={0.5}
                  />
                );
              })}

              {dataPath && (
                <Path path={dataPath} style="fill" color={colors.accent + '20'} />
              )}
              {dataPath && (
                <Path
                  path={dataPath}
                  style="stroke"
                  strokeWidth={sw(1.5)}
                  color={colors.accent + 'CC'}
                />
              )}

              {dataPoints.map((pt, i) => (
                <Circle
                  key={`dot-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={DOT_R}
                  color={colors.accent}
                />
              ))}
            </Canvas>

            {/* Labels */}
            {labels.map((l) => {
              const isLeft = l.x < CENTER - 10;
              const isRight = l.x > CENTER + 10;
              const isTop = l.y < CENTER;
              const pos: Record<string, number> = {
                top: l.y - (isTop ? ms(12) : ms(1)),
              };
              if (isLeft) {
                pos.right = CHART_SIZE - l.x + sw(1);
              } else if (isRight) {
                pos.left = l.x + sw(1);
              } else {
                pos.left = l.x - sw(20);
                pos.width = sw(40);
              }
              return (
                <View
                  key={l.group}
                  style={[
                    styles.labelWrap,
                    pos,
                    { alignItems: isLeft ? 'flex-end' : isRight ? 'flex-start' : 'center' },
                  ]}
                >
                  <Text style={styles.labelGroup}>{l.group}</Text>
                  {l.sets > 0 && (
                    <Text style={styles.labelSets}>{l.sets}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Body maps */}
        <View style={styles.bodySection}>
          <View style={styles.bodyRow}>
            <View style={styles.bodyCol}>
              <MiniBodyMap bodyData={bodyData} scale={BODY_SCALE} side="front" />
              <Text style={styles.sideLabel}>Front</Text>
            </View>
            <View style={styles.bodyCol}>
              <MiniBodyMap bodyData={bodyData} scale={BODY_SCALE} side="back" />
              <Text style={styles.sideLabel}>Back</Text>
            </View>
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
      padding: CARD_PAD,
      ...colors.cardShadow,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      marginBottom: sw(8),
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
    headerRight: {
      marginLeft: 'auto',
      alignItems: 'flex-end',
      gap: sw(2),
    },
    dateRange: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    periodSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    arrowBtn: {
      paddingHorizontal: sw(2),
    },
    arrowDisabled: {
      opacity: 0.4,
    },
    periodLabel: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      minWidth: sw(28),
      textAlign: 'center',
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SECTION_GAP,
    },
    /* Radar */
    radarSection: {
      width: SECTION_W,
      alignItems: 'center',
    },
    labelWrap: {
      position: 'absolute',
    },
    labelGroup: {
      color: colors.textPrimary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.semiBold,
    },
    labelSets: {
      color: colors.textTertiary,
      fontSize: ms(7),
      lineHeight: ms(10),
      fontFamily: Fonts.medium,
    },
    /* Body */
    bodySection: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodyRow: {
      flexDirection: 'row',
      gap: BODY_GAP,
    },
    bodyCol: {
      alignItems: 'center',
    },
    sideLabel: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.medium,
      marginTop: sw(2),
    },
  });
