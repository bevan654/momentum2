import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, InteractionManager, RefreshControl, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { ActivityFeedItem } from '../../lib/friendsDatabase';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import FeedWorkoutModal from '../friends/FeedWorkoutModal';
import ReportSheet from '../friends/ReportSheet';
import MiniBodyMap from '../body/MiniBodyMap';

const PHOTO_WIDTH = SCREEN_WIDTH - sw(16); // small gutter (sw(8) on each side)
const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 0.5625); // 16:9 landscape — denser feed

/* ─── Helpers ────────────────────────────────────────── */

const AVATAR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA',
  '#60A5FA', '#F59E0B', '#EC4899', '#10B981',
  '#8B5CF6', '#06B6D4',
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function displayNameFor(username: string | null, email: string): string {
  return username || (email ? email.split('@')[0] : 'friend');
}

function initialFor(username: string | null, email: string): string {
  return (username || email || '?').charAt(0).toUpperCase();
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${Math.round(kg)} kg`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function workoutTitleFor(item: ActivityFeedItem): string {
  if (item.routine_name) return item.routine_name;
  if (item.program_name) {
    return item.program_day_label || item.program_name;
  }
  return 'Workout';
}

function captionFor(item: ActivityFeedItem): string {
  if (item.caption && item.caption.trim().length > 0) return item.caption.trim();
  const names = item.exercise_names || [];
  if (names.length === 0) return '';
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2} more` : shown;
}

const LIKE_EMOJI = '❤️';

function reactionTotals(reactions: ActivityFeedItem['reactions']): { likes: number; liked: boolean } {
  const heart = (reactions || []).find((r) => r.emoji === LIKE_EMOJI);
  return { likes: heart?.count ?? 0, liked: heart?.reacted ?? false };
}

const MAX_OVERVIEW_EXERCISES = 5;

const WorkoutSummarySlot = React.memo(function WorkoutSummarySlot({ item }: { item: ActivityFeedItem }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bodyMapExercises: ExerciseWithSets[] = useMemo(
    () =>
      (item.exercise_details || []).map((ex, i) => ({
        id: `${item.id}-${i}`,
        name: ex.name,
        exercise_order: i,
        exercise_type: 'weighted',
        sets:
          ex.total_volume > 0
            ? [{
                id: `${item.id}-${i}-0`,
                set_number: 1,
                kg: ex.total_volume,
                reps: 1,
                completed: true,
                set_type: null,
                parent_set_number: null,
                isPR: false,
              }]
            : [],
        hasPR: false,
        category: ex.category,
        primary_muscles: ex.primary_muscles,
        secondary_muscles: ex.secondary_muscles,
      })),
    [item.exercise_details, item.id],
  );

  const bodyColors = useMemo(() => [
    '#1A1A1E', '#2A2A2E',
    colors.accent + '50', colors.accent + '80',
    colors.accent + 'CC', colors.accent, colors.accent,
  ], [colors.accent]);

  const visibleExercises = (item.exercise_details || []).slice(0, MAX_OVERVIEW_EXERCISES);
  const extra = (item.exercise_details?.length || 0) - visibleExercises.length;

  return (
    <View style={styles.summarySlot}>
      <View style={styles.summaryBody}>
        <View style={styles.summaryBodyCol}>
          <Text style={styles.summaryBodyLabel}>FRONT</Text>
          <MiniBodyMap exercises={bodyMapExercises} scale={0.22} side="front" colors={bodyColors} />
        </View>
        <View style={styles.summaryBodyCol}>
          <Text style={styles.summaryBodyLabel}>BACK</Text>
          <MiniBodyMap exercises={bodyMapExercises} scale={0.22} side="back" colors={bodyColors} />
        </View>
      </View>

      <View style={styles.summaryList}>
        {visibleExercises.length === 0 ? (
          <Text style={styles.summaryEmpty}>No exercises recorded</Text>
        ) : (
          visibleExercises.map((ex, i) => {
            const best = ex.best_kg > 0
              ? `${Math.round(ex.best_kg)}kg × ${ex.best_reps}`
              : ex.best_reps > 0
                ? `${ex.best_reps} reps`
                : null;
            return (
              <View
                key={`${item.id}-row-${i}`}
                style={[styles.summaryRow, i > 0 && styles.summaryRowDivider]}
              >
                <Text style={styles.summaryName} numberOfLines={1}>
                  {ex.name.replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Text style={styles.summaryDetail} numberOfLines={1}>
                  {ex.sets_count > 0 ? `${ex.sets_count} sets` : ''}{best ? ` · ${best}` : ''}
                </Text>
              </View>
            );
          })
        )}
        {extra > 0 && <Text style={styles.summaryMore}>+{extra} more</Text>}
      </View>
    </View>
  );
});

const PhotoOverviewCarousel = React.memo(function PhotoOverviewCarousel({
  photoUrl,
  item,
}: {
  photoUrl: string;
  item: ActivityFeedItem;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState(0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / PHOTO_WIDTH);
    setPage(idx);
  }, []);

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={PHOTO_WIDTH}
        decelerationRate="fast"
        style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
        contentContainerStyle={{ width: PHOTO_WIDTH * 2 }}
      >
        <View style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}>
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        </View>
        <View style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT, justifyContent: 'center' }}>
          <WorkoutSummarySlot item={item} />
        </View>
      </ScrollView>
      <View style={styles.pageDots}>
        <View style={[styles.pageDot, page === 0 && styles.pageDotActive]} />
        <View style={[styles.pageDot, page === 1 && styles.pageDotActive]} />
      </View>
    </View>
  );
});

