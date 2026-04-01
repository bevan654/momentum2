import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { ConversationSummary } from '../../lib/chatDatabase';
import AvatarCircle from '../friends/AvatarCircle';

interface Props {
  conversation: ConversationSummary;
  currentUserId: string;
  onPress: () => void;
}

function ConversationRow({ conversation, currentUserId, onPress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasUnread = conversation.unreadCount > 0;

  const displayName = conversation.friendUsername || conversation.friendEmail;

  const preview = useMemo(() => {
    if (!conversation.lastMessageText) return 'Tap to start chatting';
    const isOwn = conversation.lastMessageSender === currentUserId;
    const prefix = isOwn ? 'You: ' : '';
    const full = prefix + conversation.lastMessageText;
    return full.length > 50 ? full.slice(0, 50) + '...' : full;
  }, [conversation.lastMessageText, conversation.lastMessageSender, currentUserId]);

  const timeLabel = useMemo(() => {
    if (!conversation.lastMessageAt) return '';
    return formatRelativeTime(conversation.lastMessageAt);
  }, [conversation.lastMessageAt]);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <AvatarCircle
        username={conversation.friendUsername}
        email={conversation.friendEmail}
        size={sw(48)}
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, hasUnread && styles.nameBold]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeUnread]}>
            {timeLabel}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread && <View style={styles.dot} />}
        </View>
        <View style={styles.separator} />
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(ConversationRow);

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  const diffW = Math.floor(diffD / 7);
  return `${diffW}w`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
      paddingBottom: sw(2),
      gap: sw(12),
    },
    content: {
      flex: 1,
      gap: sw(3),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(20),
      flex: 1,
      marginRight: sw(8),
    },
    nameBold: {
      fontFamily: Fonts.bold,
    },
    time: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.regular,
      lineHeight: ms(16),
    },
    timeUnread: {
      color: colors.accent,
      fontFamily: Fonts.semiBold,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    preview: {
      color: colors.textTertiary,
      fontSize: ms(13),
      fontFamily: Fonts.regular,
      lineHeight: ms(18),
      flex: 1,
    },
    previewUnread: {
      color: colors.textSecondary,
      fontFamily: Fonts.medium,
    },
    dot: {
      width: sw(9),
      height: sw(9),
      borderRadius: sw(4.5),
      backgroundColor: colors.accent,
      marginLeft: sw(8),
    },
    separator: {
      height: 0.5,
      backgroundColor: colors.cardBorder,
      marginTop: sw(10),
    },
  });
