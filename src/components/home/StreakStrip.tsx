import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useStreakStore } from '../../stores/useStreakStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getLeaderboard } from '../../lib/friendsDatabase';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Outer + inner flame colors per tier. Inner sits as a hot core in the belly.
 * Returns [outer, inner | null]. Null inner means single-color (dead state).
 */
function streakFlameColors(streak: number, c: ThemeColors): [string, string | null] {
  if (streak <= 0) return [c.textTertiary, null];
  if (streak < 3) return ['#3B82F6', '#BFDBFE'];   // blue + ice highlight
  if (streak < 7) return ['#F59E0B', '#FDE047'];   // orange + yellow core
  if (streak < 14) return ['#DC2626', '#F59E0B'];  // red + orange core
  if (streak < 30) return ['#B91C1C', '#F97316'];  // deep red + bright orange
  return ['#9F1239', '#FBBF24'];                    // 30+ magma + amber-white core
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// DEV_OVERRIDE: set to a number to preview a streak tier; null = use real data.
const __DEV_STREAK_OVERRIDE__: number | null = 1;

type Cell = {
  inMonth: boolean;
  day: number;
  isToday: boolean;
  isFuture: boolean;
  hasWorkout: boolean;
};

function StreakStrip() {
  const realStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const currentStreak = __DEV_STREAK_OVERRIDE__ ?? realStreak;
  const workouts = useWorkoutStore((s) => s.workouts);
  const userId = useAuthStore((s) => s.user?.id);
  const friendIds = useFriendsStore((s) => s.friendIds);
  const blockedIds = useFriendsStore((s) => s.blockedIds);
  const friendsFetchedAt = useFriendsStore((s) => s.friendsFetchedAt);
  const fetchFriends = useFriendsStore((s) => s.fetchFriends);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build current month grid: leading blanks + days, padded to multiples of 7.
  const monthGrid = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Mon=0, Sun=6
    const dow = (firstDay.getDay() + 6) % 7;

    const workoutKeys = new Set<string>();
    for (const w of workouts) {
      workoutKeys.add(toDateKey(new Date(w.created_at)));
    }
    const todayKey = toDateKey(today);

    const cells: Cell[] = [];
    for (let i = 0; i < dow; i++) {
      cells.push({ inMonth: false, day: 0, isToday: false, isFuture: false, hasWorkout: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = toDateKey(date);
      cells.push({
        inMonth: true,
        day: d,
        isToday: key === todayKey,
        isFuture: key > todayKey,
        hasWorkout: workoutKeys.has(key),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ inMonth: false, day: 0, isToday: false, isFuture: false, hasWorkout: false });
    }
    return cells;
  }, [workouts, today]);

  const monthLabel = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  const monthWorkoutCount = useMemo(
    () => monthGrid.reduce((n, c) => n + (c.inMonth && c.hasWorkout ? 1 : 0), 0),
    [monthGrid],
  );
  const daysInMonth = useMemo(
    () => monthGrid.reduce((n, c) => n + (c.inMonth ? 1 : 0), 0),
    [monthGrid],
  );
  const bestStreak = Math.max(longestStreak, currentStreak);
  const [bestFlameColor] = streakFlameColors(bestStreak, colors);
  const isPR = currentStreak > 0 && currentStreak >= longestStreak;

  // Streak at risk = currently on a streak, but no workout logged today.
  const hasWorkoutToday = useMemo(
    () => monthGrid.some((c) => c.isToday && c.hasWorkout),
    [monthGrid],
  );
  const streakAtRisk = currentStreak > 0 && !hasWorkoutToday;

  // Trigger friends fetch on mount if it hasn't happened yet (Home doesn't
  // fetch friends — that only happens when the Community tab opens).
  useEffect(() => {
    if (userId && !friendsFetchedAt) {
      fetchFriends(userId);
    }
  }, [userId, friendsFetchedAt, fetchFriends]);

  // Friends streak rank — isolated fetch (don't touch shared leaderboard state).
  // Compute rank by comparing friends' leaderboard values against the user's
  // *live* currentStreak — works even if no leaderboard row exists for self.
  type RankState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ranked'; rank: number; total: number };
  const [rankState, setRankState] = useState<RankState>({ kind: 'loading' });
  useEffect(() => {
    if (!userId || friendIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const entries = await getLeaderboard('streak', 'friends', friendIds, userId, blockedIds);
        if (cancelled) return;
        const friendsOnly = entries.filter((e) => e.user_id !== userId);
        if (friendsOnly.length === 0) {
          setRankState({ kind: 'unavailable' });
          return;
        }
        const higher = friendsOnly.filter((e) => e.value > currentStreak).length;
        const total = friendsOnly.length + 1;
        setRankState({ kind: 'ranked', rank: higher + 1, total });
      } catch {
        if (!cancelled) setRankState({ kind: 'unavailable' });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, friendIds, blockedIds, currentStreak]);

  // Live countdown to midnight — re-renders every minute.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!streakAtRisk) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [streakAtRisk]);

  const resetLabel = useMemo(() => {
    if (!streakAtRisk) return '';
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const ms = midnight.getTime() - now.getTime();
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `Resets in ${hours}h`;
    if (minutes > 0) return `Resets in ${minutes}m`;
    return 'Resetting now';
    // tick is intentionally read so this recomputes each tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streakAtRisk, tick]);

  const streakLabel = `${currentStreak}`;
  const streakUnit = currentStreak === 1 ? 'Day' : 'Days';
  const [outerColor, innerColor] = streakFlameColors(currentStreak, colors);
  const isLive = currentStreak > 0;

  // Live flame: 0..1 driver looped via reverse (no withSequence seam).
  // Both opacity and a subtle scale derive from this single driver — keeps it
  // running on the UI thread, GPU-composited.
  const driver = useSharedValue(0);

  useEffect(() => {
    if (!isLive) {
      driver.value = 0;
      return;
    }
    driver.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [isLive]);

  const opacity = useDerivedValue(() => 1 - driver.value * 0.3);
  const scale = useDerivedValue(() => 1 - driver.value * 0.05);

  const flameAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Training Streak</Text>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
      </View>

      <View style={styles.heroRow}>
        <View style={styles.streakBadge}>
          <View style={styles.flameWrap}>
            <Animated.View style={[styles.flameAnim, flameAnimStyle]}>
              <Ionicons name="flame" size={ms(60)} color={outerColor} />
              {innerColor && (
                <View style={styles.innerFlameWrap} pointerEvents="none">
                  <Ionicons name="flame" size={ms(32)} color={innerColor} />
                </View>
              )}
            </Animated.View>
          </View>
          <Text style={styles.streakNumber}>{streakLabel}</Text>
          <Text style={styles.streakUnit}>{streakUnit}</Text>
          {isPR && (
            <View style={[styles.prPill, { backgroundColor: colors.accent + '22' }]}>
              <Ionicons name="trophy" size={ms(9)} color={colors.accent} />
              <Text style={[styles.prText, { color: colors.accent }]}>NEW BEST</Text>
            </View>
          )}
        </View>

        <View style={styles.monthCol}>
          <View style={styles.dayLabelRow}>
            {DAY_LABELS.map((l, i) => (
              <Text key={i} style={styles.dayLabel}>{l}</Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {monthGrid.map((cell, i) => (
              <View key={i} style={styles.cellSlot}>
                {cell.inMonth ? (
                  <View
                    style={[
                      styles.dayDot,
                      cell.hasWorkout && { backgroundColor: outerColor },
                      cell.isToday && styles.dayDotToday,
                      cell.isFuture && !cell.isToday && styles.dayDotFuture,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        cell.hasWorkout && styles.dayNumComplete,
                        cell.isToday && styles.dayNumToday,
                        cell.isFuture && !cell.isToday && styles.dayNumFuture,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>All-Time Best</Text>
          <View style={styles.footerValueRow}>
            <Ionicons name="flame" size={ms(14)} color={bestFlameColor} />
            <Text style={styles.footerValue}>{bestStreak} days</Text>
          </View>
        </View>
        <View style={styles.footerItem}>
          <Text style={styles.footerLabel}>Trained</Text>
          <Text style={styles.footerValue}>{monthWorkoutCount} of {daysInMonth} days</Text>
        </View>
        {friendIds.length === 0 ? (
          <View style={[styles.footerItem, styles.footerItemRight]}>
            <Text style={styles.footerLabel}>Friends</Text>
            <Text style={styles.footerValue}>None 🥲</Text>
          </View>
        ) : rankState.kind === 'ranked' ? (
          <View style={[styles.footerItem, styles.footerItemRight]}>
            <Text style={styles.footerLabel}>Friends Rank</Text>
            <Text style={styles.footerValue}>#{rankState.rank} of {rankState.total}</Text>
          </View>
        ) : rankState.kind === 'unavailable' ? (
          <View style={[styles.footerItem, styles.footerItemRight]}>
            <Text style={styles.footerLabel}>Friends Rank</Text>
            <Text style={styles.footerValue}>Unavailable</Text>
          </View>
        ) : null}
      </View>

    </View>
  );
}

export default React.memo(StreakStrip);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(14),
    gap: sw(4),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: sw(14),
  },
  streakBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: sw(72),
    gap: sw(1),
  },
  flameWrap: {
    width: ms(60),
    height: ms(60),
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameAnim: {
    width: ms(60),
    height: ms(60),
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerFlameWrap: {
    position: 'absolute',
    bottom: ms(6),
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  streakNumber: {
    color: colors.textPrimary,
    fontFamily: Fonts.extraBold,
    fontSize: ms(18),
    lineHeight: ms(20),
    letterSpacing: -0.4,
  },
  streakUnit: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
  },
  monthCol: {
    flex: 1,
    gap: sw(4),
  },
  dayLabelRow: {
    flexDirection: 'row',
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.bold,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginTop: sw(6),
    marginBottom: sw(6),
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    gap: sw(2),
  },
  footerItemRight: {
    alignItems: 'flex-end',
  },
  footerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  footerLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  footerValue: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.bold,
  },
  prPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    marginTop: sw(4),
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: sw(6),
  },
  prText: {
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    marginTop: sw(4),
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: sw(6),
    backgroundColor: colors.surface,
  },
  warningText: {
    color: colors.textSecondary,
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cellSlot: {
    width: '14.2857%', // 1/7
    height: sw(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: {
    width: sw(26),
    height: sw(26),
    borderRadius: sw(13),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dayDotFuture: {
    opacity: 0.4,
  },
  dayNum: {
    color: colors.textSecondary,
    fontSize: ms(10),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
  },
  dayNumComplete: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
  },
  dayNumToday: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  dayNumFuture: {
    color: colors.textTertiary,
  },
});
