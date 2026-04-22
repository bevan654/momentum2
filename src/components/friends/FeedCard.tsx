import React, { useCallback, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import type { TapGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { ActivityFeedItem } from '../../lib/friendsDatabase';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import AvatarCircle from './AvatarCircle';
import FeedActionRow from './FeedActionRow';
import HeartBurst from './HeartBurst';
import MiniBodyMap from '../body/MiniBodyMap';

const MAX_EXERCISES_SHOWN = 6;

interface Props {
  item: ActivityFeedItem;
  liked: boolean;
  likeCount: number;
  bookmarked: boolean;
  onAddReaction: (activityId: string, emoji: string) => void;
  onToggleLike: (activityId: string, liked: boolean) => void;
  onToggleBookmark: (activityId: string) => void;
  onPress: () => void;
}

function FeedCard({
  item,
  liked,
  likeCount,
  bookmarked,
  onAddReaction,
  onToggleLike,
  onToggleBookmark,
  onPress,
}: Props) {
  const displayName = item.profile.username || item.profile.email;
  const exercises = item.exercise_details || [];
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showHeart, setShowHeart] = useState(false);
  const doubleTapRef = useRef(null);
  const singleTapRef = useRef(null);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const friendIds = useFriendsStore((s) => s.friendIds);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);
  const isSelf = currentUserId === item.user_id;
  const isFriend = friendIds.includes(item.user_id);
  const [requestSent, setRequestSent] = useState(false);

  const handleAddFriend = useCallback(() => {
    if (!currentUserId || isSelf || isFriend || requestSent) return;
    sendFriendRequest(currentUserId, item.user_id);
    setRequestSent(true);
  }, [currentUserId, item.user_id, isSelf, isFriend, requestSent, sendFriendRequest]);

  const bodyColors = useMemo(() => [
    '#1A1A1E', '#2A2A2E', colors.accent + '50', colors.accent + '80', colors.accent + 'CC', colors.accent, colors.accent,
  ], [colors.accent]);

  const visibleExercises = exercises.slice(0, MAX_EXERCISES_SHOWN);
  const extraCount = exercises.length - MAX_EXERCISES_SHOWN;

  const bodyMapExercises: ExerciseWithSets[] = useMemo(
    () =>
      exercises.map((ex, i) => ({
        id: `${item.id}-${i}`,
        name: ex.name,
        exercise_order: i,
        exercise_type: 'weighted',
        sets:
          ex.total_volume > 0
            ? [{ id: `${item.id}-${i}-0`, set_number: 1, kg: ex.total_volume, reps: 1, completed: true, set_type: null, parent_set_number: null, isPR: false }]
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
        if (!liked) onToggleLike(item.id, false);
        setShowHeart(true);
      }
    },
    [item.id, liked, onToggleLike],
  );

  const handleSingleTap = useCallback(
    (event: TapGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.state === State.ACTIVE) onPress();
    },
    [onPress],
  );

  const handleLikeToggle = useCallback(() => {
    onToggleLike(item.id, liked);
  }, [item.id, liked, onToggleLike]);

  const handleBookmarkToggle = useCallback(() => {
    onToggleBookmark(item.id);
  }, [item.id, onToggleBookmark]);

  const handleSelectReaction = useCallback(
    (emoji: string) => { onAddReaction(item.id, emoji); },
    [item.id, onAddReaction],
  );

  return (
    <View style={styles.card}>
      <TapGestureHandler ref={doubleTapRef} numberOfTaps={2} onHandlerStateChange={handleDoubleTap}>
        <TapGestureHandler ref={singleTapRef} numberOfTaps={1} onHandlerStateChange={handleSingleTap} waitFor={doubleTapRef}>
          <View>
            {/* Header */}
            <View style={styles.header}>
              <AvatarCircle username={item.profile.username} email={item.profile.email} size={sw(32)} />
              <View style={styles.headerInfo}>
                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                <View style={styles.subRow}>
                  <Text style={styles.timestamp}>{formatTimeAgo(item.created_at)}</Text>
                  {item.streak > 0 && (
                    <>
                      <Text style={styles.subDot}>·</Text>
                      <Ionicons name="flame" size={ms(10)} color={colors.textSecondary} />
                      <Text style={styles.streakText}>{item.streak}</Text>
                    </>
                  )}
                </View>
                {item.routine_name && !item.program_name && (
                  <View style={styles.programRow}>
                    <View style={[styles.programTag, styles.routineTag]}>
                      <Text style={[styles.programTagText, styles.routineTagText]}>ROUTINE</Text>
                    </View>
                    <Text style={styles.programName} numberOfLines={1}>{item.routine_name}</Text>
                  </View>
                )}
                {item.program_name && (
                  <View style={styles.programRow}>
                    <View style={styles.programTag}>
                      <Text style={styles.programTagText}>PROGRAM</Text>
                    </View>
                    <Text style={styles.programName} numberOfLines={1}>{item.program_name}</Text>
                    {item.program_week && (
                      <Text style={styles.programMeta}>
                        Week {item.program_week}{item.program_total_weeks ? `/${item.program_total_weeks}` : ''}
                        {item.program_day_label ? ` · ${item.program_day_label}` : ''}
                      </Text>
                    )}
                  </View>
                )}
                {item.ghost_username && item.ghost_result && (
                  <Text style={[styles.challengeText, {
                    color: item.ghost_result === 'victory' ? '#34C759' : item.ghost_result === 'defeated' ? colors.accentRed : colors.textTertiary,
                    marginTop: sw(3),
                  }]}>
                    {isSelf ? 'You' : displayName} challenged {item.ghost_username} — {item.ghost_result === 'victory' ? 'Won' : item.ghost_result === 'defeated' ? 'Lost' : 'Draw'}
                  </Text>
                )}
              </View>
              {isSelf && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
              {!isSelf && (
                isFriend ? (
                  <View style={styles.friendBadge}>
                    <Ionicons name="checkmark" size={ms(12)} color={colors.accentGreen} />
                    <Text style={styles.friendBadgeText}>Friends</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.addFriendBtn, requestSent && styles.addFriendBtnSent]}
                    onPress={handleAddFriend}
                    activeOpacity={0.7}
                    disabled={requestSent}
                  >
                    <Ionicons
                      name={requestSent ? 'checkmark' : 'person-add-outline'}
                      size={ms(12)}
                      color={requestSent ? colors.accentGreen : colors.accent}
                    />
                    <Text style={[styles.addFriendText, requestSent && styles.addFriendTextSent]}>
                      {requestSent ? 'Sent' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <View style={styles.divider} />

            {/* Body map */}
            <View style={styles.bodyMapRow}>
              <MiniBodyMap exercises={bodyMapExercises} scale={0.3} side="front" colors={bodyColors} />
              <MiniBodyMap exercises={bodyMapExercises} scale={0.3} side="back" colors={bodyColors} />
            </View>

            {/* Exercise list */}
            {visibleExercises.map((ex, i) => {
              const best = ex.best_kg > 0
                ? `${ex.best_kg}kg x ${ex.best_reps}`
                : ex.best_reps > 0
                  ? `${ex.best_reps} reps`
                  : null;
              return (
                <View key={i}>
                  {i > 0 && <View style={styles.exSep} />}
                  <View style={styles.exRow}>
                    <Text style={styles.exName} numberOfLines={1}>
                      {ex.name.replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                    <Text style={styles.exDetail}>
                      {ex.sets_count > 0 ? `${ex.sets_count} sets` : ''}{best ? ` · ${best}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
            {extraCount > 0 && (
              <>
                <View style={styles.exSep} />
                <Text style={styles.moreText}>+{extraCount} more</Text>
              </>
            )}

            {/* Stats chips */}
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="time-outline" size={ms(11)} color={colors.accent} />
                <Text style={styles.statChipText}>{formatDuration(item.duration)}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="barbell-outline" size={ms(11)} color={colors.accent} />
                <Text style={styles.statChipText}>{formatVolume(item.total_volume)}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="fitness-outline" size={ms(11)} color={colors.accent} />
                <Text style={styles.statChipText}>{item.total_sets} sets</Text>
              </View>
            </View>

            <HeartBurst visible={showHeart} onFinished={() => setShowHeart(false)} />
          </View>
        </TapGestureHandler>
      </TapGestureHandler>

      <FeedActionRow
        activityId={item.id}
        liked={liked}
        likeCount={likeCount}
        bookmarked={bookmarked}
        onToggleLike={handleLikeToggle}
        onToggleBookmark={handleBookmarkToggle}
        onSelectReaction={handleSelectReaction}
      />

      {likeCount > 0 && (
        <Text style={styles.likeCount}>
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </Text>
      )}
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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default React.memo(FeedCard);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(14),
      marginBottom: sw(10),
    },

    /* Header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      marginBottom: sw(12),
    },
    headerInfo: { flex: 1 },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      marginTop: sw(2),
    },
    subDot: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.regular,
    },
    streakText: {
      color: colors.textSecondary,
      fontSize: ms(10),
      fontFamily: Fonts.regular,
      lineHeight: ms(13),
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
      lineHeight: ms(18),
      flexShrink: 1,
    },
    youBadge: {
      paddingHorizontal: sw(8),
      paddingVertical: sw(4),
      borderRadius: sw(6),
      backgroundColor: colors.accent + '15',
    },
    youBadgeText: {
      color: colors.accent,
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(13),
    },
    friendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      paddingHorizontal: sw(8),
      paddingVertical: sw(4),
      borderRadius: sw(6),
      backgroundColor: colors.accentGreen + '12',
    },
    friendBadgeText: {
      color: colors.accentGreen,
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(13),
    },
    addFriendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      paddingHorizontal: sw(8),
      paddingVertical: sw(4),
      borderRadius: sw(6),
      borderWidth: 1,
      borderColor: colors.accent + '40',
    },
    addFriendBtnSent: {
      borderColor: colors.accentGreen + '40',
      backgroundColor: colors.accentGreen + '08',
    },
    addFriendText: {
      color: colors.accent,
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(13),
    },
    addFriendTextSent: { color: colors.accentGreen },
    timestamp: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.regular,
      lineHeight: ms(13),
    },

    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginBottom: sw(12),
      marginHorizontal: -sw(14),
    },
    programRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: sw(5),
      marginTop: sw(4),
    },
    programTag: {
      backgroundColor: colors.accent + '20',
      paddingHorizontal: sw(5),
      paddingVertical: sw(1),
    },
    programTagText: {
      color: colors.accent,
      fontSize: ms(8),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
    },
    programName: {
      color: colors.textPrimary,
      fontSize: ms(11),
      fontFamily: Fonts.bold,
      flexShrink: 1,
    },
    routineTag: {
      backgroundColor: colors.accentOrange + '20',
    },
    routineTagText: {
      color: colors.accentOrange,
    },
    programMeta: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
    },
    challengeText: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(13),
    },

    /* Stats chips */
    statsRow: {
      flexDirection: 'row',
      gap: sw(6),
      marginTop: sw(10),
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      backgroundColor: colors.accent + '10',
      paddingHorizontal: sw(8),
      paddingVertical: sw(5),
      borderRadius: 0,
    },
    statChipText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(14),
    },

    /* Body map */
    bodyMapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      marginBottom: sw(14),
    },

    /* Exercise list */
    exSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
    },
    exRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: sw(8),
    },
    exName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
      marginRight: sw(10),
    },
    exDetail: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(13),
    },
    moreText: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
      paddingVertical: sw(6),
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
