import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { FriendProfile } from '../../lib/friendsDatabase';

const NUDGE_MESSAGES = [
  { emoji: '\u{1F4AA}', text: 'Time to hit the gym!' },
  { emoji: '\u{1F624}', text: 'Your muscles miss you!' },
  { emoji: '\u{1F3CB}\u{FE0F}', text: "Don't skip today!" },
  { emoji: '\u{1F680}', text: 'No excuses today!' },
  { emoji: '\u{1F525}', text: "Let's get moving!" },
  { emoji: '\u{1F511}', text: 'Consistency is key!' },
  { emoji: '\u{1F4A5}', text: "Let's crush it!" },
  { emoji: '\u{26A1}', text: 'Rise and grind!' },
];

interface Props {
  friend: FriendProfile;
  onClose: () => void;
}

export default function NudgeModal({ friend, onClose }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const sendNudge = useFriendsStore((s) => s.sendNudge);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSend = async (message: string) => {
    if (!userId) return;
    const { error } = await sendNudge(userId, friend.id, message);
    if (error) {
      Alert.alert('Cannot Nudge', error);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.handle} />
          <Text style={styles.title}>
            Nudge {friend.username || friend.email}
          </Text>

          {/* Messages */}
          {NUDGE_MESSAGES.map((msg) => (
            <TouchableOpacity
              key={msg.emoji}
              style={styles.messageRow}
              onPress={() => handleSend(`${msg.emoji} ${msg.text}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{msg.emoji}</Text>
              <Text style={styles.messageText}>{msg.text}</Text>
              <Ionicons name="send-outline" size={ms(14)} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '88%',
    maxHeight: '60%',
    backgroundColor: colors.card,
    borderRadius: sw(20),
    paddingBottom: sw(16),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  handle: {
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.cardBorder,
    alignSelf: 'center',
    marginTop: sw(12),
    marginBottom: sw(14),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.bold,
    lineHeight: ms(23),
    textAlign: 'center',
    marginBottom: sw(14),
    paddingHorizontal: sw(16),
    letterSpacing: -0.2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(14),
    paddingVertical: sw(12),
    gap: sw(12),
    marginHorizontal: sw(12),
    borderRadius: sw(12),
    backgroundColor: colors.surface,
    marginBottom: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emoji: {
    fontSize: ms(20),
    fontFamily: Fonts.medium,
    lineHeight: ms(25),
  },
  messageText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
  },
});
