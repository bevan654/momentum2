import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';

/* ─── Fake chat messages ─────────────────────────────────── */

const FAKE_CHATS = [
  { from: 'user' as const, text: 'Analyse my training this week' },
  { from: 'ai' as const, text: '4 sessions logged — push/pull split. Chest volume up 12%, back steady. Bench e1RM hit 105kg, a new PR.' },
  { from: 'user' as const, text: 'What should I train tomorrow?' },
  { from: 'ai' as const, text: 'Legs — you haven\'t hit quads in 6 days. Try squats 4×6, RDLs 3×10, then leg press to finish.' },
  { from: 'user' as const, text: 'Should I deload soon?' },
  { from: 'ai' as const, text: 'Week 5 would be ideal. Your RPE has been creeping up but strength is still progressing.' },
];

/* ─── Layout ─────────────────────────────────────────────── */

const CARD_PAD = sw(12);

/* ─── Component ──────────────────────────────────────────── */

type Props = {
  expanded?: boolean;
  onToggle?: () => void;
};

export default function AiHeroCard({ expanded, onToggle }: Props) {
  const colors = useColors();
  const profile = useAuthStore((s) => s.profile);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const firstName = profile?.username?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.card, expanded && styles.cardExpanded]}>
      {/* Greeting + expand toggle */}
      <View style={styles.greetingRow}>
        <View style={[styles.sparkleWrap, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="sparkles" size={ms(14)} color={colors.accent} />
        </View>
        <View style={styles.greetingText}>
          <Text style={styles.greeting}>Hey {firstName}</Text>
          <Text style={styles.subGreeting}>AI assistant</Text>
        </View>
        <Pressable onPress={onToggle} style={styles.expandBtn}>
          <Ionicons
            name={expanded ? 'chevron-back' : 'chevron-forward'}
            size={ms(14)}
            color={colors.textTertiary}
          />
        </Pressable>
      </View>

      {/* Fake chat messages */}
      <View style={styles.chatArea}>
        {FAKE_CHATS.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.from === 'user' ? styles.bubbleUser : styles.bubbleAi,
              msg.from === 'user'
                ? { backgroundColor: colors.accent }
                : { backgroundColor: colors.surface },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                msg.from === 'user'
                  ? { color: colors.textOnAccent }
                  : { color: colors.textPrimary },
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ))}
      </View>

      {/* AI input (non-functional) */}
      <Pressable style={styles.inputRow}>
        <View style={styles.inputField}>
          <Text style={styles.placeholder}>Ask anything...</Text>
        </View>
        <View style={[styles.sendBtn, { backgroundColor: colors.accent }]}>
          <Ionicons name="send" size={ms(12)} color={colors.textOnAccent} />
        </View>
      </Pressable>

      {/* Premium gradient overlay */}
      <LinearGradient
        colors={['transparent', colors.card + '30', colors.card + '60', colors.card + '90', colors.card + 'B0']}
        locations={[0, 0.15, 0.4, 0.7, 1]}
        style={styles.gradientOverlay}
        pointerEvents="box-none"
      >
        <View style={[styles.proBadge, { backgroundColor: colors.accent }]}>
          <Ionicons name="lock-closed" size={ms(10)} color={colors.textOnAccent} />
          <Text style={[styles.proText, { color: colors.textOnAccent }]}>PRO</Text>
        </View>
        <Text style={styles.proSubtext}>Unlock AI coaching</Text>
      </LinearGradient>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 65,
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: CARD_PAD,
      paddingBottom: CARD_PAD,
      gap: sw(4),
      ...colors.cardShadow,
    },

    cardExpanded: {
      flex: 1,
    },

    /* Greeting */
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

    /* Chat */
    chatArea: {
      flex: 1,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      gap: sw(4),
    },
    bubble: {
      maxWidth: '85%',
      borderRadius: sw(10),
      paddingHorizontal: sw(8),
      paddingVertical: sw(5),
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: sw(3),
    },
    bubbleAi: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: sw(3),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    bubbleText: {
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },

    /* Input */
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      marginTop: sw(0),
    },
    inputField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: sw(14),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
    },
    placeholder: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    sendBtn: {
      width: sw(24),
      height: sw(24),
      borderRadius: sw(12),
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Premium overlay */
    gradientOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      top: sw(50),
      paddingBottom: sw(14),
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: sw(6),
    },
    proBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      paddingHorizontal: sw(12),
      paddingVertical: sw(5),
      borderRadius: sw(12),
    },
    proText: {
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: 1,
    },
    proSubtext: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },
  });
