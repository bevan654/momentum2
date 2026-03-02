import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { getRankColor } from '../workouts/RankBadge';
import { useRankStore } from '../../stores/useRankStore';
import type { WorkoutRankResult, ExerciseScoreEntry } from '../../utils/strengthScore';

/* ═══════════════════════════════════════════════════════
   Timing constants (exported so the modal can compute delays)
   ═══════════════════════════════════════════════════════ */

export const RANK_INITIAL_DELAY = 200;
export const RANK_ROW_STAGGER = 300;

const BAR_DURATION = 400;
const FADE_DURATION = 200;
const BADGE_SPRING = { damping: 14, stiffness: 200 };
const OVERALL_DELAY_AFTER_LAST = 300;
const OVERALL_SPRING = { damping: 16, stiffness: 180 };

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function clamp(val: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(val, min), max);
}

/* ═══════════════════════════════════════════════════════
   AnimatedRankBar — bar fill + badge pop (used inside exercise card)
   ═══════════════════════════════════════════════════════ */

interface RankBarProps {
  entry: ExerciseScoreEntry;
  animateIndex: number;
  colors: ThemeColors;
}

export function AnimatedRankBar({ entry, animateIndex, colors }: RankBarProps) {
  const rankColor = getRankColor(entry.rank.name);
  const fillRatio = clamp(entry.score / 2.0, 0.05, 1.0);

  const delay = RANK_INITIAL_DELAY + animateIndex * RANK_ROW_STAGGER;

  const barWidth = useSharedValue(0);
  const badgeScale = useSharedValue(0);

  useEffect(() => {
    // Bar fill
    const barDelay = delay + FADE_DURATION * 0.5;
    barWidth.value = withDelay(
      barDelay,
      withTiming(fillRatio, {
        duration: BAR_DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Badge pops after bar fill
    const badgeDelay = barDelay + BAR_DURATION * 0.7;
    badgeScale.value = withDelay(badgeDelay, withSpring(1, BADGE_SPRING));
  }, []);

  const barAnimStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%` as any,
  }));

  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeScale.value,
  }));

  return (
    <View style={barStyles.barRow}>
      <View style={[barStyles.barTrack, { backgroundColor: colors.cardBorder }]}>
        <Animated.View
          style={[barStyles.barFill, { backgroundColor: rankColor }, barAnimStyle]}
        />
      </View>

      <Animated.View style={[barStyles.badgeWrap, badgeAnimStyle]}>
        <View style={[barStyles.badge, { backgroundColor: rankColor + '18' }]}>
          <Ionicons name="shield" size={ms(9)} color={rankColor} />
          <Text style={[barStyles.badgeText, { color: rankColor }]}>
            {entry.rank.name}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginBottom: sw(6),
  },
  barTrack: {
    flex: 1,
    height: sw(8),
    borderRadius: sw(4),
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: sw(4),
  },
  badgeWrap: {
    minWidth: sw(70),
    alignItems: 'flex-end',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: sw(10),
    gap: sw(3),
  },
  badgeText: {
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
  },
});

/* ═══════════════════════════════════════════════════════
   AnimatedCardWrapper — fade-in + slide-up for each exercise card
   ═══════════════════════════════════════════════════════ */

interface CardWrapperProps {
  animateIndex: number;
  children: React.ReactNode;
}

export function AnimatedCardWrapper({ animateIndex, children }: CardWrapperProps) {
  const delay = RANK_INITIAL_DELAY + animateIndex * RANK_ROW_STAGGER;

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: FADE_DURATION }));
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

/* ═══════════════════════════════════════════════════════
   OverallRankReveal — overall rank card with rank-up cycling
   ═══════════════════════════════════════════════════════ */

const RANK_ORDER = [
  'Novice', 'Apprentice', 'Intermediate', 'Advanced', 'Elite',
  'Master', 'Grandmaster', 'Titan', 'Mythic', 'Legend',
] as const;

const RANK_STEP_DURATION = 300;

interface OverallProps {
  exerciseCount: number;
  colors: ThemeColors;
}

export function OverallRankReveal({ exerciseCount, colors }: OverallProps) {
  const overallScore = useRankStore((s) => s.overallScore);
  const currentRank = useRankStore((s) => s.rank);
  const previousRankName = useRankStore((s) => s.previousRankName);

  const fromIdx = Math.max(0, RANK_ORDER.indexOf(previousRankName as any));
  const toIdx = Math.max(0, RANK_ORDER.indexOf(currentRank.name));
  const rankSteps = Math.max(0, toIdx - fromIdx);
  const hasRankUp = rankSteps > 0;

  const lastRowDelay = RANK_INITIAL_DELAY + (exerciseCount - 1) * RANK_ROW_STAGGER;
  const delay = lastRowDelay + RANK_ROW_STAGGER + OVERALL_DELAY_AFTER_LAST;

  const cardScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const shieldScale = useSharedValue(1);

  // State for the currently displayed rank during cycling
  const [displayRank, setDisplayRank] = useState(hasRankUp ? previousRankName : currentRank.name);
  const [displayScore, setDisplayScore] = useState('0.0');
  const [isLanding, setIsLanding] = useState(!hasRankUp);
  const [label, setLabel] = useState('YOUR RANK');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Card entrance
    cardOpacity.value = withDelay(delay, withTiming(1, { duration: 250 }));
    cardScale.value = withDelay(delay, withSpring(1, OVERALL_SPRING));

    if (hasRankUp) {
      // ── Rank-up cycling animation ──────────────────────
      const cycleStart = delay + 300;

      for (let i = 0; i <= rankSteps; i++) {
        const stepTime = cycleStart + i * RANK_STEP_DURATION;
        const rankName = RANK_ORDER[fromIdx + i];
        const isFinal = i === rankSteps;

        timers.push(setTimeout(() => {
          setDisplayRank(rankName);

          if (isFinal) {
            setIsLanding(true);
            setLabel('RANK UP!');
            shieldScale.value = withSpring(1.3, { damping: 8, stiffness: 200 });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            shieldScale.value = withSpring(1.15, { damping: 10, stiffness: 220 });
            timers.push(setTimeout(() => {
              shieldScale.value = withSpring(1, { damping: 12, stiffness: 200 });
            }, 150));
          }
        }, stepTime));
      }

      // Score count-up after rank cycling
      const countStart = cycleStart + rankSteps * RANK_STEP_DURATION + 300;
      const countSteps = 8;
      const countStepDuration = 500 / countSteps;

      for (let i = 0; i <= countSteps; i++) {
        timers.push(setTimeout(() => {
          const val = (overallScore * i) / countSteps;
          setDisplayScore(val.toFixed(1));
          if (i === countSteps) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }, countStart + i * countStepDuration));
      }
    } else {
      // ── No rank change — show current rank + count-up ──
      const countStart = delay + 300;
      const countSteps = 8;
      const countStepDuration = 500 / countSteps;

      timers.push(setTimeout(() => {
        shieldScale.value = withSpring(1.15, { damping: 8, stiffness: 200 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, delay + 200));

      for (let i = 0; i <= countSteps; i++) {
        timers.push(setTimeout(() => {
          const val = (overallScore * i) / countSteps;
          setDisplayScore(val.toFixed(1));
          if (i === countSteps) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }, countStart + i * countStepDuration));
      }
    }

    return () => timers.forEach(clearTimeout);
  }, []);

  const displayColor = getRankColor(displayRank);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const shieldAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shieldScale.value }],
  }));

  return (
    <Animated.View style={[overallStyles.card, { backgroundColor: colors.surface }, cardAnimStyle]}>
      <Text style={[
        overallStyles.label,
        { color: isLanding && hasRankUp ? displayColor : colors.textTertiary },
      ]}>
        {label}
      </Text>
      <View style={overallStyles.row}>
        <Animated.View style={shieldAnimStyle}>
          <Ionicons name="shield" size={ms(24)} color={displayColor} />
        </Animated.View>
        <View style={overallStyles.info}>
          <Text style={[overallStyles.rank, { color: displayColor }]}>
            {displayRank}
          </Text>
          <Text style={[overallStyles.score, { color: colors.textPrimary }]}>
            {displayScore}{' '}
            <Text style={[overallStyles.scoreUnit, { color: colors.textTertiary }]}>RR</Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const overallStyles = StyleSheet.create({
  card: {
    borderRadius: sw(12),
    padding: sw(14),
    alignItems: 'center',
    gap: sw(8),
  },
  label: {
    fontSize: ms(10),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(14),
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  info: {
    alignItems: 'flex-start',
  },
  rank: {
    fontSize: ms(16),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  score: {
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
  },
  scoreUnit: {
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
});
