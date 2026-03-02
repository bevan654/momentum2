import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { supabase } from '../../lib/supabase';
import type { ActivityFeedItem } from '../../lib/friendsDatabase';
import FeedCard from './FeedCard';
import FeedCardSkeleton from './FeedCardSkeleton';
import FeedWorkoutModal from './FeedWorkoutModal';
import CommentsSheet from './CommentsSheet';
import NewPostsPill from './NewPostsPill';

const LIKE_EMOJI = '\u{2764}\u{FE0F}'; // ❤️

export default function ActivityFeed() {
  const userId = useAuthStore((s) => s.user?.id);
  const feed = useFriendsStore((s) => s.feed);
  const feedLoading = useFriendsStore((s) => s.feedLoading);
  const feedHasMore = useFriendsStore((s) => s.feedHasMore);
  const fetchFeed = useFriendsStore((s) => s.fetchFeed);
  const fetchBookmarks = useFriendsStore((s) => s.fetchBookmarks);
  const bookmarks = useFriendsStore((s) => s.bookmarks);
  const toggleBookmark = useFriendsStore((s) => s.toggleBookmark);
  const addReaction = useFriendsStore((s) => s.addReaction);
  const removeReaction = useFriendsStore((s) => s.removeReaction);
  const commentsMap = useFriendsStore((s) => s.comments);
  const commentCounts = useFriendsStore((s) => s.commentCounts);
  const fetchCommentCounts = useFriendsStore((s) => s.fetchCommentCounts);
  const pendingFeedItems = useFriendsStore((s) => s.pendingFeedItems);
  const flushPendingFeed = useFriendsStore((s) => s.flushPendingFeed);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFeedItem, setSelectedFeedItem] = useState<ActivityFeedItem | null>(null);
  const [commentsActivityId, setCommentsActivityId] = useState<string | null>(null);
  const [newPostCount, setNewPostCount] = useState(0);
  const listRef = useRef<FlashList<ActivityFeedItem>>(null);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) {
      fetchFeed(userId, true);
      fetchBookmarks(userId);
    }
  }, [userId]);

  // Fetch comment counts whenever feed items change
  useEffect(() => {
    if (feed.length > 0) {
      const ids = feed.map((f) => f.id).filter(Boolean);
      fetchCommentCounts(ids);
    }
  }, [feed.length]);

  // Realtime subscription for new feed posts
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        (payload) => {
          // Skip own posts — they'll appear via normal fetch
          if (payload.new && (payload.new as any).user_id !== userId) {
            setNewPostCount((c) => c + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchFeed(userId, true, true);
    setNewPostCount(0);
    setRefreshing(false);
  }, [userId]);

  const handleNewPostsTap = useCallback(async () => {
    if (!userId) return;
    await fetchFeed(userId, true, true);
    setNewPostCount(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [userId, fetchFeed]);

  const handleLoadMore = useCallback(() => {
    if (userId && feedHasMore && !feedLoading) {
      fetchFeed(userId);
    }
  }, [userId, feedHasMore, feedLoading]);

  const handleAddReaction = useCallback(
    (activityId: string, emoji: string) => {
      if (!userId) return;
      addReaction(activityId, userId, emoji);
    },
    [userId],
  );

  const handleToggleLike = useCallback(
    (activityId: string, currentlyLiked: boolean) => {
      if (!userId) return;
      if (currentlyLiked) {
        removeReaction(activityId, userId, LIKE_EMOJI);
      } else {
        addReaction(activityId, userId, LIKE_EMOJI);
      }
    },
    [userId],
  );

  const handleToggleBookmark = useCallback(
    (activityId: string) => {
      if (!userId) return;
      toggleBookmark(activityId, userId);
    },
    [userId, toggleBookmark],
  );

  const handleOpenComments = useCallback(
    (activityId: string) => {
      setCommentsActivityId(activityId);
    },
    [],
  );

  const handleCloseComments = useCallback(() => {
    setCommentsActivityId(null);
  }, []);

  const handleCardPress = useCallback(
    (item: ActivityFeedItem) => {
      setSelectedFeedItem(item);
    },
    [],
  );

  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  const listFooter = useMemo(() => {
    if (!feedLoading || feed.length === 0) return null;
    return (
      <View style={{ paddingTop: sw(4) }}>
        <FeedCardSkeleton />
        <FeedCardSkeleton />
      </View>
    );
  }, [feedLoading, feed.length]);

  const renderItem = useCallback(
    ({ item }: { item: ActivityFeedItem }) => {
      const heartReaction = item.reactions.find((r) => r.emoji === LIKE_EMOJI);
      const isLiked = heartReaction?.reacted ?? false;
      const heartCount = heartReaction?.count ?? 0;

      return (
        <FeedCard
          item={item}
          liked={isLiked}
          likeCount={heartCount}
          bookmarked={bookmarkSet.has(item.id)}
          commentCount={commentCounts[item.id] || 0}
          comments={commentsMap[item.id] || []}
          onAddReaction={handleAddReaction}
          onToggleLike={handleToggleLike}
          onToggleBookmark={handleToggleBookmark}
          onOpenComments={handleOpenComments}
          onPress={() => handleCardPress(item)}
        />
      );
    },
    [handleAddReaction, handleToggleLike, handleToggleBookmark, handleOpenComments, handleCardPress, bookmarkSet, commentCounts, commentsMap],
  );

  return (
    <View style={styles.container}>
      {feed.length === 0 && feedLoading ? (
        <View style={styles.listContent}>
          <FeedCardSkeleton />
          <FeedCardSkeleton />
          <FeedCardSkeleton />
        </View>
      ) : feed.length === 0 && !feedLoading ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="newspaper-outline" size={ms(24)} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyText}>No activity yet</Text>
          <Text style={styles.emptySubtext}>Add friends to see their workouts</Text>
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={feed}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id ?? `feed-${index}`}
          estimatedItemSize={sw(360)}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={listFooter}
          extraData={[bookmarkSet, commentCounts]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textSecondary}
            />
          }
        />
      )}

      <NewPostsPill count={newPostCount} onPress={handleNewPostsTap} />

      {selectedFeedItem && (
        <FeedWorkoutModal
          item={selectedFeedItem}
          onDismiss={() => setSelectedFeedItem(null)}
        />
      )}

      {commentsActivityId && (
        <CommentsSheet
          activityId={commentsActivityId}
          visible={!!commentsActivityId}
          onClose={handleCloseComments}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: sw(10),
      paddingVertical: sw(12),
      paddingBottom: sw(32),
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: sw(8),
      paddingTop: sw(60),
    },
    emptyIcon: {
      width: sw(56),
      height: sw(56),
      borderRadius: sw(18),
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      marginBottom: sw(4),
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(20),
    },
    emptySubtext: {
      color: colors.textTertiary + '80',
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(17),
    },
  });
