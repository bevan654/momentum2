import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';
import MiniBodyMap from '../body/MiniBodyMap';
import { calculateMuscleVolume } from '../../utils/muscleVolume';
import { ALL_SLUGS } from '../../utils/muscleVolume';
import type { ExtendedBodyPart } from '../BodyHighlighter';

/* ─── Config ─────────────────────────────────────────────── */

const OUTER_PAD = sw(16);
const CARD_GAP = sw(8);
const HALF_W = (SCREEN_WIDTH - OUTER_PAD * 2 - CARD_GAP) / 2;
const CARD_PAD = sw(10);
const BODY_GAP = sw(6);
const AVAILABLE_W = HALF_W - CARD_PAD * 2;
const BODY_W = (AVAILABLE_W - BODY_GAP) / 2;
const BODY_SCALE = BODY_W / 200;

/* ─── Helpers ────────────────────────────────────────────── */

function compute30dBodyData(workouts: WorkoutWithDetails[]): ExtendedBodyPart[] {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
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

/* ─── Component ──────────────────────────────────────────── */

export default function BodyIntensityCard() {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bodyData = useMemo(() => compute30dBodyData(workouts), [workouts]);

  const hasData = useMemo(
    () => bodyData.some((bp) => (bp.intensity ?? 0) > 1),
    [bodyData],
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dot} />
        <View>
          <Text style={styles.title}>Body Map</Text>
          <Text style={styles.subtitle}>30d intensity</Text>
        </View>
      </View>

      {/* Body maps */}
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

      {!hasData && (
        <Text style={styles.emptyText}>No data yet</Text>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: HALF_W,
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
      gap: sw(6),
      marginBottom: sw(6),
    },
    dot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
      backgroundColor: colors.accent,
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },
    bodyRow: {
      flexDirection: 'row',
      justifyContent: 'center',
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
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginTop: sw(4),
    },
  });
