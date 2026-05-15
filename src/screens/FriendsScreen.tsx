import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { useAuthStore } from '../stores/useAuthStore';
import { useFriendsStore } from '../stores/useFriendsStore';
import { initNotifications, cleanupNotifications } from '../services/notificationService';
import NutritionStories from '../components/home/NutritionStories';
import Feed from '../components/home/Feed';
import AddFriendSheet from '../components/friends/AddFriendSheet';

export default function FriendsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const [addFriendOpen, setAddFriendOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let didInit = false;
      const task = InteractionManager.runAfterInteractions(() => {
        const friendsCount = useFriendsStore.getState().friends.length;
        if (friendsCount === 0) {
          useFriendsStore.getState().fetchUnreadCount(userId);
          return;
        }
        initNotifications(userId);
        didInit = true;
      });
      return () => {
        task.cancel();
        if (didInit) cleanupNotifications();
      };
    }, [userId])
  );

  const openAddFriend = useCallback(() => setAddFriendOpen(true), []);
  const closeAddFriend = useCallback(() => setAddFriendOpen(false), []);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await useFriendsStore.getState().fetchFeed(userId, true, true);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  const header = useMemo(
    () => <NutritionStories onAddFriend={openAddFriend} />,
    [openAddFriend],
  );

  return (
    <View style={styles.container}>
      <Feed
        headerComponent={header}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <AddFriendSheet visible={addFriendOpen} onClose={closeAddFriend} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
