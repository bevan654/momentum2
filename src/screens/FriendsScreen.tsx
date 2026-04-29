import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { useAuthStore } from '../stores/useAuthStore';
import { useFriendsStore } from '../stores/useFriendsStore';
import { initNotifications, cleanupNotifications } from '../services/notificationService';
import FriendsTab from '../components/friends/FriendsTab';

export default function FriendsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);

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

  return (
    <View style={styles.container}>
      <FriendsTab />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
