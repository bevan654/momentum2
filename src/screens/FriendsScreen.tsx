import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, InteractionManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, ms } from '../theme/responsive';
import { Fonts } from '../theme/typography';
import { useAuthStore } from '../stores/useAuthStore';
import { useFriendsStore } from '../stores/useFriendsStore';
import { initNotifications, cleanupNotifications } from '../services/notificationService';
import NutritionStories from '../components/home/NutritionStories';
import Feed from '../components/home/Feed';
import AddFriendSheet from '../components/friends/AddFriendSheet';
import Leaderboard from '../components/friends/Leaderboard';

type CommunityView = 'feed' | 'leaderboard';

function FriendsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [communityView, setCommunityView] = useState<CommunityView>('feed');

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

  const viewTabs = useMemo(() => (
    <View style={styles.viewTabs}>
      {(['feed', 'leaderboard'] as const).map((view) => {
        const active = communityView === view;
        return (
          <TouchableOpacity
            key={view}
            style={[styles.viewTab, active && styles.viewTabActive]}
            onPress={() => setCommunityView(view)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={view === 'feed' ? 'people-outline' : 'trophy-outline'}
              size={ms(16)}
              color={active ? colors.accent : colors.textTertiary}
            />
            <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>
              {view === 'feed' ? 'Feed' : 'Leaderboard'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  ), [colors.accent, colors.textTertiary, communityView, styles]);

  const leaderboardHeader = useMemo(() => (
    <View style={styles.leaderboardHeader}>
      {header}
      {viewTabs}
    </View>
  ), [header, styles.leaderboardHeader, viewTabs]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {communityView === 'feed' ? (
          <Feed
            headerComponent={header}
            titleComponent={viewTabs}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        ) : (
          <Leaderboard headerComponent={leaderboardHeader} />
        )}
      </View>
      <AddFriendSheet visible={addFriendOpen} onClose={closeAddFriend} />
    </View>
  );
}

export default React.memo(FriendsScreen);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewTabs: {
    flexDirection: 'row',
    marginHorizontal: -sw(8),
    marginTop: sw(4),
    marginBottom: sw(8),
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    paddingVertical: sw(11),
    borderBottomWidth: sw(2),
    borderBottomColor: 'transparent',
  },
  viewTabActive: {
    borderBottomColor: colors.accent,
  },
  viewTabText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
  },
  viewTabTextActive: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  leaderboardHeader: {
    paddingHorizontal: sw(8),
  },
  content: {
    flex: 1,
  },
});
