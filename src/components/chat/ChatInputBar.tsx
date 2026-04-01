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
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, sw(8)) }]}>
        <View style={styles.inputWrap}>
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
            style={[styles.sendBtn, canSend && styles.sendBtnActive]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-up"
              size={ms(18)}
              color={canSend ? colors.textOnAccent : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default React.memo(ChatInputBar);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: sw(10),
      paddingTop: sw(8),
      backgroundColor: colors.background,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.surface,
      borderRadius: sw(22),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      paddingLeft: sw(14),
      paddingRight: sw(5),
      paddingVertical: sw(5),
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.regular,
      lineHeight: ms(20),
      paddingVertical: sw(4),
      maxHeight: sw(100),
    },
    sendBtn: {
      width: sw(30),
      height: sw(30),
      borderRadius: sw(15),
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnActive: {
      backgroundColor: colors.accent,
    },
  });
