import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useChatStore } from '../../stores/useChatStore';
import type { ConversationSummary } from '../../lib/chatDatabase';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import ConversationRow from './ConversationRow';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export default function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const userId = useAuthStore((s) => s.user?.id);
  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.conversationsLoading);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) {
      fetchConversations(userId, true);
    }
  }, [userId]);

  const handleRefresh = useCallback(() => {
    if (userId) fetchConversations(userId, true);
  }, [userId, fetchConversations]);

  const handleOpenChat = useCallback(
    (conv: ConversationSummary) => {
      navigation.navigate('Chat', {
        conversationId: conv.id,
        friendId: conv.friendId,
        friendName: conv.friendUsername || conv.friendEmail,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationSummary }) => (
      <ConversationRow
        conversation={item}
        currentUserId={userId || ''}
        onPress={() => handleOpenChat(item)}
      />
    ),
    [userId, handleOpenChat],
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
        <Text style={styles.title}>Messages</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Conversation list */}
      {conversations.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={ms(48)} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Message a friend from their profile
          </Text>
        </View>
      ) : (
        <FlashList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={sw(74)}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={handleRefresh}
              tintColor={colors.textSecondary}
            />
          }
        />
      )}
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
      paddingVertical: sw(12),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      width: sw(40),
      height: sw(40),
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(18),
      fontFamily: Fonts.bold,
      lineHeight: ms(24),
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: sw(8),
      paddingBottom: sw(80),
    },
    emptyTitle: {
      color: colors.textSecondary,
      fontSize: ms(16),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(22),
      marginTop: sw(8),
    },
    emptySubtext: {
      color: colors.textTertiary,
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
    },
  });
