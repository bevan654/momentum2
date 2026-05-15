import React, { useMemo, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { useAuthStore } from '../stores/useAuthStore';
import { useFriendsStore } from '../stores/useFriendsStore';
import { initNotifications, cleanupNotifications } from '../services/notificationService';
import { sw } from '../theme/responsive';
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
      const friendsCount = useFriendsStore.getState().friends.length;
      if (friendsCount === 0) {
        useFriendsStore.getState().fetchUnreadCount(userId);
        return;
      }
      initNotifications(userId);
      return () => cleanupNotifications();
    }, [userId])
  );

  const openAddFriend = useCallback(() => setAddFriendOpen(true), []);
  const closeAddFriend = useCallback(() => setAddFriendOpen(false), []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <NutritionStories onAddFriend={openAddFriend} />
        <Feed />
      </ScrollView>
      <AddFriendSheet visible={addFriendOpen} onClose={closeAddFriend} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: sw(16),
    paddingTop: sw(8),
    paddingBottom: sw(24),
    gap: sw(8),
  },
});
