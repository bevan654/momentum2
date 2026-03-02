import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useRankStore } from '../../stores/useRankStore';
import { getRankColor } from './RankBadge';

export default function RankCard() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const rank = useRankStore((s) => s.rank);
  const overallScore = useRankStore((s) => s.overallScore);
  const isProvisional = useRankStore((s) => s.isProvisional);
  const loading = useRankStore((s) => s.loading);

  const rankColor = getRankColor(rank.name);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Two-phase animation: fast jump to ~85%, then slow ease to final
    // Creates anticipation as the bar decelerates near the target
    progress.value = withSequence(
      withTiming(rank.progress * 0.85, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(rank.progress, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [rank.progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(progress.value * 100, 100)}%` as any,
  }));

  const nextRank = rank.maxScore === Infinity ? null : rank.maxScore;
  const remaining = nextRank !== null ? Math.round((nextRank - overallScore) * 10) / 10 : 0;

  if (loading && overallScore === 0) return null;

  return (
    <View style={styles.card}>
      {/* Top row: shield + rank name + score */}
      <View style={styles.topRow}>
        <View style={styles.rankRow}>
          <Ionicons name="shield" size={ms(18)} color={rankColor} />
          <Text style={[styles.rankName, { color: rankColor }]}>{rank.name}</Text>
          {isProvisional && (
            <View style={styles.provisionalBadge}>
              <Text style={styles.provisionalText}>Provisional</Text>
            </View>
          )}
        </View>
        <Text style={styles.score}>{overallScore.toFixed(1)} <Text style={styles.scoreLabel}>RR</Text></Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: rankColor }, barStyle]} />
      </View>

      {/* Subtitle */}
      {nextRank !== null ? (
        <Text style={styles.subtitle}>
          {remaining} RR to {rank.name === 'Legend' ? 'max' : getNextRankName(rank.name)}
        </Text>
      ) : (
        <Text style={styles.subtitle}>Maximum rank achieved</Text>
      )}
    </View>
  );
}

function getNextRankName(current: string): string {
  const order = ['Novice', 'Apprentice', 'Intermediate', 'Advanced', 'Elite', 'Master', 'Grandmaster', 'Titan', 'Mythic', 'Legend'];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : 'Legend';
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(16),
    marginBottom: sw(12),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(10),
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  rankName: {
    fontSize: ms(16),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  provisionalBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: sw(6),
  },
  provisionalText: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },
  score: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  scoreLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  barTrack: {
    height: sw(6),
    backgroundColor: colors.surface,
    borderRadius: sw(3),
    overflow: 'hidden',
    marginBottom: sw(8),
  },
  barFill: {
    height: '100%',
    borderRadius: sw(3),
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },
});
