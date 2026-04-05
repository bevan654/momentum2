import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useChatStore } from '../../stores/useChatStore';
import { getFriendStats, getFriendshipBetween } from '../../lib/friendsDatabase';
import { globalNavigate } from '../../navigation/navigationRef';
import BottomSheet from '../workout-sheet/BottomSheet';
import AvatarCircle from './AvatarCircle';
import { useNetworkStore } from '../../stores/useNetworkStore';

export default function FriendProfileModal() {
  const friend = useFriendsStore((s) => s.profileSheetFriend);
  const visible = useFriendsStore((s) => s.profileSheetVisible);
  const hideProfileSheet = useFriendsStore((s) => s.hideProfileSheet);
  const userId = useAuthStore((s) => s.user?.id);
  const removeFriend = useFriendsStore((s) => s.removeFriend);
  const isOffline = useNetworkStore((s) => s.isOffline);
  const [stats, setStats] = useState<{ workoutCount: number; totalVolume: number; streak: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!friend || !visible) return;
    setLoading(true);
    setStats(null);
    (async () => {
      try {
        const data = await getFriendStats(friend.id);
        setStats(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [friend?.id, visible]);

  if (!friend) return null;

  const handleMessage = async () => {
    if (!userId) return;
    try {
      const conversationId = await useChatStore.getState().getOrCreateConversation(userId, friend.id);
      hideProfileSheet();
      // Small delay to let sheet close animation start
      setTimeout(() => {
        globalNavigate('Chat', {
          conversationId,
          friendId: friend.id,
          friendName: friend.username || friend.email,
        });
      }, 200);
    } catch {
      // Swallow
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.username || friend.email} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            const friendship = await getFriendshipBetween(userId, friend.id);
            if (friendship) {
              await removeFriend(friendship.id, userId);
            }
            hideProfileSheet();
          },
        },
      ],
    );
  };

  return (
    <BottomSheet visible={visible} onClose={hideProfileSheet} height="65%">
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <AvatarCircle
            username={friend.username}
            email={friend.email}
            size={sw(80)}
          />
        </View>

        <Text style={styles.name}>{friend.username || friend.email}</Text>
        {friend.username && (
          <Text style={styles.email}>{friend.email}</Text>
        )}
      </View>

      {/* Stats */}
      {isOffline ? (
        <View style={styles.offlineHint}>
          <Ionicons name="cloud-offline-outline" size={ms(20)} color={colors.textTertiary} />
          <Text style={styles.offlineHintText}>Stats unavailable offline</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : stats ? (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.workoutCount}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatVolume(stats.totalVolume)}</Text>
            <Text style={styles.statLabel}>Volume (kg)</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {isOffline ? (
          <>
            <View style={[styles.messageBtn, { opacity: 0.4 }]}>
              <Ionicons name="cloud-offline-outline" size={ms(16)} color={colors.textTertiary} />
              <Text style={[styles.messageBtnText, { color: colors.textTertiary }]}>Message</Text>
            </View>
            <View style={[styles.removeBtn, { opacity: 0.4 }]}>
              <Ionicons name="cloud-offline-outline" size={ms(16)} color={colors.textTertiary} />
              <Text style={[styles.removeBtnText, { color: colors.textTertiary }]}>Remove Friend</Text>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={handleMessage}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={ms(16)} color={colors.accent} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={handleRemove}
              activeOpacity={0.7}
            >
              <Ionicons name="person-remove-outline" size={ms(16)} color={colors.accentRed} />
              <Text style={styles.removeBtnText}>Remove Friend</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 10000) return `${(vol / 1000).toFixed(1)}k`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(vol);
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: sw(16),
    paddingVertical: sw(16),
    gap: sw(4),
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: sw(12),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(20),
    fontFamily: Fonts.bold,
    lineHeight: ms(25),
    letterSpacing: -0.3,
  },
  email: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
    marginTop: sw(2),
  },
  loader: {
    marginVertical: sw(20),
  },
  offlineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
    paddingVertical: sw(20),
    marginHorizontal: sw(16),
  },
  offlineHintText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: sw(14),
    paddingVertical: sw(18),
    marginHorizontal: sw(16),
    marginBottom: sw(20),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(6),
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(20),
    fontFamily: Fonts.bold,
    lineHeight: ms(25),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
  },
  actions: {
    marginTop: sw(12),
    alignItems: 'center',
    gap: sw(10),
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    backgroundColor: colors.accent + '15',
    borderRadius: sw(12),
    paddingHorizontal: sw(24),
    paddingVertical: sw(12),
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  messageBtnText: {
    color: colors.accent,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    backgroundColor: colors.accentRed + '10',
    borderRadius: sw(12),
    paddingHorizontal: sw(24),
    paddingVertical: sw(12),
    borderWidth: 1,
    borderColor: colors.accentRed + '25',
  },
  removeBtnText: {
    color: colors.accentRed,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
});
