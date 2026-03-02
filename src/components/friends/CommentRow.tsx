import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { CommentItem } from '../../lib/friendsDatabase';
import AvatarCircle from './AvatarCircle';

interface Props {
  comment: CommentItem;
  isReply?: boolean;
  isOwn?: boolean;
  onReply: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

function CommentRow({ comment, isReply, isOwn, onReply, onDelete }: Props) {
  const displayName = comment.profile.username || comment.profile.email;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.row, isReply && styles.replyRow]}>
      <AvatarCircle
        username={comment.profile.username}
        email={comment.profile.email}
        size={isReply ? sw(24) : sw(30)}
      />
      <View style={styles.content}>
        <Text style={styles.textLine}>
          <Text style={styles.username}>{displayName} </Text>
          <Text style={styles.commentText}>{comment.text}</Text>
        </Text>
        <View style={styles.meta}>
          <Text style={styles.time}>{formatTimeAgo(comment.created_at)}</Text>
          <TouchableOpacity onPress={() => onReply(comment.id)} activeOpacity={0.6}>
            <Text style={styles.replyBtn}>Reply</Text>
          </TouchableOpacity>
          {isOwn && onDelete && (
            <TouchableOpacity onPress={() => onDelete(comment.id)} activeOpacity={0.6}>
              <Text style={styles.deleteBtn}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default React.memo(CommentRow);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: sw(10),
      paddingVertical: sw(8),
      paddingHorizontal: sw(16),
    },
    replyRow: {
      paddingLeft: sw(56),
    },
    content: {
      flex: 1,
    },
    textLine: {
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
      color: colors.textPrimary,
    },
    username: {
      fontFamily: Fonts.bold,
    },
    commentText: {
      fontFamily: Fonts.medium,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      marginTop: sw(4),
    },
    time: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(15),
    },
    replyBtn: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.bold,
      lineHeight: ms(15),
    },
    deleteBtn: {
      color: colors.accentRed,
      fontSize: ms(11),
      fontFamily: Fonts.bold,
      lineHeight: ms(15),
    },
  });
