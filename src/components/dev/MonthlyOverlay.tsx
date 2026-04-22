import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { useThemeStore } from '../../stores/useThemeStore';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MiniBodyMap from '../body/MiniBodyMap';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';

/* ─── Helpers ───────────────────────────────────────────── */

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return `${Math.round(vol)}`;
}


function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildHeatmapGrid(trainedDates: Set<string>, startDate: string, endDate: string): { rows: string[][]; cellSize: number; gap: number; cols: number } {
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const allDates: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    allDates.push(toDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  const totalDays = allDates.length;
  // More columns, fewer rows — use 7 columns, flow left-to-right then wrap
  const cols = 7;
  const numRows = Math.ceil(totalDays / cols);
  const rows: string[][] = Array.from({ length: numRows }, () => []);
  for (let i = 0; i < totalDays; i++) {
    const r = Math.floor(i / cols);
    rows[r].push(allDates[i]);
  }
  // Pad the last row if needed
  const lastRow = rows[numRows - 1];
  while (lastRow.length < cols) lastRow.push('');

  const availableWidth = CARD_WIDTH - sw(40);
  const gap = sw(3);
  const cellSize = Math.floor((availableWidth - (cols - 1) * gap) / cols);
  return { rows, cellSize: Math.min(cellSize, sw(38)), gap, cols };
}

/* ─── Component ─────────────────────────────────────────── */

export const CARD_WIDTH = SCREEN_WIDTH - sw(32);
export const CARD_HEIGHT_STORY = CARD_WIDTH * (16 / 9);
export const CARD_HEIGHT_FEED = CARD_WIDTH * (5 / 4);

export interface MonthlyOverlayData {
  trainedDates: string[];
  workouts: { created_at: string; totalVolume: number; exercises: ExerciseWithSets[] }[];
}

interface Props {
  backgroundUri?: string | null;
  data: MonthlyOverlayData;
  startDate?: string;
  endDate?: string;
}

const TEXT_SHADOW = {
  textShadowColor: '#00000090',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

export default function MonthlyOverlay({ backgroundUri, data, startDate, endDate }: Props) {
  const colors = useColors();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const hasImage = !!backgroundUri;
  const styles = useMemo(() => createStyles(colors, hasImage, isDark), [colors, hasImage, isDark]);
  const cardHeight = hasImage ? CARD_HEIGHT_STORY : CARD_HEIGHT_FEED;

  // Default: last 8 weeks
  const resolvedEnd = endDate || toDateKey(new Date());
  const resolvedStart = startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 55);
    return toDateKey(d);
  })();

  const trainedSet = useMemo(() => new Set(data.trainedDates), [data.trainedDates]);
  const heatmap = useMemo(() => buildHeatmapGrid(trainedSet, resolvedStart, resolvedEnd), [trainedSet, resolvedStart, resolvedEnd]);

  // Compute stats from workouts within the selected date range
  const rangeStats = useMemo(() => {
    const rangeWorkouts = data.workouts.filter((w) => {
      const key = toDateKey(new Date(w.created_at));
      return key >= resolvedStart && key <= resolvedEnd;
    });
    const totalVolume = rangeWorkouts.reduce((s, w) => s + w.totalVolume, 0);
    const daysTrained = new Set(rangeWorkouts.map((w) => toDateKey(new Date(w.created_at)))).size;
    return { totalWorkouts: rangeWorkouts.length, totalVolume, daysTrained };
  }, [data.workouts, resolvedStart, resolvedEnd]);

  // Format header date range
  const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const headerRange = useMemo(() => {
    const s = new Date(resolvedStart + 'T12:00:00');
    const e = new Date(resolvedEnd + 'T12:00:00');
    const sStr = `${SHORT_MONTHS[s.getMonth()]} ${s.getDate()}`;
    const eStr = `${SHORT_MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
    return `${sStr} — ${eStr}`;
  }, [resolvedStart, resolvedEnd]);

  return (
    <View style={[styles.card, { height: cardHeight }]}>
      {/* Background */}
      {hasImage ? (
        <>
          <Image
            source={{ uri: backgroundUri! }}
            style={styles.bgImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['#00000000', '#00000000', '#000000A0', '#000000DD']}
            locations={[0, 0.4, 0.7, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : (
        <LinearGradient
          colors={isDark ? ['#0F0F12', '#161619', '#1A1A1F'] : ['#FFFFFF', '#F8F6F2', '#F0EDE8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.accentGlow, { backgroundColor: colors.accent + '08' }]} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.subLabel}>Training Overview</Text>
          <Text style={styles.monthLabel}>{headerRange}</Text>
        </View>
        <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
      </View>

      <View style={styles.imageSpacer} />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="barbell-outline" size={ms(14)} color={hasImage ? '#FFFFFFAA' : colors.textTertiary} />
          <Text style={styles.statValue}>{formatVolume(rangeStats.totalVolume)} kg</Text>
          <Text style={styles.statLabel}>volume</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="calendar-outline" size={ms(14)} color={hasImage ? '#FFFFFFAA' : colors.textTertiary} />
          <Text style={styles.statValue}>{rangeStats.daysTrained}</Text>
          <Text style={styles.statLabel}>days trained</Text>
        </View>
      </View>

      {/* Training heatmap */}
      <View style={styles.heatmapSection}>
        <View style={[styles.heatmapGrid, { gap: heatmap.gap }]}>
          {heatmap.rows.map((row, ri) => (
            <View key={ri} style={[styles.heatmapRow, { gap: heatmap.gap }]}>
              {row.map((dateStr, ci) => {
                const dayNum = dateStr ? new Date(dateStr + 'T12:00:00').getDate() : 0;
                const isTrained = trainedSet.has(dateStr);
                return (
                  <View
                    key={ci}
                    style={[
                      styles.heatmapCell,
                      { width: heatmap.cellSize, height: heatmap.cellSize },
                      isTrained
                        ? { backgroundColor: colors.accent }
                        : dateStr
                          ? { backgroundColor: hasImage ? '#FFFFFF15' : isDark ? '#2A2A2E' : '#E8E5E0' }
                          : { backgroundColor: 'transparent' },
                    ]}
                  >
                    {dateStr !== '' && (
                      <Text style={[
                        styles.heatmapDayText,
                        isTrained && styles.heatmapDayTextTrained,
                      ]}>
                        {dayNum}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <LinearGradient
        colors={isDark || hasImage
          ? ['#FFFFFF00', hasImage ? '#FFFFFF50' : '#FFFFFF30', '#FFFFFF00']
          : ['#00000000', '#00000015', '#00000000']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bottomLine}
      />

      <Text style={styles.branding}>@momentumfitapp</Text>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors, hasImage: boolean, isDark: boolean) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      borderRadius: sw(20),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? '#2A2A2E' : '#E0DDD8',
    },
    bgImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    imageSpacer: { flex: 1 },
    accentGlow: {
      position: 'absolute',
      top: -sw(60),
      left: '20%',
      width: '60%',
      height: sw(120),
      borderRadius: sw(60),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: sw(20),
      paddingTop: sw(20),
    },
    subLabel: {
      color: hasImage ? '#FFFFFFCC' : colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      ...(hasImage && TEXT_SHADOW),
    },
    monthLabel: {
      color: hasImage || isDark ? '#FFFFFF' : colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(26),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
      marginTop: sw(2),
      ...(hasImage && TEXT_SHADOW),
    },
    logoImage: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(8),
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      paddingHorizontal: sw(20),
      marginTop: sw(16),
    },
    statItem: {
      alignItems: 'center',
      gap: sw(2),
    },
    statValue: {
      color: hasImage || isDark ? '#FFFFFF' : colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      ...(hasImage && TEXT_SHADOW),
    },
    statLabel: {
      color: hasImage ? '#FFFFFFAA' : colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
      ...(hasImage && TEXT_SHADOW),
    },
    statDivider: {
      width: 1,
      height: sw(30),
      backgroundColor: hasImage ? '#FFFFFF30' : isDark ? '#2A2A2E' : '#E0DDD8',
    },
    heatmapSection: {
      paddingHorizontal: sw(20),
      marginTop: sw(14),
      paddingBottom: sw(4),
    },
    heatmapGrid: {
      alignItems: 'center',
    },
    heatmapRow: {
      flexDirection: 'row',
    },
    heatmapCell: {
      borderRadius: sw(6),
      justifyContent: 'center',
      alignItems: 'center',
    },
    heatmapDayText: {
      color: hasImage ? '#FFFFFF60' : colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
      ...(hasImage && TEXT_SHADOW),
    },
    heatmapDayTextTrained: {
      color: colors.textOnAccent,
    },
    bottomLine: {
      height: sw(2),
      marginHorizontal: sw(20),
      marginTop: sw(8),
      borderRadius: sw(1),
    },
    branding: {
      color: hasImage ? '#FFFFFFCC' : isDark ? '#FFFFFFAA' : colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      letterSpacing: 0.3,
      marginTop: sw(8),
      marginBottom: sw(16),
      ...(hasImage && TEXT_SHADOW),
    },
  });
