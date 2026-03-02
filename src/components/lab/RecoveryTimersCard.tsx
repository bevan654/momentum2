import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withDelay,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { GROUP_LABELS, type MuscleGroup } from '../body/musclePathData';
import type {
  WeeklyAnalysis,
  MuscleExerciseEntry,
} from '../../stores/useMuscleAnalysisStore';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ────────────────────────── helpers ────────────────────────── */

interface Props {
  analysis: WeeklyAnalysis | null;
}

function getRecoveryColor(percent: number, colors: ThemeColors): string {
  if (percent >= 90) return colors.accentGreen;
  if (percent >= 50) return colors.accentOrange;
  return colors.accentRed;
}

function getStatusLabel(percent: number): string {
  if (percent >= 90) return 'Ready';
  if (percent >= 50) return 'Recovering';
  return 'Fatigued';
}

function formatHours(hours: number): string {
  if (hours < 1) return '<1h';
  if (hours >= 24) {
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  return `${Math.round(hours)}h`;
}

function formatRelativeTime(isoDate: string): string {
  const hoursAgo = (Date.now() - Date.parse(isoDate)) / 3600000;
  return `${formatHours(hoursAgo)} ago`;
}

function formatSetsSummary(sets: { kg: number; reps: number }[]): string {
  if (sets.length === 0) return '';
  const top = sets.slice(0, 3);
  // Check if all sets are identical
  const allSame =
    top.length > 1 &&
    top.every((s) => s.kg === top[0].kg && s.reps === top[0].reps);
  if (allSame) {
    return `${top.length} × ${top[0].kg}kg × ${top[0].reps}`;
  }
  return top.map((s) => `${s.kg}×${s.reps}`).join(', ');
}

/* ────────────────────────── arc constants ────────────────────────── */

const ARC_SIZE = sw(36);
const ARC_STROKE = sw(3.5);
const ARC_R = (ARC_SIZE - ARC_STROKE) / 2;
const ARC_C = 2 * Math.PI * ARC_R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ────────────────────────── RecoveryRow ────────────────────────── */

interface RowItem {
  group: MuscleGroup;
  recoveryPercent: number;
  recoveryRemaining: number;
  sessionCount: number;
  lastTrainedAt: string | null;
  undertrained: boolean;
  overtrained: boolean;
  exercises: MuscleExerciseEntry[];
}

interface RecoveryRowProps {
  item: RowItem;
  animateIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  colors: ThemeColors;
}

function RecoveryRow({
  item,
  animateIndex,
  isExpanded,
  onToggle,
  colors,
}: RecoveryRowProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const staggerDelay = animateIndex * 120;

  const dotColor = getRecoveryColor(item.recoveryPercent, colors);
  const status = getStatusLabel(item.recoveryPercent);
  const isFatigued = item.recoveryPercent < 50;

  /* ── shared values ── */
  const arcProgress = useSharedValue(0);
  const barWidth = useSharedValue(0);
  const rowOpacity = useSharedValue(0);
  const rowTranslateY = useSharedValue(sw(12));
  const pulseOpacity = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    const target = Math.min(item.recoveryPercent / 100, 1);

    // Row entrance
    rowOpacity.value = withDelay(
      staggerDelay,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    rowTranslateY.value = withDelay(
      staggerDelay,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );

    // Arc fill
    arcProgress.value = withDelay(
      staggerDelay,
      withTiming(target, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Bar fill
    barWidth.value = withDelay(
      staggerDelay,
      withTiming(target, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Fatigued pulse
    if (isFatigued) {
      pulseOpacity.value = withRepeat(
        withTiming(0.6, { duration: 1200, easing: Easing.linear }),
        -1,
        true,
      );
    }

    return () => {
      cancelAnimation(arcProgress);
      cancelAnimation(barWidth);
      cancelAnimation(rowOpacity);
      cancelAnimation(rowTranslateY);
      cancelAnimation(pulseOpacity);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Chevron rotation on expand/collapse
  useEffect(() => {
    chevronRotation.value = withTiming(isExpanded ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── animated styles ── */
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateY: rowTranslateY.value }],
  }));

  const barAnimatedStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
    backgroundColor: dotColor,
  }));

  const redRgb = hexToRgb(colors.accentRed);

  const pulseAnimatedStyle = useAnimatedStyle(() => {
    if (!isFatigued) return {};
    return {
      borderWidth: 1,
      borderColor: `rgba(${redRgb}, ${pulseOpacity.value * 0.5})`,
      backgroundColor: `rgba(${redRgb}, ${pulseOpacity.value * 0.06})`,
    };
  });

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

  const arcAnimatedProps = useAnimatedProps(() => ({
    strokeDasharray: [arcProgress.value * ARC_C, ARC_C] as [number, number],
  }));

  return (
    <Animated.View style={[styles.row, rowAnimatedStyle, isFatigued && pulseAnimatedStyle]}>
      <Pressable onPress={onToggle} style={styles.rowPressable}>
        {/* Arc + content row */}
        <View style={styles.rowInner}>
          {/* Animated arc */}
          <View style={{ width: ARC_SIZE, height: ARC_SIZE }}>
            <Svg width={ARC_SIZE} height={ARC_SIZE}>
              <Circle
                cx={ARC_SIZE / 2}
                cy={ARC_SIZE / 2}
                r={ARC_R}
                stroke={colors.surface}
                strokeWidth={ARC_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={ARC_SIZE / 2}
                cy={ARC_SIZE / 2}
                r={ARC_R}
                stroke={dotColor}
                strokeWidth={ARC_STROKE}
                fill="none"
                strokeLinecap="round"
                animatedProps={arcAnimatedProps}
                rotation={-90}
                origin={`${ARC_SIZE / 2}, ${ARC_SIZE / 2}`}
              />
            </Svg>
            <View style={arcLabelStyle}>
              <Text style={[arcValueStyle, { color: dotColor }]}>
                {Math.round(item.recoveryPercent)}
              </Text>
            </View>
          </View>

          {/* Right content */}
          <View style={styles.rowContent}>
            <View style={styles.rowTop}>
              <Text style={styles.muscleName}>
                {GROUP_LABELS[item.group]}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sw(8) }}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: dotColor + '1A' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: dotColor }]}>
                    {status}
                  </Text>
                </View>
                <Animated.View style={chevronAnimatedStyle}>
                  <Ionicons
                    name="chevron-down"
                    size={ms(14)}
                    color={colors.textTertiary}
                  />
                </Animated.View>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, barAnimatedStyle]} />
            </View>

            {/* Info row: session count, last trained, flags */}
            <View style={styles.infoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sw(8) }}>
                <View style={styles.sessionBadge}>
                  <Text style={styles.sessionBadgeText}>
                    {item.sessionCount}x
                  </Text>
                </View>
                {item.lastTrainedAt && (
                  <Text style={styles.lastTrained}>
                    {formatRelativeTime(item.lastTrainedAt)}
                  </Text>
                )}
              </View>
              {(item.overtrained || item.undertrained) && (
                <View style={styles.flagRow}>
                  {item.overtrained && (
                    <>
                      <Ionicons
                        name="warning"
                        size={ms(12)}
                        color={colors.accentOrange}
                      />
                      <Text
                        style={[
                          styles.flagText,
                          { color: colors.accentOrange },
                        ]}
                      >
                        Overtrained
                      </Text>
                    </>
                  )}
                  {item.undertrained && (
                    <>
                      <Ionicons
                        name="information-circle"
                        size={ms(12)}
                        color={colors.accentBlue}
                      />
                      <Text
                        style={[
                          styles.flagText,
                          { color: colors.accentBlue },
                        ]}
                      >
                        Undertrained
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Remaining time */}
            {item.recoveryRemaining > 0 && (
              <Text style={styles.remaining}>
                {formatHours(item.recoveryRemaining)} remaining
              </Text>
            )}
          </View>
        </View>

        {/* Expanded exercise list */}
        {isExpanded && item.exercises.length > 0 && (
          <View style={styles.exerciseList}>
            {item.exercises.map((ex, i) => (
              <View key={`${ex.name}-${i}`} style={styles.exerciseRow}>
                <View
                  style={[
                    styles.exerciseDot,
                    {
                      backgroundColor: ex.isPrimary
                        ? colors.accent
                        : colors.textTertiary,
                    },
                  ]}
                />
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {ex.name}
                </Text>
                <Text style={styles.exerciseSets}>
                  {formatSetsSummary(ex.sets)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ────────────────────────── hex→rgb util ────────────────────────── */

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/* ────────────────────────── arc label styles ────────────────────────── */

const arcLabelStyle: any = {
  ...StyleSheet.absoluteFillObject,
  alignItems: 'center',
  justifyContent: 'center',
};
const arcValueStyle: any = {
  fontSize: ms(10),
  lineHeight: ms(14),
  fontFamily: Fonts.bold,
};

/* ────────────────────────── main component ────────────────────────── */

export default function RecoveryTimersCard({ analysis }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedGroup, setExpandedGroup] = useState<MuscleGroup | null>(null);

  const trainedGroups = useMemo(() => {
    if (!analysis) return [];
    return Object.entries(analysis.groups)
      .filter(([_, data]) => data.lastTrainedAt !== null)
      .sort(([, a], [, b]) => a.recoveryPercent - b.recoveryPercent)
      .map(([group, data]) => ({
        group: group as MuscleGroup,
        ...data,
      }));
  }, [analysis]);

  const readyCount = useMemo(
    () => trainedGroups.filter((g) => g.recoveryPercent >= 90).length,
    [trainedGroups],
  );

  const handleToggle = useCallback(
    (group: MuscleGroup) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedGroup((prev) => (prev === group ? null : group));
    },
    [],
  );

  if (trainedGroups.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.accentDot} />
          <Text style={styles.title}>Recovery Status</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No recovery data yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <View style={styles.accentDot} />
          <Text style={styles.title}>Recovery Status</Text>
        </View>
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>
            {readyCount}/{trainedGroups.length} ready
          </Text>
        </View>
      </View>

      {/* Muscle rows */}
      <View style={styles.rows}>
        {trainedGroups.map((item, index) => (
          <RecoveryRow
            key={item.group}
            item={item}
            animateIndex={index}
            isExpanded={expandedGroup === item.group}
            onToggle={() => handleToggle(item.group)}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

/* ────────────────────────── styles ────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(18),
      ...colors.cardShadow,
    },

    /* Header */
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: sw(16),
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
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
    },
    readyBadge: {
      backgroundColor: colors.accentGreen + '1A',
      borderRadius: sw(8),
      paddingHorizontal: sw(10),
      paddingVertical: sw(4),
    },
    readyText: {
      color: colors.accentGreen,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
    },

    /* Rows */
    rows: {
      gap: sw(12),
    },
    row: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      overflow: 'hidden',
    },
    rowPressable: {
      padding: sw(12),
    },
    rowInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
    },
    rowContent: {
      flex: 1,
      gap: sw(6),
    },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    muscleName: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    statusPill: {
      borderRadius: sw(6),
      paddingHorizontal: sw(8),
      paddingVertical: sw(2),
    },
    statusText: {
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
    },

    /* Bar */
    barTrack: {
      height: sw(4),
      backgroundColor: colors.cardBorder,
      borderRadius: sw(2),
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: sw(2),
    },

    /* Info row */
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sessionBadge: {
      backgroundColor: colors.accent + '15',
      borderRadius: sw(6),
      paddingHorizontal: sw(6),
      paddingVertical: sw(1),
    },
    sessionBadgeText: {
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
      color: colors.accent,
    },
    lastTrained: {
      fontSize: ms(10),
      color: colors.textTertiary,
      fontFamily: Fonts.medium,
    },
    flagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
    },
    flagText: {
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
    },

    /* Remaining time */
    remaining: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },

    /* Exercise list (expanded) */
    exerciseList: {
      gap: sw(6),
      paddingTop: sw(8),
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      marginTop: sw(8),
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    exerciseDot: {
      width: sw(5),
      height: sw(5),
      borderRadius: sw(3),
    },
    exerciseName: {
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
      color: colors.textPrimary,
      flex: 1,
    },
    exerciseSets: {
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      color: colors.textSecondary,
    },

    /* Empty */
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      paddingVertical: sw(28),
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },
  });
