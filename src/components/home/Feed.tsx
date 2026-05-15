import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
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
import CommentsSheet from '../friends/CommentsSheet';
import MiniBodyMap from '../body/MiniBodyMap';

const PHOTO_WIDTH = SCREEN_WIDTH - sw(32); // edge-to-edge within HomeScreen's sw(16) padding
const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 0.75); // 4:3 landscape

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
              <View key={`${item.id}-row-${i}`} style={styles.summaryRow}>
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

      <View style={styles.summaryBody}>
        <MiniBodyMap exercises={bodyMapExercises} scale={0.24} side="front" colors={bodyColors} />
        <MiniBodyMap exercises={bodyMapExercises} scale={0.24} side="back" colors={bodyColors} />
      </View>
    </View>
  );
});

interface FeedRowProps {
  item: ActivityFeedItem;
  onOpenComments: (activityId: string) => void;
}

const FeedRow = React.memo(function FeedRow({ item, onOpenComments }: FeedRowProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const name = displayNameFor(item.profile.username, item.profile.email);
  const initial = initialFor(item.profile.username, item.profile.email);
  const avatarColor = colorForId(item.user_id);
  const timeAgo = formatTimeAgo(item.created_at);
  const workoutTitle = workoutTitleFor(item);
  const caption = captionFor(item);
  const durationMin = Math.max(0, Math.round(item.duration / 60));
  const { likes, liked } = reactionTotals(item.reactions);
  const photoUrl = (item as ActivityFeedItem & { photo_url?: string }).photo_url || null;

  const currentUserId = useAuthStore((s) => s.user?.id);
  const friendIds = useFriendsStore((s) => s.friendIds);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);
  const blockUser = useFriendsStore((s) => s.blockUser);
  const addReaction = useFriendsStore((s) => s.addReaction);
  const removeReaction = useFriendsStore((s) => s.removeReaction);
  const commentCount = useFriendsStore((s) => s.commentCounts[item.id] || 0);
  const isSelf = currentUserId === item.user_id;
  const isFriend = friendIds.includes(item.user_id);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [viewWorkoutOpen, setViewWorkoutOpen] = useState(false);
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

  const handleOpenComments = useCallback(() => onOpenComments(item.id), [onOpenComments, item.id]);

  const openActions = useCallback(() => setActionsOpen(true), []);
  const closeActions = useCallback(() => setActionsOpen(false), []);

  const handleViewWorkout = useCallback(() => {
    setActionsOpen(false);
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
    <Pressable style={styles.card} onPress={handleViewWorkout}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name}>
            {name}
            <Text style={styles.nameSep}>  ·  {timeAgo}</Text>
          </Text>
        </View>

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

      {/* Hero stats */}
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

      {/* Photo or workout overview */}
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} />
      ) : (
        <WorkoutSummarySlot item={item} />
      )}

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={handleToggleLike} hitSlop={8}>
          <Ionicons
            name={liked ? 'heart-sharp' : 'heart-outline'}
            size={ms(22)}
            color={liked ? colors.accentRed : colors.textPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={handleOpenComments} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={ms(20)} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Like count + caption + comments */}
      <View style={styles.footerText}>
        {likes > 0 && (
          <Text style={styles.likeCount}>{formatCount(likes)} {likes === 1 ? 'like' : 'likes'}</Text>
        )}
        {caption.length > 0 && (
          <Text style={styles.caption}>
            <Text style={styles.captionName}>{name}</Text>
            <Text>  {caption}</Text>
          </Text>
        )}
        <Text style={styles.viewComments} onPress={handleOpenComments}>
          {commentCount === 0
            ? 'Add a comment…'
            : commentCount === 1
              ? 'View 1 comment'
              : `View all ${formatCount(commentCount)} comments`}
        </Text>
      </View>

      {/* View workout modal */}
      <FeedWorkoutModal
        item={viewWorkoutOpen ? item : null}
        onDismiss={() => setViewWorkoutOpen(false)}
      />

      {/* Report sheet — only mount when open to avoid N instances on feed */}
      {reportOpen && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="activity"
          targetId={item.id}
          targetUserId={item.user_id}
        />
      )}

    </Pressable>
  );
});

