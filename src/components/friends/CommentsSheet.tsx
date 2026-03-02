import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { CommentItem } from '../../lib/friendsDatabase';
import BottomSheet from '../workout-sheet/BottomSheet';
import CommentRow from './CommentRow';

interface Props {
  activityId: string;
  visible: boolean;
  onClose: () => void;
}

export default function CommentsSheet({ activityId, visible, onClose }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const comments = useFriendsStore((s) => s.comments[activityId] || []);
  const commentsLoading = useFriendsStore((s) => s.commentsLoading);
  const fetchComments = useFriendsStore((s) => s.fetchComments);
  const postComment = useFriendsStore((s) => s.postComment);
  const removeComment = useFriendsStore((s) => s.removeComment);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (visible && activityId) {
      fetchComments(activityId);
    }
  }, [visible, activityId]);

  // Organize into threads: top-level + replies grouped under parent
  const threadedComments = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);
    const replyMap = new Map<string, CommentItem[]>();
    for (const r of replies) {
      const arr = replyMap.get(r.parent_id!) || [];
      arr.push(r);
      replyMap.set(r.parent_id!, arr);
    }

    const result: (CommentItem & { isReply?: boolean })[] = [];
    for (const c of topLevel) {
      result.push(c);
      const childReplies = replyMap.get(c.id) || [];
      for (const r of childReplies) {
        result.push({ ...r, isReply: true });
      }
    }
    return result;
  }, [comments]);

  const handleSend = useCallback(async () => {
    if (!userId || !text.trim()) return;
    await postComment(activityId, userId, text.trim(), replyTo || undefined);
    setText('');
    setReplyTo(null);
  }, [userId, activityId, text, replyTo, postComment]);

  const handleReply = useCallback((commentId: string) => {
    setReplyTo(commentId);
    inputRef.current?.focus();
  }, []);

  const handleDelete = useCallback(
    (commentId: string) => {
      removeComment(commentId, activityId);
    },
    [activityId, removeComment],
  );

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const replyTarget = useMemo(() => {
    if (!replyTo) return null;
    return comments.find((c) => c.id === replyTo) || null;
  }, [replyTo, comments]);

  const renderItem = useCallback(
    ({ item }: { item: CommentItem & { isReply?: boolean } }) => (
      <CommentRow
        comment={item}
        isReply={item.isReply}
        isOwn={item.user_id === userId}
        onReply={handleReply}
        onDelete={item.user_id === userId ? handleDelete : undefined}
      />
    ),
    [userId, handleReply, handleDelete],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} height="70%">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={sw(20)}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Comments</Text>
          {comments.length > 0 && (
            <Text style={styles.count}>{comments.length}</Text>
          )}
        </View>

        {/* Comments list */}
        <View style={styles.listWrap}>
          {commentsLoading && comments.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : threadedComments.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No comments yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation</Text>
            </View>
          ) : (
            <FlashList
              data={threadedComments}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              estimatedItemSize={sw(60)}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Reply indicator */}
        {replyTarget && (
          <View style={styles.replyBar}>
            <Text style={styles.replyText} numberOfLines={1}>
              Replying to{' '}
              <Text style={styles.replyName}>
                {replyTarget.profile.username || replyTarget.profile.email}
              </Text>
            </Text>
            <TouchableOpacity onPress={handleCancelReply} activeOpacity={0.6}>
              <Ionicons name="close" size={ms(16)} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textTertiary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={ms(18)}
              color={text.trim() ? colors.textOnAccent : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: sw(12),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
      gap: sw(6),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
    },
    count: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
    },
    listWrap: {
      flex: 1,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: sw(6),
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(20),
    },
    emptySubtext: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(17),
    },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(16),
      paddingVertical: sw(8),
      backgroundColor: colors.surface,
      borderTopWidth: 0.5,
      borderTopColor: colors.cardBorder,
    },
    replyText: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(17),
      flex: 1,
    },
    replyName: {
      fontFamily: Fonts.bold,
      color: colors.textSecondary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: sw(8),
      paddingHorizontal: sw(12),
      paddingVertical: sw(10),
      borderTopWidth: 0.5,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
      backgroundColor: colors.surface,
      borderRadius: sw(20),
      paddingHorizontal: sw(14),
      paddingVertical: sw(8),
      maxHeight: sw(100),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    sendBtn: {
      width: sw(36),
      height: sw(36),
      borderRadius: sw(18),
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnDisabled: {
      backgroundColor: colors.surface,
    },
  });
