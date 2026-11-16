import React, { useMemo, useRef, useEffect } from 'react';
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
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost, type PortalHostHandle } from '../ui/Portal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import ReportSheet from '../friends/ReportSheet';
import type { AiCoachChat } from './useAiCoachChat';

const STARTERS = [
  'Analyse my training this week',
  'What should I train tomorrow?',
  'Should I deload soon?',
  'Compare this week to last week',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  chat: AiCoachChat;
}

/** Full-screen AI coach chat: header, disclaimer, messages, starters, input bar and the report sheet. */
function AiCoachChatModal({ visible, onClose, chat }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const { messages, input, setInput, loading, sendMessage, reportTarget, setReportTarget, handleReportAi } = chat;
  const scrollRef = useRef<RNScrollView | null>(null);
  const portalHostRef = useRef<PortalHostHandle>(null);

  useEffect(() => {
    if (!visible) return;
    const id = requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => cancelAnimationFrame(id);
  }, [messages, loading, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Back / swipe-down closes the report sheet first, if it's open.
      onRequestClose={() => {
        if (!portalHostRef.current?.closeTopLayer()) onClose();
      }}
    >
      <GestureHandlerRootView style={styles.modalHostRoot}>
      <PortalHost ref={portalHostRef}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <View style={[styles.modalSparkle, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="sparkles" size={ms(16)} color={colors.accent} />
          </View>
          <View style={styles.modalTitleWrap}>
            <Text style={styles.modalTitle}>AI Coach</Text>
            <Text style={styles.modalSubtitle}>Powered by your training data</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={ms(18)} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.disclaimerBar}>
          <Ionicons name="information-circle-outline" size={ms(13)} color={colors.textTertiary} />
          <Text style={styles.disclaimerText}>
            AI Coach is informational only — not medical, dietetic, or professional fitness advice.
            Consult a qualified professional before changing your training, diet, or supplementation.
            Long-press any response to report it.
          </Text>
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

            {messages.map((msg, i) => {
              const bubble = (
                <View
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
              );
              if (msg.role !== 'assistant') return <View key={i}>{bubble}</View>;
              return (
                <Pressable
                  key={i}
                  onLongPress={() => handleReportAi(msg.content)}
                  delayLongPress={400}
                >
                  {bubble}
                </Pressable>
              );
            })}

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

      <ReportSheet
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType="ai_message"
        targetId={reportTarget?.id ?? ''}
        targetUserId={null}
        contextLabel="AI response"
        contextText={reportTarget?.content}
      />
      </PortalHost>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default React.memo(AiCoachChatModal);

const createStyles = (colors: ThemeColors, insetTop: number) =>
  StyleSheet.create({
    modalHostRoot: {
      flex: 1,
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

    disclaimerBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sw(6),
      paddingHorizontal: sw(16),
      paddingVertical: sw(8),
      backgroundColor: colors.surface,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    disclaimerText: {
      flex: 1,
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
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
