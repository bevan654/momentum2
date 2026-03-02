import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { FriendProfile } from '../../lib/friendsDatabase';
import FriendRow from './FriendRow';

interface Props {
  onOpenNudge: (friend: FriendProfile) => void;
  onOpenProfile: (friend: FriendProfile) => void;
}

export default function FriendList({ onOpenNudge, onOpenProfile }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const friends = useFriendsStore((s) => s.friends);
  const friendsLoading = useFriendsStore((s) => s.friendsLoading);
  const fetchFriends = useFriendsStore((s) => s.fetchFriends);
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) fetchFriends(userId);
  }, [userId]);

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchFriends(userId, true);
    setRefreshing(false);
  }, [userId, fetchFriends]);

  const renderItem = useCallback(
    ({ item }: { item: FriendProfile }) => (
      <FriendRow
        friend={item}
        onPress={() => onOpenProfile(item)}
        onNudge={() => onOpenNudge(item)}
      />
    ),
    [onOpenNudge, onOpenProfile],
  );

  if (!friendsLoading && friends.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="people-outline" size={ms(40)} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No friends yet</Text>
        <Text style={styles.emptySubtitle}>
          Use the search icon to find and add friends
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={friends}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      estimatedItemSize={sw(72)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.textSecondary}
        />
      }
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  listContent: {
    paddingTop: sw(6),
    paddingBottom: sw(20),
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(10),
    paddingHorizontal: sw(40),
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.bold,
    lineHeight: ms(23),
    marginTop: sw(4),
  },
  emptySubtitle: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: ms(18),
  },
});
