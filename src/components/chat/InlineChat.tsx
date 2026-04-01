import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { setViewingChat } from '../../services/chatService';
import type { ChatMessage } from '../../lib/chatDatabase';
import MessageBubble from './MessageBubble';
import ChatInputBar from './ChatInputBar';
import AvatarCircle from '../friends/AvatarCircle';

interface Props {
  conversationId: string;
  friendId: string;
  friendName: string;
  onBack: () => void;
}

function InlineChat({ conversationId, friendId, friendName, onBack }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const messages = useChatStore((s) => s.messages[conversationId] || []);
  const loading = useChatStore((s) => s.messagesLoading);
  const hasMore = useChatStore((s) => s.messagesHasMore[conversationId] !== false);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markConversationRead = useChatStore((s) => s.markConversationRead);

  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // On mount: fetch messages, mark read, set viewing
  useEffect(() => {
    fetchMessages(conversationId, true);
    if (userId) {
      markConversationRead(conversationId, userId);
    }
    setViewingChat(conversationId);
    return () => {
      setViewingChat(null);
    };
  }, [conversationId, userId]);

  // Mark read when new messages arrive
  useEffect(() => {
    if (userId && messages.length > 0) {
      const hasUnread = messages.some((m) => !m.read && m.sender_id !== userId);
      if (hasUnread) {
        markConversationRead(conversationId, userId);
      }
    }
  }, [messages.length]);

  const handleSend = useCallback(
    (text: string) => {
      if (!userId) return;
      sendMessage(conversationId, userId, text, friendId);
    },
    [userId, conversationId, friendId, sendMessage],
  );

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchMessages(conversationId);
    }
  }, [loading, hasMore, conversationId, fetchMessages]);

  // Find last own message to show read receipt (newest is at end in ascending order)
  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === userId && !messages[i].pending) return messages[i].id;
    }
    return null;
  }, [messages, userId]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isOwn = item.sender_id === userId;
      const nextMsg = messages[index + 1];
      const isLastInGroup = !nextMsg || nextMsg.sender_id !== item.sender_id;
      const showTimestamp = isLastInGroup;
      const showReadReceipt = isOwn && item.id === lastOwnMessageId && item.read;

      return (
        <MessageBubble
          message={item}
          isOwn={isOwn}
          showReadReceipt={showReadReceipt}
          isLastInGroup={isLastInGroup}
          showTimestamp={showTimestamp}
        />
      );
    },
    [userId, messages, lastOwnMessageId],
  );

  return (
    <View style={styles.container}>
      {/* Chat header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <AvatarCircle username={friendName} email={friendName} size={sw(28)} />
          <Text style={styles.headerName} numberOfLines={1}>
            {friendName}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Messages list */}
      <View style={styles.messages}>
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <AvatarCircle username={friendName} email={friendName} size={sw(56)} />
            <Text style={styles.emptyName}>{friendName}</Text>
            <Text style={styles.emptyText}>Send a message to start the conversation</Text>
          </View>
        ) : (
          <FlashList
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={sw(60)}
            inverted
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Input bar */}
      <ChatInputBar onSend={handleSend} />
    </View>
  );
}

export default React.memo(InlineChat);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(8),
      paddingVertical: sw(10),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      width: sw(32),
      height: sw(32),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
    },
    headerName: {
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.bold,
      lineHeight: ms(20),
    },
    messages: {
      flex: 1,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: sw(6),
      paddingBottom: sw(40),
    },
    emptyName: {
      color: colors.textPrimary,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
      marginTop: sw(8),
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(13),
      fontFamily: Fonts.regular,
      lineHeight: ms(18),
    },
    listContent: {
      paddingTop: sw(10),
      paddingBottom: sw(10),
    },
  });
