import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import type { LeaderboardType } from '../../lib/friendsDatabase';
import LeaderboardRow from './LeaderboardRow';
import LeaderboardInfoModal from './LeaderboardInfoModal';

interface Props {
  headerComponent?: React.ReactNode;
}

function Leaderboard({ headerComponent }: Props) {
  const [infoVisible, setInfoVisible] = useState(false);
  const listRef = useRef<ScrollView>(null);
  const pendingAutoScrollIndex = useRef<number | null>(null);
  const lastAutoScrollKey = useRef<string | null>(null);
  const userId = useAuthStore((s) => s.user?.id);
  const leaderboard = useFriendsStore((s) => s.leaderboard);
  const leaderboardLoading = useFriendsStore((s) => s.leaderboardLoading);
  const leaderboardType = useFriendsStore((s) => s.leaderboardType);
  const leaderboardScope = useFriendsStore((s) => s.leaderboardScope);
  const fetchLeaderboard = useFriendsStore((s) => s.fetchLeaderboard);
  const setLeaderboardType = useFriendsStore((s) => s.setLeaderboardType);
  const setLeaderboardScope = useFriendsStore((s) => s.setLeaderboardScope);
  const fetchFriends = useFriendsStore((s) => s.fetchFriends);
  const fetchBlockedIds = useFriendsStore((s) => s.fetchBlockedIds);
  const settingsInitialized = useProfileSettingsStore((s) => s.initialized);
  const hasSeenLeaderboardInfo = useProfileSettingsStore((s) => s.hasSeenLeaderboardInfo);
  const setHasSeenLeaderboardInfo = useProfileSettingsStore((s) => s.setHasSeenLeaderboardInfo);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const boardTypes = useMemo(() => [
    {
      key: 'strength' as const,
      label: 'Strength Ratio',
      icon: 'barbell-outline' as const,
      color: colors.accent,
    },
    {
      key: 'streak' as const,
      label: 'Workout Streak',
      icon: 'flame-outline' as const,
      color: colors.accentRed,
    },
  ], [colors.accent, colors.accentRed]);
  const liftTypes = useMemo(() => [
    { key: 'strength' as const, label: 'Total' },
    { key: 'bench' as const, label: 'Bench' },
    { key: 'squat' as const, label: 'Squat' },
    { key: 'deadlift' as const, label: 'Deadlift' },
  ], []);
  const streakTypes = useMemo(() => [
    { key: 'streak' as const, label: 'Current' },
    { key: 'streak_best' as const, label: 'All-Time Best' },
  ], []);

  useEffect(() => {
    if (!settingsInitialized) useProfileSettingsStore.getState().loadSettings();
  }, [settingsInitialized]);

  useEffect(() => {
    if (settingsInitialized && !hasSeenLeaderboardInfo) setInfoVisible(true);
  }, [settingsInitialized, hasSeenLeaderboardInfo]);

  useEffect(() => {
    if (!userId) return;
    Promise.all([fetchFriends(userId), fetchBlockedIds(userId)])
      .then(() => fetchLeaderboard(userId));
  }, [
    userId,
    leaderboardType,
    leaderboardScope,
    fetchFriends,
    fetchBlockedIds,
    fetchLeaderboard,
  ]);

  const isStreakBoard = leaderboardType === 'streak' || leaderboardType === 'streak_best';
  const activeBoard = isStreakBoard ? boardTypes[1] : boardTypes[0];
  const valueLabel = isStreakBoard
    ? 'days'
    : leaderboardType === 'strength'
      ? 'avg ratio'
      : '× BW';
  const emptyMessage = leaderboardType === 'strength'
    ? 'Log a Bench Press, Back Squat, or Deadlift to enter the Total board.'
    : 'No leaderboard data yet';
  const currentUserIndex = useMemo(
    () => leaderboard.findIndex((entry) => entry.user_id === userId),
    [leaderboard, userId],
  );

  useEffect(() => {
    if (leaderboardLoading || leaderboard.length === 0) return;
    const key = `${leaderboardScope}:${leaderboardType}`;
    if (lastAutoScrollKey.current === key) return;
    lastAutoScrollKey.current = key;
    pendingAutoScrollIndex.current = currentUserIndex > 2 ? currentUserIndex : null;
  }, [
    currentUserIndex,
    leaderboard.length,
    leaderboardLoading,
    leaderboardScope,
    leaderboardType,
  ]);

  const handleRefresh = useCallback(() => {
    if (userId) fetchLeaderboard(userId, true);
  }, [userId, fetchLeaderboard]);

  const handleCloseInfo = useCallback(() => {
    setInfoVisible(false);
    if (!hasSeenLeaderboardInfo) setHasSeenLeaderboardInfo(true);
  }, [hasSeenLeaderboardInfo, setHasSeenLeaderboardInfo]);

  const handleContentSizeChange = useCallback(() => {
    const index = pendingAutoScrollIndex.current;
    if (index === null) return;
    pendingAutoScrollIndex.current = null;
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        y: Math.max(0, index * sw(62) - sw(124)),
        animated: true,
      });
    });
  }, []);

  return (
    <View style={styles.container}>
      {headerComponent}

      {/* Type toggle */}
      <View style={styles.metricSwitcher}>
        {boardTypes.map((board) => {
          const active = board.key === 'streak'
            ? isStreakBoard
            : !isStreakBoard;
          return (
            <TouchableOpacity
              key={board.key}
              style={[styles.metricBtn, active && styles.metricBtnActive]}
              onPress={() => setLeaderboardType(board.key)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={board.icon}
                size={ms(16)}
                color={active ? colors.accent : colors.textTertiary}
              />
              <Text style={[styles.metricText, active && styles.metricTextActive]}>
                {board.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={() => setInfoVisible(true)}
          activeOpacity={0.7}
          accessibilityLabel="How leaderboard rankings are calculated"
        >
          <Ionicons
            name="information-circle-outline"
            size={ms(18)}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {!isStreakBoard && (
        <View style={styles.liftSwitcher}>
          {liftTypes.map((lift) => {
            const active = leaderboardType === lift.key;
            return (
              <TouchableOpacity
                key={lift.key}
                style={[styles.liftBtn, active && styles.liftBtnActive]}
                onPress={() => setLeaderboardType(lift.key as LeaderboardType)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.liftText, active && styles.liftTextActive]}>
                  {lift.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isStreakBoard && (
        <View style={styles.liftSwitcher}>
          {streakTypes.map((streakType) => {
            const active = leaderboardType === streakType.key;
            return (
              <TouchableOpacity
                key={streakType.key}
                style={[styles.liftBtn, active && styles.liftBtnActive]}
                onPress={() => setLeaderboardType(streakType.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.liftText, active && styles.liftTextActive]}>
                  {streakType.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Scope toggle */}
      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={styles.scopeBtn}
          onPress={() => setLeaderboardScope(
            leaderboardScope === 'friends' ? 'global' : 'friends',
          )}
          activeOpacity={0.7}
          accessibilityLabel={`Leaderboard showing ${leaderboardScope}. Tap to switch.`}
        >
          <Text style={styles.scopeText}>
            {leaderboardScope === 'friends' ? 'Friends' : 'Global'}
          </Text>
          <Ionicons name="swap-horizontal" size={ms(11)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {leaderboardLoading && leaderboard.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : leaderboard.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={(
            <RefreshControl
              refreshing={leaderboardLoading}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          )}
        >
          <View style={styles.center}>
            <Ionicons name="trophy-outline" size={ms(36)} color={colors.textTertiary} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          ref={listRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={handleContentSizeChange}
          refreshControl={(
            <RefreshControl
              refreshing={leaderboardLoading}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          )}
        >
          {leaderboard.map((entry) => (
            <LeaderboardRow
              key={`${entry.type}:${entry.user_id}`}
              entry={entry}
              isCurrentUser={entry.user_id === userId}
              accentColor={activeBoard.color}
              valueLabel={valueLabel}
            />
          ))}
        </ScrollView>
      )}

      <LeaderboardInfoModal visible={infoVisible} onClose={handleCloseInfo} />
    </View>
  );
}

export default React.memo(Leaderboard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  metricSwitcher: {
    flexDirection: 'row',
    marginHorizontal: sw(12),
    marginTop: sw(6),
    marginBottom: sw(4),
    padding: sw(3),
    gap: sw(3),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(12),
  },
  metricBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(7),
    paddingVertical: sw(9),
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: sw(9),
  },
  metricBtnActive: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  metricText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(17),
  },
  metricTextActive: {
    color: colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  liftSwitcher: {
    flexDirection: 'row',
    marginHorizontal: sw(12),
    marginBottom: sw(4),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  liftBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(7),
    borderBottomWidth: sw(1.5),
    borderBottomColor: 'transparent',
  },
  liftBtnActive: {
    borderBottomColor: colors.accent,
  },
  liftText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },
  liftTextActive: {
    color: colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  scopeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    paddingVertical: sw(4),
  },
  scopeText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: sw(14),
    paddingTop: sw(1),
    paddingBottom: sw(5),
  },
  infoBtn: {
    width: sw(36),
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sw(9),
  },
  listContent: {
    paddingTop: sw(4),
    paddingBottom: sw(20),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(10),
  },
  emptyScroll: {
    flexGrow: 1,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
  },
});