const FeedModeIcons = React.memo(function FeedModeIcons({
  feedMode, onSelect,
}: {
  feedMode: 'friends' | 'global';
  onSelect: (mode: 'friends' | 'global') => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.modeIcons}>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => onSelect('friends')}
        style={styles.modeIconBtn}
        hitSlop={8}
        accessibilityLabel="Friends activity"
      >
        <Ionicons
          name={feedMode === 'friends' ? 'people-sharp' : 'people-outline'}
          size={ms(22)}
          color={feedMode === 'friends' ? colors.textPrimary : colors.textTertiary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => onSelect('global')}
        style={styles.modeIconBtn}
        hitSlop={8}
        accessibilityLabel="Discover"
      >
        <Ionicons
          name={feedMode === 'global' ? 'globe-sharp' : 'globe-outline'}
          size={ms(22)}
          color={feedMode === 'global' ? colors.textPrimary : colors.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );
});

export default function Feed() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const feed = useFriendsStore((s) => s.feed);
  const feedFetchedAt = useFriendsStore((s) => s.feedFetchedAt);
  const fetchFeed = useFriendsStore((s) => s.fetchFeed);
  const fetchCommentCounts = useFriendsStore((s) => s.fetchCommentCounts);
  const feedMode = useFriendsStore((s) => s.feedMode);
  const setFeedMode = useFriendsStore((s) => s.setFeedMode);

  useEffect(() => {
    if (userId) fetchFeed(userId, true);
  }, [userId, fetchFeed, feedMode]);

  useEffect(() => {
    if (feed.length > 0) {
      fetchCommentCounts(feed.map((f) => f.id));
    }
  }, [feed, fetchCommentCounts]);

  const handleSwitchMode = (mode: 'friends' | 'global') => {
    if (mode === feedMode) return;
    setFeedMode(mode);
  };

  const [commentsActivityId, setCommentsActivityId] = useState<string | null>(null);
  const handleOpenComments = useCallback((id: string) => setCommentsActivityId(id), []);
  const handleCloseComments = useCallback(() => setCommentsActivityId(null), []);

  const hasFetched = feedFetchedAt !== null;
  const isEmpty = hasFetched && feed.length === 0;

  return (
    <View style={styles.wrap}>
      {/* Feed mode icons */}
      <FeedModeIcons
        feedMode={feedMode}
        onSelect={handleSwitchMode}
      />

      {feed.map((item) => (
        <FeedRow key={item.id} item={item} onOpenComments={handleOpenComments} />
      ))}

      {isEmpty && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={ms(28)} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            {feedMode === 'friends'
              ? 'Add friends to see their workouts here.'
              : 'No public workouts yet — check back later.'}
          </Text>
        </View>
      )}

      {/* Comments sheet — single instance mounted at feed level */}
      {commentsActivityId && (
        <CommentsSheet
          visible={!!commentsActivityId}
          activityId={commentsActivityId}
          onClose={handleCloseComments}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginTop: sw(8),
      gap: sw(12),
    },
    modeIcons: {
      flexDirection: 'row',
      gap: sw(18),
      alignSelf: 'flex-start',
    },
    modeIconBtn: {
      padding: sw(2),
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
      paddingBottom: sw(14),
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: sw(24),
      paddingVertical: sw(32),
      gap: sw(8),
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
      paddingVertical: sw(8),
    },
    avatar: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(16),
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: ms(13),
      fontFamily: Fonts.bold,
    },
    headerText: {
      flex: 1,
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
    },
    nameSep: {
      color: colors.textTertiary,
      fontFamily: Fonts.semiBold,
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
      fontSize: ms(22),
      lineHeight: ms(26),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.6,
    },
    heroValueUnit: {
      color: colors.textSecondary,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
    },
    heroLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(11),
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
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
      paddingHorizontal: sw(14),
      paddingTop: sw(4),
      paddingBottom: sw(8),
    },
    photo: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      backgroundColor: colors.cardBorder,
    },
    summarySlot: {
      width: PHOTO_WIDTH,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(14),
      paddingVertical: sw(14),
      gap: sw(14),
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.cardBorder,
    },
    summaryBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(2),
    },
    summaryList: {
      flex: 1,
      gap: sw(8),
    },
    summaryEmpty: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
    },
    summaryRow: {
      gap: sw(1),
    },
    summaryName: {
      color: colors.textPrimary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.bold,
      letterSpacing: -0.1,
    },
    summaryDetail: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    summaryMore: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: sw(4),
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(10),
      paddingTop: sw(8),
      paddingBottom: sw(4),
      gap: sw(2),
    },
    actionBtn: {
      paddingHorizontal: sw(6),
      paddingVertical: sw(2),
    },
    footerText: {
      paddingHorizontal: sw(12),
      paddingBottom: sw(10),
      gap: sw(3),
    },
    likeCount: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
    },
    caption: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    captionName: {
      fontFamily: Fonts.bold,
    },
    viewComments: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      marginTop: sw(2),
    },
  });
