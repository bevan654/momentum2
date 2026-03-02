import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { NotificationItem } from '../../lib/friendsDatabase';
import { getFriendshipBetween } from '../../lib/friendsDatabase';
import NotificationRow from './NotificationRow';
import { setViewingNotifications } from '../../services/notificationService';

export default function NotificationList() {
  const userId = useAuthStore((s) => s.user?.id);
  const notifications = useFriendsStore((s) => s.notifications);
  const notificationsLoading = useFriendsStore((s) => s.notificationsLoading);
  const notifHasMore = useFriendsStore((s) => s.notifHasMore);
  const fetchNotifications = useFriendsStore((s) => s.fetchNotifications);
  const markNotificationRead = useFriendsStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useFriendsStore((s) => s.markAllNotificationsRead);
  const deleteAllNotifications = useFriendsStore((s) => s.deleteAllNotifications);
  const acceptRequest = useFriendsStore((s) => s.acceptRequest);
  const declineRequest = useFriendsStore((s) => s.declineRequest);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Suppress local banners while viewing this screen
  useEffect(() => {
    setViewingNotifications(true);
    return () => setViewingNotifications(false);
  }, []);

  useEffect(() => {
    if (userId) {
      fetchNotifications(userId, true);
    }
  }, [userId]);

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchNotifications(userId, true);
    setRefreshing(false);
  }, [userId]);

  const handleLoadMore = useCallback(() => {
    if (userId && notifHasMore && !notificationsLoading) {
      fetchNotifications(userId);
    }
  }, [userId, notifHasMore, notificationsLoading]);

  const handleMarkAllRead = useCallback(() => {
    if (userId) markAllNotificationsRead(userId);
  }, [userId]);

  const handleDeleteAll = useCallback(() => {
    Alert.alert(
      'Delete All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            if (userId) deleteAllNotifications(userId);
          },
        },
      ],
    );
  }, [userId]);

  // Resolve friendship_id from notification data, falling back to a lookup
  const resolveFriendshipId = useCallback(
    async (item: NotificationItem): Promise<string | null> => {
      if (item.data?.friendship_id) return item.data.friendship_id;
      if (item.data?.from_user_id && userId) {
        const friendship = await getFriendshipBetween(userId, item.data.from_user_id);
        return friendship?.id ?? null;
      }
      return null;
    },
    [userId],
  );

  const [respondedMap, setRespondedMap] = useState<Record<string, 'accepted' | 'declined'>>({});

  const handleAccept = useCallback(
    async (item: NotificationItem) => {
      if (!userId) return;
      const friendshipId = await resolveFriendshipId(item);
      if (friendshipId) {
        await acceptRequest(friendshipId, userId);
        setRespondedMap((prev) => ({ ...prev, [item.id]: 'accepted' }));
      }
    },
    [userId, acceptRequest, resolveFriendshipId],
  );

  const handleDecline = useCallback(
    async (item: NotificationItem) => {
      const friendshipId = await resolveFriendshipId(item);
      if (friendshipId) {
        await declineRequest(friendshipId);
        setRespondedMap((prev) => ({ ...prev, [item.id]: 'declined' }));
      }
    },
    [declineRequest, resolveFriendshipId],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const isActionable = item.type === 'friend_request';

      return (
        <NotificationRow
          notification={item}
          onPress={() => {
            if (!item.read) markNotificationRead(item.id);
          }}
          onAccept={
            isActionable && userId ? () => handleAccept(item) : undefined
          }
          onDecline={
            isActionable ? () => handleDecline(item) : undefined
          }
          responded={respondedMap[item.id] ?? null}
        />
      );
    },
    [userId, markNotificationRead, handleAccept, handleDecline, respondedMap],
  );

  return (
    <View style={styles.container}>
      {/* Actions row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
          <Text style={styles.actionText}>Mark all read</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAll} activeOpacity={0.7}>
          <Text style={[styles.actionText, { color: colors.accentRed }]}>Delete all</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <View style={styles.listWrap}>
        {notifications.length === 0 && !notificationsLoading ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={ms(36)} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        ) : (
          <FlashList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={sw(80)}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.textSecondary}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  actionText: {
    color: colors.accent,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
  },
  listWrap: {
    flex: 1,
  },
  empty: {
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
