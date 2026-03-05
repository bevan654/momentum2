import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

interface Props {
  onSend: (text: string) => void;
}

function ChatInputBar({ onSend }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }, [text, onSend]);

  const canSend = text.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={sw(20)}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, sw(10)) }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          <Ionicons
            name="send"
            size={ms(18)}
            color={canSend ? colors.textOnAccent : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default React.memo(ChatInputBar);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: sw(8),
      paddingHorizontal: sw(12),
      paddingTop: sw(10),
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
