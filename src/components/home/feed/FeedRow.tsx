import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useFriendsStore } from '../../../stores/useFriendsStore';
import type { ActivityFeedItem } from '../../../lib/friendsDatabase';
import FeedWorkoutModal from '../../friends/FeedWorkoutModal';
import { useLingerMount } from '../../../hooks/useLingerMount';
import ReportSheet from '../../friends/ReportSheet';
import { colorForId, displayNameFor, initialFor, formatVolume, formatCount, formatTimeAgo, workoutTitleFor, captionFor, LIKE_EMOJI, reactionTotals } from './feedHelpers';
import WorkoutSummarySlot from './WorkoutSummarySlot';
import PhotoOverviewCarousel from './PhotoOverviewCarousel';

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
  const reportMounted = useLingerMount(reportOpen);
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

      {reportMounted && (
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

export default FeedRow;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
