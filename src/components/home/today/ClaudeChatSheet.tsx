import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useThemeStore } from '../../../stores/useThemeStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import Sheet from '../../ui/Sheet';

const SUGGESTIONS = ['How was my training this week?', 'Am I eating enough protein?', 'Am I recovered for legs?'];

interface Message {
  id: number;
  from: 'claude' | 'me';
  text: string;
  connect?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * PROTOTYPE: the Ask Claude chat pop-out. Momentum will be a connector users add to their own Claude;
 * until it exists, sending a message gets a reply explaining how to connect (button: Coming soon).
 */
function ClaudeChatSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((st) => st.mode) === 'dark';
  const username = useAuthStore((st) => st.profile?.username ?? '');
  const firstName = username.trim().split(/\s+/)[0];
  const name = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(1);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraft('');
    setMessages((prev) => [
      ...prev,
      { id: nextId.current++, from: 'me', text: t },
      {
        id: nextId.current++,
        from: 'claude',
        text: 'To answer that I need your Momentum data. Connect Momentum to your Claude app and I can look at your workouts, food, water and recovery.',
        connect: true,
      },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setDraft('');
  }, []);

  return (
    <Sheet visible={visible} onClose={onClose} onDismissed={reset} height="78%" avoidKeyboard>
      <View style={s.root}>
        <View style={s.header}>
          <View style={s.avatar}>
            <Ionicons name="sparkles" size={ms(16)} color={colors.accent} />
          </View>
          <View style={s.headerText}>
            <Text style={s.title}>Claude</Text>
            <Text style={s.subtitle}>Your training & nutrition, with your data</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close chat">
            <Ionicons name="close" size={ms(22)} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent} keyboardShouldPersistTaps="handled">
          <View style={[s.bubble, s.bubbleClaude]}>
            <Text style={s.bubbleText}>
              Hey{name ? ` ${name}` : ''} 👋 Ask me anything about your training, food or recovery.
            </Text>
          </View>

          {messages.map((m) => (
            <View key={m.id} style={[s.bubble, m.from === 'me' ? s.bubbleMe : s.bubbleClaude]}>
              <Text style={[s.bubbleText, m.from === 'me' && s.bubbleTextMe]}>{m.text}</Text>
              {m.connect && (
                <View style={s.connect}>
                  <Text style={s.connectText}>Connect Momentum · Coming soon</Text>
                </View>
              )}
            </View>
          ))}

          {messages.length === 0 && (
            <View style={s.suggestions}>
              {SUGGESTIONS.map((q) => (
                <TouchableOpacity key={q} style={s.suggestion} onPress={() => send(q)} activeOpacity={0.7}>
                  <Text style={s.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message Claude…"
            placeholderTextColor={colors.textTertiary}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            returnKeyType="send"
            onSubmitEditing={() => send(draft)}
            accessibilityLabel="Message Claude"
          />
          <TouchableOpacity
            style={[s.sendBtn, !draft.trim() && s.sendBtnOff]}
            onPress={() => send(draft)}
            disabled={!draft.trim()}
            accessibilityLabel="Send"
          >
            <Ionicons name="arrow-up" size={ms(18)} color={colors.textOnAccent} />
          </TouchableOpacity>
        </View>
      </View>
    </Sheet>
  );
}

export default React.memo(ClaudeChatSheet);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, paddingHorizontal: sw(16), paddingBottom: sw(12) },
    header: { flexDirection: 'row', alignItems: 'center', gap: sw(10), paddingVertical: sw(8) },
    avatar: {
      width: sw(34),
      height: sw(34),
      borderRadius: sw(17),
      backgroundColor: colors.accent + '1F',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    title: { color: colors.textPrimary, fontSize: ms(16), lineHeight: ms(21), fontFamily: Fonts.bold },
    subtitle: { color: colors.textTertiary, fontSize: ms(11), lineHeight: ms(14), fontFamily: Fonts.medium },
    messages: { flex: 1 },
    messagesContent: { paddingVertical: sw(12), gap: sw(8) },
    bubble: { maxWidth: '82%', paddingHorizontal: sw(14), paddingVertical: sw(10), borderRadius: sw(18) },
    bubbleClaude: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: sw(6) },
    bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: sw(6) },
    bubbleText: { color: colors.textPrimary, fontSize: ms(14), lineHeight: ms(20), fontFamily: Fonts.medium },
    bubbleTextMe: { color: colors.textOnAccent },
    connect: {
      marginTop: sw(10),
      alignSelf: 'flex-start',
      paddingHorizontal: sw(12),
      height: sw(32),
      borderRadius: sw(16),
      backgroundColor: colors.accent + '26',
      justifyContent: 'center',
    },
    connectText: { color: colors.accent, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.semiBold },
    suggestions: { gap: sw(8), marginTop: sw(8), alignItems: 'flex-end' },
    suggestion: {
      paddingHorizontal: sw(14),
      paddingVertical: sw(9),
      borderRadius: sw(18),
      borderWidth: 1,
      borderColor: colors.accent + '55',
    },
    suggestionText: { color: colors.textPrimary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.medium },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: sw(8), paddingTop: sw(8) },
    input: {
      flex: 1,
      height: sw(46),
      paddingHorizontal: sw(16),
      borderRadius: sw(23),
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
    },
    sendBtn: {
      width: sw(40),
      height: sw(40),
      borderRadius: sw(20),
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnOff: { opacity: 0.4 },
  });