interface FeedRowProps {
  item: ActivityFeedItem;
}

const FeedRow = React.memo(function FeedRow({ item }: FeedRowProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const name = displayNameFor(item.profile.username, item.profile.email);
  const initial = initialFor(item.profile.username, item.profile.email);
  const avatarColor = colorForId(item.user_id);
  const timeAgo = formatTimeAgo(item.created_at);
  const workoutTitle = workoutTitleFor(item);
  const caption = captionFor(item);
  const durationMin = Math.max(0, Math.floor(item.duration / 60));
  const { likes, liked } = reactionTotals(item.reactions);
  const photoUrl = item.photo_url;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const friendIds = useFriendsStore((s) => s.friendIds);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);
  const blockUser = useFriendsStore((s) => s.blockUser);
  const addReaction = useFriendsStore((s) => s.addReaction);
  const removeReaction = useFriendsStore((s) => s.removeReaction);
  const isSelf = currentUserId === item.user_id;
  const isFriend = friendIds.includes(item.user_id);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [viewWorkoutOpen, setViewWorkoutOpen] = useState(false);
  const [hasOpenedWorkoutModal, setHasOpenedWorkoutModal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleToggleLike = useCallback(() => {
    if (!currentUserId) return;
    if (liked) {
      removeReaction(item.id, currentUserId, LIKE_EMOJI);
    } else {
      addReaction(item.id, currentUserId, LIKE_EMOJI);
    }
  }, [currentUserId, liked, item.id, addReaction, removeReaction]);

  const openActions = useCallback(() => setActionsOpen(true), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);

  const handleViewWorkout = useCallback(() => {
    setActionsOpen(false);
    setHasOpenedWorkoutModal(true);
    setViewWorkoutOpen(true);
  }, []);

  const handleAddFriend = useCallback(() => {
    if (!currentUserId || isSelf || isFriend || requestSent) {
      setActionsOpen(false);
      return;
    }
    sendFriendRequest(currentUserId, item.user_id);
    setRequestSent(true);
    setActionsOpen(false);
  }, [currentUserId, isSelf, isFriend, requestSent, sendFriendRequest, item.user_id]);

  const handleReport = useCallback(() => {
    setActionsOpen(false);
    setReportOpen(true);
  }, []);

  const handleBlock = useCallback(() => {
    if (!currentUserId || isSelf) {
      setActionsOpen(false);
      return;
    }
    blockUser(currentUserId, item.user_id);
    setActionsOpen(false);
  }, [currentUserId, isSelf, blockUser, item.user_id]);

  return (
    <View style={[styles.card, actionsOpen && styles.cardElevated]}>
      <View style={[styles.headerRow, actionsOpen && styles.headerRowElevated]}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>
            {name}
            <Text style={styles.nameSep}>  ·  {timeAgo}</Text>
          </Text>
        </View>

        {item.streak > 0 && (
          <View style={styles.streakChip}>
            <View style={styles.streakAccentBar} />
            <Ionicons name="flame" size={ms(13)} color={colors.streak} />
            <Text style={styles.streakChipText}>{item.streak}</Text>
            <Text style={styles.streakChipUnit}>d</Text>
          </View>
        )}

        {!isSelf && !isFriend && (
          <TouchableOpacity
            style={[styles.addBtn, requestSent && styles.addBtnSent]}
            onPress={handleAddFriend}
            activeOpacity={0.7}
            disabled={requestSent}
            hitSlop={6}
          >
            <Ionicons
              name={requestSent ? 'checkmark' : 'person-add-outline'}
              size={ms(12)}
              color={requestSent ? colors.accentGreen : colors.accent}
            />
            <Text style={[styles.addBtnText, requestSent && { color: colors.accentGreen }]}>
              {requestSent ? 'Sent' : 'Add'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionsAnchor}>
          <TouchableOpacity activeOpacity={0.6} hitSlop={8} onPress={openActions}>
            <Ionicons name="ellipsis-horizontal" size={ms(16)} color={colors.textSecondary} />
          </TouchableOpacity>

          {actionsOpen && (
            <>
              <Pressable style={styles.actionsBackdrop} onPress={closeActions} />
              <View style={[styles.actionsMenu, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <TouchableOpacity style={styles.actionsRow} activeOpacity={0.6} onPress={handleViewWorkout}>
                  <Ionicons name="barbell-outline" size={ms(16)} color={colors.textPrimary} />
                  <Text style={styles.actionsRowText}>View Workout</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionsRow} activeOpacity={0.6} onPress={handleAddFriend} disabled={isSelf || isFriend || requestSent}>
                  <Ionicons
                    name="person-add-outline"
                    size={ms(16)}
                    color={(isSelf || isFriend || requestSent) ? colors.textTertiary : colors.textPrimary}
                  />
                  <Text style={[
                    styles.actionsRowText,
                    (isSelf || isFriend || requestSent) && { color: colors.textTertiary },
                  ]}>
                    {isSelf ? 'Add Friend' : isFriend ? 'Already Friends' : requestSent ? 'Request Sent' : 'Add Friend'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionsRow} activeOpacity={0.6} onPress={handleReport} disabled={isSelf}>
                  <Ionicons name="flag-outline" size={ms(16)} color={isSelf ? colors.textTertiary : colors.accentRed} />
                  <Text style={[styles.actionsRowText, { color: isSelf ? colors.textTertiary : colors.accentRed }]}>Report</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionsRow, styles.actionsRowLast]} activeOpacity={0.6} onPress={handleBlock} disabled={isSelf}>
                  <Ionicons name="ban-outline" size={ms(16)} color={isSelf ? colors.textTertiary : colors.accentRed} />
                  <Text style={[styles.actionsRowText, { color: isSelf ? colors.textTertiary : colors.accentRed }]}>Block User</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>

      {(item.routine_name || item.program_name) && (
        <View style={styles.tagRow}>
          {item.routine_name && !item.program_name && (
            <>
              <View style={[styles.tagChip, styles.tagChipRoutine]}>
                <Text style={[styles.tagChipText, styles.tagChipTextRoutine]}>ROUTINE</Text>
              </View>
              <Text style={styles.tagName} numberOfLines={1}>{item.routine_name}</Text>
            </>
          )}
          {item.program_name && (
            <>
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>PROGRAM</Text>
              </View>
              <Text style={styles.tagName} numberOfLines={1}>{item.program_name}</Text>
              {item.program_week ? (
                <Text style={styles.tagMeta}>
                  W{item.program_week}{item.program_total_weeks ? `/${item.program_total_weeks}` : ''}
                  {item.program_day_label ? ` · ${item.program_day_label}` : ''}
                </Text>
              ) : null}
            </>
          )}
        </View>
      )}

      {item.title && item.title.trim().length > 0 && (
        <Text style={styles.postTitle}>{item.title.trim()}</Text>
      )}

      <View style={styles.heroRow}>
        <View style={styles.heroStat}>
          <Text style={styles.heroValue}>{formatVolume(item.total_volume)}</Text>
          <Text style={styles.heroLabel}>Volume</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroValue}>{durationMin}<Text style={styles.heroValueUnit}>m</Text></Text>
          <Text style={styles.heroLabel}>Duration</Text>
        </View>
      </View>
      <Text style={styles.heroMeta}>
        {workoutTitle}  ·  {item.total_exercises} exercises
      </Text>

      {photoUrl ? (
        <PhotoOverviewCarousel photoUrl={photoUrl} item={item} />
      ) : (
        <WorkoutSummarySlot item={item} />
      )}

      {caption.length > 0 && (
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>
            <Text style={styles.captionName}>{name}</Text>
            {'  '}
            {caption}
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={handleToggleLike} hitSlop={8}>
          <Ionicons
            name={liked ? 'heart-sharp' : 'heart-outline'}
            size={ms(22)}
            color={liked ? colors.accentRed : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {likes > 0 && (
        <View style={styles.footerText}>
          <Text style={styles.likeCount}>{formatCount(likes)} {likes === 1 ? 'like' : 'likes'}</Text>
        </View>
      )}

      {hasOpenedWorkoutModal && (
        <FeedWorkoutModal
          item={viewWorkoutOpen ? item : null}
          onDismiss={() => setViewWorkoutOpen(false)}
        />
      )}

      {reportOpen && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="activity"
          targetId={item.id}
          targetUserId={item.user_id}
        />
      )}

    </View>
  );
});

const FeedRowSkeleton = React.memo(function FeedRowSkeleton() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.45,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.skelAvatar, shimmerStyle]} />
        <View style={styles.headerText}>
          <Animated.View style={[styles.skelLine, styles.skelNameLine, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.skelStreak, shimmerStyle]} />
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroStat}>
          <Animated.View style={[styles.skelLine, styles.skelStatValue, shimmerStyle]} />
          <Animated.View style={[styles.skelLine, styles.skelStatLabel, shimmerStyle]} />
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Animated.View style={[styles.skelLine, styles.skelStatValue, shimmerStyle]} />
          <Animated.View style={[styles.skelLine, styles.skelStatLabel, shimmerStyle]} />
        </View>
      </View>
      <Animated.View style={[styles.skelLine, styles.skelMetaLine, shimmerStyle]} />

      <Animated.View style={[styles.skelMedia, shimmerStyle]} />

      <View style={styles.actionRow}>
        <Animated.View style={[styles.skelIcon, shimmerStyle]} />
      </View>
    </View>
  );
});

