import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import { setViewingChat } from '../../services/chatService';
import type { ChatMessage } from '../../lib/chatDatabase';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import MessageBubble from './MessageBubble';
import ChatInputBar from './ChatInputBar';
import AvatarCircle from '../friends/AvatarCircle';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'Chat'>;
type Route = RouteProp<CommunityStackParamList, 'Chat'>;

export default function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { conversationId, friendId, friendName } = route.params;

  const userId = useAuthStore((s) => s.user?.id);
  const messages = useChatStore((s) => s.messages[conversationId] || []);
  const loading = useChatStore((s) => s.messagesLoading);
  const hasMore = useChatStore((s) => s.messagesHasMore[conversationId] !== false);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markConversationRead = useChatStore((s) => s.markConversationRead);

  const insets = useSafeAreaInsets();
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

  // Find last own message to show read receipt
  const lastOwnMessageId = useMemo(() => {
    for (const m of messages) {
      if (m.sender_id === userId && !m.pending) return m.id;
    }
    return null;
  }, [messages, userId]);

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isOwn = item.sender_id === userId;
      // In an inverted list, index 0 is the newest message
      // "next" in display order is index + 1 (the message visually above)
      const nextMsg = messages[index + 1];
      const isLastInGroup = !nextMsg || nextMsg.sender_id !== item.sender_id;

      // Show timestamp on last message in a group
      const showTimestamp = isLastInGroup;

      // Show "Read" below the user's last sent message if it's been read
      const showReadReceipt =
        isOwn && item.id === lastOwnMessageId && item.read;

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <AvatarCircle
            username={friendName}
            email={friendName}
            size={sw(32)}
          />
          <Text style={styles.headerName} numberOfLines={1}>
            {friendName}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Messages */}
      <View style={styles.messagesWrap}>
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Say hello!</Text>
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

      {/* Input */}
      <ChatInputBar onSend={handleSend} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(8),
      paddingVertical: sw(10),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      width: sw(40),
      height: sw(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      flex: 1,
      justifyContent: 'center',
    },
    headerName: {
      color: colors.textPrimary,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
    },
    messagesWrap: {
      flex: 1,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
    },
    listContent: {
      paddingTop: sw(8),
      paddingBottom: sw(8),
    },
  });
