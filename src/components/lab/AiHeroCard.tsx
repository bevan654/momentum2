import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import AiCoachChatModal from './AiCoachChatModal';
import { useAiCoachChat, type ChatMessage } from './useAiCoachChat';

const PLACEHOLDER_MESSAGES: ChatMessage[] = [
  { role: 'user', content: 'What should I train tomorrow?' },
  {
    role: 'assistant',
    content:
      "Legs — you haven't hit quads in 5 days. Squats 4×6 @ 100kg, RDLs 3×10, finish with leg press.",
  },
  { role: 'user', content: 'Should I deload soon?' },
  {
    role: 'assistant',
    content: 'Week 5 is the right time. RPE is creeping but PRs are still landing.',
  },
  { role: 'user', content: 'Compare this week to last' },
  {
    role: 'assistant',
    content: '4 sessions, 18.2k kg volume — up 12% from last week. Bench e1RM hit a new PR.',
  },
];

const CARD_PAD = sw(12);

/** Recovery-tab AI coach preview card; tapping it opens the full chat (AiCoachChatModal). */
export default function AiHeroCard() {
  const colors = useColors();
  const username = useAuthStore((s) => s.profile?.username);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [open, setOpen] = useState(false);
  const chat = useAiCoachChat();
  const { messages } = chat;
  const handleClose = useCallback(() => setOpen(false), []);

  const firstName = username?.split(' ')[0] ?? 'there';
  const latestMsg = messages[messages.length - 1];

  return (
    <>
      <Pressable style={styles.card} onPress={() => setOpen(true)}>
        <View style={styles.greetingRow}>
          <View style={[styles.sparkleWrap, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="sparkles" size={ms(14)} color={colors.accent} />
          </View>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>Hey {firstName}</Text>
            <Text style={styles.subGreeting}>AI coach</Text>
          </View>
          <View style={styles.expandBtn}>
            <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
          </View>
        </View>

        <View
          style={[
            styles.previewArea,
            messages.length === 0 && styles.previewAreaPlaceholder,
          ]}
        >
          {(messages.length > 0 ? messages.slice(-8) : PLACEHOLDER_MESSAGES).map((m, i) => (
            <View
              key={i}
              style={[
                styles.previewBubble,
                m.role === 'user' ? styles.previewBubbleUser : styles.previewBubbleAi,
                m.role === 'user'
                  ? { backgroundColor: colors.accent }
                  : { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.previewBubbleText,
                  m.role === 'user'
                    ? { color: colors.textOnAccent }
                    : { color: colors.textPrimary },
                ]}
                numberOfLines={2}
              >
                {m.content}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.tapCta}>
          <Text style={styles.tapCtaText}>
            {latestMsg ? 'Continue chat' : 'Start chat'}
          </Text>
          <Ionicons name="arrow-forward" size={ms(11)} color={colors.accent} />
        </View>
      </Pressable>

      <AiCoachChatModal visible={open} onClose={handleClose} chat={chat} />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 65,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: CARD_PAD,
      gap: sw(8),
      ...colors.cardShadow,
    },

    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    greetingText: {
      flex: 1,
    },
    expandBtn: {
      width: sw(26),
      height: sw(26),
      borderRadius: sw(13),
      backgroundColor: colors.surface,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sparkleWrap: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(8),
      alignItems: 'center',
      justifyContent: 'center',
    },
    greeting: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.bold,
    },
    subGreeting: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },

    previewArea: {
      flex: 1,
      justifyContent: 'flex-end',
      gap: sw(3),
      overflow: 'hidden',
    },
    previewAreaPlaceholder: {
      opacity: 0.55,
    },
    previewBubble: {
      maxWidth: '92%',
      borderRadius: sw(8),
      paddingHorizontal: sw(7),
      paddingVertical: sw(4),
    },
    previewBubbleUser: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: sw(2),
    },
    previewBubbleAi: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: sw(2),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    previewBubbleText: {
      fontSize: ms(9.5),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    tapCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      marginTop: sw(2),
    },
    tapCtaText: {
      color: colors.accent,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
    },
  });