const FeedSeparator = React.memo(function FeedSeparator() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.separator}>
      <View style={styles.separatorLine} />
      <View style={styles.separatorDot} />
      <View style={styles.separatorIconWrap}>
        <Ionicons name="barbell" size={ms(11)} color={colors.textTertiary} />
      </View>
      <View style={styles.separatorDot} />
      <View style={styles.separatorLine} />
    </View>
  );
});

const FeedHeader = React.memo(function FeedHeader({
  feedMode, onToggle,
}: {
  feedMode: 'friends' | 'global';
  onToggle: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onToggle}
      style={styles.headerWrap}
      accessibilityLabel={`Community feed, showing ${feedMode}. Tap to switch.`}
    >
      <Text style={styles.headerTitle}>Community Feed</Text>
      <View style={styles.headerSubRow}>
        <Text style={styles.headerSub}>{feedMode === 'friends' ? 'Friends' : 'Global'}</Text>
        <Ionicons name="swap-horizontal" size={ms(11)} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
});

interface FeedProps {
  headerComponent?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function Feed({ headerComponent, refreshing = false, onRefresh }: FeedProps) {
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
      <FeedHeader
        feedMode={feedMode}
        onToggle={() => handleSwitchMode(feedMode === 'friends' ? 'global' : 'friends')}
      />
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
  ), [headerComponent, feedMode, isLoading, handleSwitchMode]);

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
      estimatedItemSize={sw(520)}
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
    wrap: {
      marginTop: sw(8),
      gap: sw(4),
    },
    headerWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: sw(12),
      paddingTop: sw(4),
      paddingBottom: sw(2),
      marginBottom: sw(8),
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(22),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.4,
    },
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
    actionsAnchor: {
      position: 'relative',
      zIndex: 30,
    },
    actionsBackdrop: {
      position: 'absolute',
      top: -sw(200),
      left: -sw(400),
      right: -sw(20),
      bottom: -sw(800),
      zIndex: 29,
    },
    actionsMenu: {
      position: 'absolute',
      top: sw(20),
      right: 0,
      minWidth: sw(180),
      borderWidth: 1,
      borderRadius: 0,
      zIndex: 31,
      ...colors.cardShadow,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingHorizontal: sw(12),
      paddingVertical: sw(10),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    actionsRowLast: {
      borderBottomWidth: 0,
    },
    actionsRowText: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    card: {
      gap: 0,
      paddingBottom: sw(4),
      backgroundColor: colors.card,
    },
    cardElevated: {
      zIndex: 100,
      elevation: 20,
    },
    skelAvatar: {
      width: sw(26),
      height: sw(26),
      borderRadius: sw(13),
      backgroundColor: colors.cardBorder,
    },
    skelLine: {
      backgroundColor: colors.cardBorder,
    },
    skelNameLine: {
      width: sw(110),
      height: ms(11),
    },
    skelStreak: {
      width: sw(42),
      height: ms(18),
      backgroundColor: colors.cardBorder,
    },
    skelStatValue: {
      width: sw(64),
      height: ms(18),
      marginBottom: sw(4),
    },
    skelStatLabel: {
      width: sw(40),
      height: ms(8),
    },
    skelMetaLine: {
      width: sw(180),
      height: ms(9),
      marginHorizontal: sw(14),
      marginTop: sw(6),
      marginBottom: sw(8),
      backgroundColor: colors.cardBorder,
    },
    skelMedia: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      backgroundColor: colors.cardBorder,
    },
    skelIcon: {
      width: ms(22),
      height: ms(22),
      backgroundColor: colors.cardBorder,
      marginHorizontal: sw(6),
      marginVertical: sw(2),
    },
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 0,
      paddingHorizontal: sw(20),
      gap: sw(6),
      backgroundColor: colors.background,
    },
    separatorLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
    },
    separatorDot: {
      width: sw(3),
      height: sw(3),
      borderRadius: sw(2),
      backgroundColor: colors.cardBorder,
    },
    separatorIconWrap: {
      paddingHorizontal: sw(4),
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingHorizontal: sw(12),
      paddingVertical: sw(6),
    },
    headerRowElevated: {
      zIndex: 100,
      elevation: 20,
    },
    avatar: {
      width: sw(26),
      height: sw(26),
      borderRadius: sw(13),
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: ms(11),
      fontFamily: Fonts.bold,
    },
    headerText: {
      flex: 1,
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
    },
    nameSep: {
      color: colors.textTertiary,
      fontFamily: Fonts.semiBold,
    },
    streakChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      paddingLeft: sw(7),
      paddingRight: sw(8),
      paddingVertical: sw(3),
      backgroundColor: colors.streak + '14',
      shadowColor: colors.streak,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 5,
      elevation: 3,
    },
    streakAccentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: colors.streak,
    },
    streakChipText: {
      color: colors.streak,
      fontSize: ms(12),
      lineHeight: ms(14),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    streakChipUnit: {
      color: colors.streak,
      fontSize: ms(9),
      lineHeight: ms(11),
      fontFamily: Fonts.bold,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      opacity: 0.75,
      marginLeft: -sw(1),
      marginBottom: -sw(1),
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      paddingHorizontal: sw(8),
      paddingVertical: sw(4),
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    addBtnSent: {
      borderColor: colors.accentGreen,
      backgroundColor: colors.accentGreen + '15',
    },
    addBtnText: {
      color: colors.accent,
      fontSize: ms(11),
      lineHeight: ms(13),
      fontFamily: Fonts.bold,
    },
    tagRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: sw(5),
      paddingHorizontal: sw(12),
      paddingTop: sw(4),
      paddingBottom: sw(2),
    },
    tagChip: {
      backgroundColor: colors.accent + '22',
      paddingHorizontal: sw(5),
      paddingVertical: sw(1),
    },
    tagChipText: {
      color: colors.accent,
      fontSize: ms(7),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
    },
    tagChipRoutine: {
      backgroundColor: colors.accentOrange + '22',
    },
    tagChipTextRoutine: {
      color: colors.accentOrange,
    },
    tagName: {
      color: colors.textPrimary,
      fontSize: ms(10),
      fontFamily: Fonts.bold,
      flexShrink: 1,
    },
    tagMeta: {
      color: colors.textTertiary,
      fontSize: ms(9),
      fontFamily: Fonts.medium,
    },
    postTitle: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
      paddingHorizontal: sw(14),
      paddingTop: sw(2),
      paddingBottom: sw(5),
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(14),
      paddingTop: 0,
      paddingBottom: 0,
    },
    heroStat: {
      flex: 1,
      alignItems: 'flex-start',
    },
    heroValue: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(20),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.4,
    },
    heroValueUnit: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
    },
    heroLabel: {
      color: colors.textTertiary,
      fontSize: ms(7),
      lineHeight: ms(9),
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: sw(1),
    },
    heroDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.cardBorder,
      marginHorizontal: sw(10),
    },
    heroMeta: {
      color: colors.textSecondary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.semiBold,
      paddingHorizontal: sw(14),
      paddingTop: sw(3),
      paddingBottom: sw(6),
    },
    photo: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      backgroundColor: colors.cardBorder,
    },
    pageDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(5),
      paddingTop: sw(8),
      paddingBottom: sw(2),
    },
    pageDot: {
      width: sw(5),
      height: sw(5),
      borderRadius: sw(3),
      backgroundColor: colors.cardBorder,
    },
    pageDotActive: {
      backgroundColor: colors.accent,
    },
    summarySlot: {
      width: PHOTO_WIDTH,
      paddingTop: sw(4),
      paddingBottom: sw(2),
    },
    summaryBody: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: sw(20),
      paddingVertical: sw(6),
    },
    summaryBodyCol: {
      alignItems: 'center',
      gap: sw(4),
    },
    summaryBodyLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(11),
      fontFamily: Fonts.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    summaryList: {
      paddingHorizontal: sw(14),
      paddingTop: sw(6),
    },
    summaryEmpty: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      paddingVertical: sw(8),
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: sw(7),
      gap: sw(10),
    },
    summaryRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    summaryName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
      letterSpacing: -0.1,
    },
    summaryDetail: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.medium,
    },
    summaryMore: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
      paddingVertical: sw(6),
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(10),
      paddingTop: sw(5),
      paddingBottom: sw(2),
      gap: sw(2),
    },
    actionBtn: {
      paddingHorizontal: sw(6),
      paddingVertical: sw(2),
    },
    captionWrap: {
      paddingHorizontal: sw(12),
      paddingTop: sw(8),
      paddingBottom: sw(2),
    },
    footerText: {
      paddingHorizontal: sw(12),
      paddingBottom: sw(4),
      gap: sw(2),
    },
    likeCount: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
    },
    caption: {
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(17),
      fontFamily: Fonts.regular,
      letterSpacing: -0.1,
    },
    captionName: {
      color: colors.textPrimary,
      fontFamily: Fonts.bold,
      fontSize: ms(12),
      lineHeight: ms(17),
    },
  });
