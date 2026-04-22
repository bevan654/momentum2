import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView as RNScrollView,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../lib/supabase';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'Analyse my training this week',
  'What should I train tomorrow?',
  'Should I deload soon?',
  'Compare this week to last week',
];

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

export default function AiHeroCard() {
  const colors = useColors();
  const profile = useAuthStore((s) => s.profile);
  const userId = useAuthStore((s) => s.user?.id);
  const aiCoachEnabled = useAuthStore((s) => s.profile?.ai_coach_enabled ?? false);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<RNScrollView | null>(null);

  const firstName = profile?.username?.split(' ')[0] ?? 'there';
  const latestMsg = messages[messages.length - 1];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('ai_coach_messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (cancelled || !data) return;
      setMessages(
        data.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(next);
      setInput('');

      if (!aiCoachEnabled) {
        setMessages([
          ...next,
          {
            role: 'assistant',
            content:
              "AI coach isn't enabled for your account yet. Reach out to the Momentum team to request early access.",
          },
        ]);
        return;
      }

      setLoading(true);

      if (userId) {
        supabase
          .from('ai_coach_messages')
          .insert({ user_id: userId, role: 'user', content: trimmed })
          .then(() => {})
          .catch(() => {});
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (!session?.access_token) {
          setMessages([...next, { role: 'assistant', content: 'You need to be signed in.' }]);
          return;
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60_000);

        const res = await fetch(`${supabaseUrl}/functions/v1/ai-coach`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ messages: next }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const err = await res.text();
          console.log('[AiCoach] HTTP', res.status, err.slice(0, 200));
          setMessages([
            ...next,
            { role: 'assistant', content: 'Sorry, I hit an error. Try again in a moment.' },
          ]);
          return;
        }

        const payload = await res.json();
        const reply = typeof payload?.message === 'string' ? payload.message.trim() : '';
        if (!reply) {
          setMessages([...next, { role: 'assistant', content: 'No reply generated. Try rephrasing.' }]);
          return;
        }
        setMessages([...next, { role: 'assistant', content: reply }]);
        if (userId) {
          supabase
            .from('ai_coach_messages')
            .insert({ user_id: userId, role: 'assistant', content: reply })
            .then(() => {})
            .catch(() => {});
        }
      } catch (err: any) {
        console.log('[AiCoach] fetch failed:', err?.message || err);
        setMessages([...next, { role: 'assistant', content: 'Network issue. Try again.' }]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, userId, aiCoachEnabled],
  );

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => cancelAnimationFrame(id);
  }, [messages, loading, open]);

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

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalSparkle, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="sparkles" size={ms(16)} color={colors.accent} />
            </View>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>AI Coach</Text>
              <Text style={styles.modalSubtitle}>Powered by your training data</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={ms(18)} color={colors.textPrimary} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.modalBody}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              ref={scrollRef as any}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && !loading ? (
                <View style={styles.starters}>
                  <Text style={styles.startersLabel}>Try asking:</Text>
                  {STARTERS.map((s) => (
                    <Pressable
                      key={s}
                      style={styles.starterPill}
                      onPress={() => sendMessage(s)}
                    >
                      <Text style={styles.starterText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi,
                    msg.role === 'user'
                      ? { backgroundColor: colors.accent }
                      : { backgroundColor: colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === 'user'
                        ? { color: colors.textOnAccent }
                        : { color: colors.textPrimary },
                    ]}
                    selectable
                  >
                    {msg.content}
                  </Text>
                </View>
              ))}

              {loading ? (
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleAi,
                    { backgroundColor: colors.surface, paddingVertical: sw(10) },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.accent} />
                </View>
              ) : null}
            </ScrollView>

            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, sw(10)) }]}>
              <View style={styles.inputField}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask anything..."
                  placeholderTextColor={colors.textTertiary}
                  value={input}
                  onChangeText={setInput}
                  returnKeyType="send"
                  editable={!loading}
                  multiline
                  onSubmitEditing={() => sendMessage(input)}
                />
              </View>
              <Pressable
                onPress={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                style={[
                  styles.sendBtn,
                  { backgroundColor: colors.accent, opacity: input.trim() && !loading ? 1 : 0.4 },
                ]}
              >
                <Ionicons name="arrow-up" size={ms(18)} color={colors.textOnAccent} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors, insetTop: number, insetBottom: number) =>
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
    hintText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
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
      fontFamily: Fonts.semibold,
    },

    modalRoot: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingHorizontal: sw(16),
      paddingTop: Platform.OS === 'android' ? insetTop + sw(12) : sw(12),
      paddingBottom: sw(12),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    modalSparkle: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(10),
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitleWrap: {
      flex: 1,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
    },
    modalSubtitle: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    closeBtn: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(16),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    modalBody: {
      flex: 1,
    },
    chatArea: {
      flex: 1,
      paddingHorizontal: sw(16),
    },
    chatContent: {
      gap: sw(8),
      paddingTop: sw(14),
      paddingBottom: sw(14),
    },

    starters: {
      gap: sw(8),
      alignItems: 'flex-start',
      paddingBottom: sw(8),
    },
    startersLabel: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginBottom: sw(2),
    },
    starterPill: {
      backgroundColor: colors.surface,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(14),
      paddingVertical: sw(10),
      borderRadius: sw(14),
    },
    starterText: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.medium,
    },

    bubble: {
      maxWidth: '88%',
      borderRadius: sw(16),
      paddingHorizontal: sw(14),
      paddingVertical: sw(10),
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      borderBottomRightRadius: sw(4),
    },
    bubbleAi: {
      alignSelf: 'flex-start',
      borderBottomLeftRadius: sw(4),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    bubbleText: {
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },

    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: sw(8),
      paddingHorizontal: sw(16),
      paddingTop: sw(10),
      borderTopWidth: 0.5,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.background,
    },
    inputField: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: sw(20),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(14),
      paddingVertical: sw(8),
      minHeight: sw(40),
      justifyContent: 'center',
    },
    input: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      padding: 0,
      maxHeight: ms(120),
    },
    sendBtn: {
      width: sw(40),
      height: sw(40),
      borderRadius: sw(20),
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
