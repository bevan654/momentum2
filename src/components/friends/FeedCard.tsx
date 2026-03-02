import React, { useCallback, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import type { TapGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { ActivityFeedItem, CommentItem } from '../../lib/friendsDatabase';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import AvatarCircle from './AvatarCircle';
import FeedActionRow from './FeedActionRow';
import HeartBurst from './HeartBurst';
import CommentPreview from './CommentPreview';
import MiniBodyMap from '../body/MiniBodyMap';

const LIKE_EMOJI = '\u{2764}\u{FE0F}'; // ❤️

interface Props {
  item: ActivityFeedItem;
  liked: boolean;
  likeCount: number;
  bookmarked: boolean;
  commentCount: number;
  comments: CommentItem[];
  onAddReaction: (activityId: string, emoji: string) => void;
  onToggleLike: (activityId: string, liked: boolean) => void;
  onToggleBookmark: (activityId: string) => void;
  onOpenComments: (activityId: string) => void;
  onPress: () => void;
}

function FeedCard({
  item,
  liked,
  likeCount,
  bookmarked,
  commentCount,
  comments,
  onAddReaction,
  onToggleLike,
  onToggleBookmark,
  onOpenComments,
  onPress,
}: Props) {
  const displayName = item.profile.username || item.profile.email;
  const exercises = item.exercise_details || [];
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showHeart, setShowHeart] = useState(false);
  const doubleTapRef = useRef(null);
  const singleTapRef = useRef(null);

  const bodyMapExercises: ExerciseWithSets[] = useMemo(
    () =>
      exercises.map((ex, i) => ({
        id: `${item.id}-${i}`,
        name: ex.name,
        exercise_order: i,
        exercise_type: 'weighted',
        sets:
          ex.total_volume > 0
            ? [
                {
                  id: `${item.id}-${i}-0`,
                  set_number: 1,
                  kg: ex.total_volume,
                  reps: 1,
                  completed: true,
                  set_type: null,
                  isPR: false,
                },
              ]
            : [],
        hasPR: false,
        category: ex.category,
        primary_muscles: ex.primary_muscles,
        secondary_muscles: ex.secondary_muscles,
      })),
    [exercises, item.id],
  );

  const handleDoubleTap = useCallback(
    (event: TapGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.state === State.ACTIVE) {
        if (!liked) {
          onToggleLike(item.id, false);
        }
        setShowHeart(true);
      }
    },
    [item.id, liked, onToggleLike],
  );

  const handleSingleTap = useCallback(
    (event: TapGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.state === State.ACTIVE) {
        onPress();
      }
    },
    [onPress],
  );

  const handleLikeToggle = useCallback(() => {
    onToggleLike(item.id, liked);
  }, [item.id, liked, onToggleLike]);

  const handleBookmarkToggle = useCallback(() => {
    onToggleBookmark(item.id);
  }, [item.id, onToggleBookmark]);

  const handleOpenComments = useCallback(() => {
    onOpenComments(item.id);
  }, [item.id, onOpenComments]);

  const handleSelectReaction = useCallback(
    (emoji: string) => {
      onAddReaction(item.id, emoji);
    },
    [item.id, onAddReaction],
  );

  return (
    <View style={styles.card}>
      <TapGestureHandler
        ref={doubleTapRef}
        numberOfTaps={2}
        onHandlerStateChange={handleDoubleTap}
      >
        <TapGestureHandler
          ref={singleTapRef}
          numberOfTaps={1}
          onHandlerStateChange={handleSingleTap}
          waitFor={doubleTapRef}
        >
          <View>
            {/* Header Row */}
            <View style={styles.header}>
              <AvatarCircle
                username={item.profile.username}
                email={item.profile.email}
                size={sw(36)}
              />
              <View style={styles.headerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {item.streak > 0 && (
                    <View style={styles.streakBadge}>
                      <Text style={styles.streakIcon}>{'\u{1F525}'}</Text>
                      <Text style={styles.streakCount}>{item.streak}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.timestamp}>
                  {formatTimeAgo(item.created_at)}
                </Text>
              </View>
              <View style={styles.chevronWrap}>
                <Ionicons name="ellipsis-horizontal" size={sw(14)} color={colors.textTertiary} />
              </View>
            </View>

            {/* Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.accentBlue + '15' }]}>
                  <Ionicons name="time-outline" size={sw(12)} color={colors.accentBlue} />
                </View>
                <Text style={styles.statText}>{formatDuration(item.duration)}</Text>
              </View>

              <View style={styles.statSep} />

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.accentOrange + '15' }]}>
                  <Ionicons name="barbell-outline" size={sw(12)} color={colors.accentOrange} />
                </View>
                <Text style={styles.statText}>{formatVolume(item.total_volume)}</Text>
              </View>

              <View style={styles.statSep} />

              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: colors.accentGreen + '15' }]}>
                  <Ionicons name="list-outline" size={sw(12)} color={colors.accentGreen} />
                </View>
                <Text style={styles.statText}>{item.total_exercises} exercises</Text>
              </View>
            </View>

            {/* Body Map - Front & Back */}
            <View style={styles.bodyMapSection}>
              <View style={styles.bodyMapFront}>
                <MiniBodyMap exercises={bodyMapExercises} scale={0.45} side="front" />
              </View>
              <View style={styles.bodyMapDivider} />
              <View style={styles.bodyMapBack}>
                <MiniBodyMap exercises={bodyMapExercises} scale={0.45} side="back" />
              </View>
            </View>

            {/* Heart Burst (double-tap) */}
            <HeartBurst visible={showHeart} onFinished={() => setShowHeart(false)} />
          </View>
        </TapGestureHandler>
      </TapGestureHandler>

      {/* Action Row */}
      <FeedActionRow
        activityId={item.id}
        liked={liked}
        likeCount={likeCount}
        bookmarked={bookmarked}
        commentCount={commentCount}
        onToggleLike={handleLikeToggle}
        onToggleBookmark={handleBookmarkToggle}
        onOpenComments={handleOpenComments}
        onSelectReaction={handleSelectReaction}
      />

      {/* Like count */}
      {likeCount > 0 && (
        <Text style={styles.likeCount}>
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </Text>
      )}

      {/* Comment preview */}
      <CommentPreview
        comments={comments}
        totalCount={commentCount}
        onViewAll={handleOpenComments}
      />
    </View>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k kg`;
  return `${vol} kg`;
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default React.memo(FeedCard);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      padding: sw(14),
      marginBottom: sw(10),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },

    /* Header Row */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      marginBottom: sw(12),
    },
    headerInfo: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
      lineHeight: ms(20),
      flexShrink: 1,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.streak + '15',
      borderRadius: sw(10),
      paddingHorizontal: sw(6),
      paddingVertical: sw(2),
      gap: sw(2),
    },
    streakIcon: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
    },
    streakCount: {
      color: colors.streak,
      fontSize: ms(11),
      fontFamily: Fonts.bold,
      lineHeight: ms(15),
    },
    timestamp: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(15),
      marginTop: sw(2),
    },
    chevronWrap: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(10),
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* Stats Strip */
    statsStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: sw(12),
      paddingVertical: sw(9),
      paddingHorizontal: sw(10),
      marginBottom: sw(8),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      flex: 1,
      justifyContent: 'center',
    },
    statIcon: {
      width: sw(22),
      height: sw(22),
      borderRadius: sw(7),
      justifyContent: 'center',
      alignItems: 'center',
    },
    statText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(15),
    },
    statSep: {
      width: 0.5,
      height: sw(18),
      backgroundColor: colors.cardBorder,
    },

    /* Body Map */
    bodyMapSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: sw(6),
      gap: sw(8),
      backgroundColor: colors.background,
      borderRadius: sw(12),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    bodyMapFront: {
      alignItems: 'center',
    },
    bodyMapDivider: {
      width: 0.5,
      height: sw(80),
      backgroundColor: colors.cardBorder,
    },
    bodyMapBack: {
      alignItems: 'center',
    },

    /* Like count */
    likeCount: {
      color: colors.textPrimary,
      fontSize: ms(12),
      fontFamily: Fonts.bold,
      lineHeight: ms(16),
      marginTop: sw(8),
    },
  });
