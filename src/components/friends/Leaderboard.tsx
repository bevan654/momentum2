import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { LeaderboardEntry } from '../../lib/friendsDatabase';
import LeaderboardRow from './LeaderboardRow';

const ORANGE = '#F59E0B';
const RED = '#EF4444';

const BOARD_TYPES = [
  { key: 'volume' as const, label: 'Strength Ratio', icon: 'barbell-outline', color: ORANGE },
  { key: 'streak' as const, label: 'Workout Streak', icon: 'flame-outline', color: RED },
];

export default function Leaderboard() {
  const userId = useAuthStore((s) => s.user?.id);
  const leaderboard = useFriendsStore((s) => s.leaderboard);
  const leaderboardLoading = useFriendsStore((s) => s.leaderboardLoading);
  const leaderboardType = useFriendsStore((s) => s.leaderboardType);
  const leaderboardScope = useFriendsStore((s) => s.leaderboardScope);
  const fetchLeaderboard = useFriendsStore((s) => s.fetchLeaderboard);
  const setLeaderboardType = useFriendsStore((s) => s.setLeaderboardType);
  const setLeaderboardScope = useFriendsStore((s) => s.setLeaderboardScope);
  const fetchFriends = useFriendsStore((s) => s.fetchFriends);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) {
      fetchFriends(userId).then(() => fetchLeaderboard(userId));
    }
  }, [userId, leaderboardType, leaderboardScope]);

  const activeBoard = BOARD_TYPES.find((b) => b.key === leaderboardType) || BOARD_TYPES[0];
  const valueLabel = leaderboardType === 'volume' ? 'kg' : 'days';

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow
        entry={item}
        isCurrentUser={item.user_id === userId}
        accentColor={activeBoard.color}
        valueLabel={valueLabel}
      />
    ),
    [userId, activeBoard.color, valueLabel],
  );

  return (
    <View style={styles.container}>
      {/* Type toggle */}
      <View style={styles.toggleRow}>
        {BOARD_TYPES.map((board) => {
          const active = leaderboardType === board.key;
          return (
            <TouchableOpacity
              key={board.key}
              style={[
                styles.typeBtn,
                active && { backgroundColor: board.color },
              ]}
              onPress={() => setLeaderboardType(board.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={board.icon as any}
                size={ms(14)}
                color={active ? colors.textOnAccent : colors.textSecondary}
              />
              <Text style={[styles.typeText, active && styles.typeTextActive]}>
                {board.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scope toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.scopeBtn, leaderboardScope === 'friends' && styles.scopeActive]}
          onPress={() => setLeaderboardScope('friends')}
          activeOpacity={0.7}
        >
          <Text style={[styles.scopeText, leaderboardScope === 'friends' && styles.scopeTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeBtn, leaderboardScope === 'global' && styles.scopeActive]}
          onPress={() => setLeaderboardScope('global')}
          activeOpacity={0.7}
        >
          <Text style={[styles.scopeText, leaderboardScope === 'global' && styles.scopeTextActive]}>
            Global
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {leaderboardLoading && leaderboard.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={ms(36)} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No leaderboard data yet</Text>
        </View>
      ) : (
        <FlashList
          data={leaderboard}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={sw(56)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: sw(12),
    paddingVertical: sw(6),
    gap: sw(8),
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    backgroundColor: colors.card,
    borderRadius: sw(20),
    paddingHorizontal: sw(14),
    paddingVertical: sw(8),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  typeText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
  },
  typeTextActive: {
    color: colors.textOnAccent,
    fontFamily: Fonts.bold,
  },
  scopeBtn: {
    backgroundColor: colors.card,
    borderRadius: sw(20),
    paddingHorizontal: sw(16),
    paddingVertical: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scopeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scopeText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
  },
  scopeTextActive: {
    color: colors.textOnAccent,
    fontFamily: Fonts.bold,
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
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
  },
});
