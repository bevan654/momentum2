import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, InteractionManager, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { ActivityFeedItem } from '../../lib/friendsDatabase';
import FeedRow from './feed/FeedRow';
import FeedRowSkeleton from './feed/FeedRowSkeleton';
import FeedSeparator from './feed/FeedSeparator';
import FeedHeader from './feed/FeedHeader';

interface FeedProps {
  headerComponent?: React.ReactNode;
  titleComponent?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function Feed({
  headerComponent,
  titleComponent,
  refreshing = false,
  onRefresh,
}: FeedProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const feed = useFriendsStore((s) => s.feed);
  const feedFetchedAt = useFriendsStore((s) => s.feedFetchedAt);
  const feedLoading = useFriendsStore((s) => s.feedLoading);
  const feedHasMore = useFriendsStore((s) => s.feedHasMore);
  const fetchFeed = useFriendsStore((s) => s.fetchFeed);
  const feedMode = useFriendsStore((s) => s.feedMode);
  const setFeedMode = useFriendsStore((s) => s.setFeedMode);

  useEffect(() => {
    if (!userId) return;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchFeed(userId, true);
    });
    return () => task.cancel();
  }, [userId, fetchFeed, feedMode]);

  const handleSwitchMode = useCallback((mode: 'friends' | 'global') => {
    if (mode === feedMode) return;
    setFeedMode(mode);
  }, [feedMode, setFeedMode]);

  const hasFetched = feedFetchedAt !== null;
  const isLoading = !hasFetched && feed.length === 0;
  const isEmpty = hasFetched && feed.length === 0;

  const handleEndReached = useCallback(() => {
    if (!userId || !feedHasMore || feedLoading) return;
    fetchFeed(userId, false);
  }, [userId, feedHasMore, feedLoading, fetchFeed]);

  const renderItem = useCallback(({ item }: { item: ActivityFeedItem }) => (
    <FeedRow item={item} />
  ), []);

  const keyExtractor = useCallback((item: ActivityFeedItem) => item.id, []);

  const listHeader = useMemo(() => (
    <View>
      {headerComponent}
      {titleComponent ? (
        <>
          {titleComponent}
          <View style={styles.scopeOnlyRow}>
            <TouchableOpacity
              style={styles.headerSubRow}
              onPress={() => handleSwitchMode(feedMode === 'friends' ? 'global' : 'friends')}
              activeOpacity={0.7}
              accessibilityLabel={`Community feed showing ${feedMode}. Tap to switch.`}
            >
              <Text style={styles.headerSub}>
                {feedMode === 'friends' ? 'Friends' : 'Global'}
              </Text>
              <Ionicons name="swap-horizontal" size={ms(11)} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FeedHeader
          feedMode={feedMode}
          onToggle={() => handleSwitchMode(feedMode === 'friends' ? 'global' : 'friends')}
        />
      )}
      {isLoading && (
        <>
          <FeedRowSkeleton />
          <FeedSeparator />
          <FeedRowSkeleton />
          <FeedSeparator />
          <FeedRowSkeleton />
        </>
      )}
    </View>
  ), [
    headerComponent,
    titleComponent,
    feedMode,
    isLoading,
    handleSwitchMode,
    colors.textTertiary,
    styles,
  ]);

  const listFooter = useMemo(() => {
    if (feed.length === 0) return null;
    return (
      <View>
        {feedLoading && (
          <>
            <FeedSeparator />
            <FeedRowSkeleton />
          </>
        )}
        {!feedHasMore && (
          <View style={styles.endOfFeed}>
            <Text style={styles.endOfFeedText}>You're all caught up</Text>
          </View>
        )}
      </View>
    );
  }, [feed.length, feedLoading, feedHasMore, styles]);

  const listEmpty = useMemo(() => {
    if (!isEmpty) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={ms(28)} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyText}>
          {feedMode === 'friends'
            ? 'Add friends to see their workouts here.'
            : 'No public workouts yet — check back later.'}
        </Text>
      </View>
    );
  }, [isEmpty, feedMode, colors.textTertiary, styles]);

  return (
    <FlashList
      data={feed}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={FeedSeparator}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      ListEmptyComponent={listEmpty}
      showsVerticalScrollIndicator={false}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
      contentContainerStyle={{
        paddingHorizontal: sw(8),
        paddingTop: sw(8),
        paddingBottom: sw(24),
      }}
    />
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    headerSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    headerSub: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(12),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    scopeOnlyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: sw(14),
      paddingTop: sw(1),
      paddingBottom: sw(5),
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: sw(24),
      paddingVertical: sw(32),
      gap: sw(8),
    },
    endOfFeed: {
      alignItems: 'center',
      paddingVertical: sw(20),
    },
    endOfFeedText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(17),
      fontFamily: Fonts.bold,
      marginTop: sw(4),
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
  });
