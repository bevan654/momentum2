import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import EmojiPicker from './EmojiPicker';

interface Props {
  activityId: string;
  liked: boolean;
  likeCount: number;
  bookmarked: boolean;
  commentCount: number;
  onToggleLike: () => void;
  onToggleBookmark: () => void;
  onOpenComments: () => void;
  onSelectReaction: (emoji: string) => void;
}

function FeedActionRow({
  activityId,
  liked,
  likeCount,
  bookmarked,
  commentCount,
  onToggleLike,
  onToggleBookmark,
  onOpenComments,
  onSelectReaction,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const heartScale = useSharedValue(1);

  const handleLikePress = useCallback(() => {
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 4, stiffness: 300 }),
      withTiming(1, { duration: 150 }),
    );
    onToggleLike();
  }, [onToggleLike]);

  const handleLongPress = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      onSelectReaction(emoji);
    },
    [onSelectReaction],
  );

  const handlePickerClose = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out this workout on Momentum!',
      });
    } catch {}
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.leftActions}>
        {/* Like + Emoji Picker */}
        <View>
          <TouchableOpacity
            onPress={handleLikePress}
            onLongPress={handleLongPress}
            delayLongPress={400}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View style={heartAnimStyle}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={ms(22)}
                color={liked ? colors.accentRed : colors.textPrimary}
              />
            </Animated.View>
          </TouchableOpacity>

          {pickerOpen && (
            <EmojiPicker onSelect={handleEmojiSelect} onClose={handlePickerClose} />
          )}
        </View>

        {/* Comment */}
        <TouchableOpacity
          onPress={onOpenComments}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.commentBtn}>
            <Ionicons name="chatbubble-outline" size={ms(20)} color={colors.textPrimary} />
            {commentCount > 0 && (
              <Text style={styles.commentCount}>{commentCount}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="paper-plane-outline" size={ms(20)} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Bookmark */}
      <TouchableOpacity
        onPress={onToggleBookmark}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={bookmarked ? 'bookmark' : 'bookmark-outline'}
          size={ms(20)}
          color={bookmarked ? colors.accent : colors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(FeedActionRow);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: sw(10),
    },
    leftActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(16),
    },
    commentBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    commentCount: {
      color: colors.textSecondary,
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(16),
    },
  });
