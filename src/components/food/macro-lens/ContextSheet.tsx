import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { MAX_CONTEXT_CHARS } from './macroLensTypes';

/** After picking a photo: optional text context for the AI, then Retake or Scan. */
function ContextSheet({ contextText, setContextText, onRetake, onScan }: {
  contextText: string;
  setContextText: (v: string) => void;
  onRetake: () => void;
  onScan: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
      style={styles.contextKav}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={FadeInDown.springify().damping(20)}
        style={styles.contextSheet}
      >
        <View style={styles.sheetGrabber} />
        <View style={styles.contextHeader}>
          <View style={styles.contextTitleRow}>
            <Ionicons name="sparkles" size={ms(14)} color={colors.accent} />
            <Text style={styles.contextTitle}>Add context</Text>
            <Text style={styles.contextOptional}>Optional</Text>
          </View>
          <Text style={styles.contextSubtitle}>
            Tell the AI what's in the photo for a more accurate scan.
          </Text>
        </View>

        <View style={styles.contextInputWrap}>
          <TextInput
            style={styles.contextInput}
            value={contextText}
            onChangeText={(v) => setContextText(v.slice(0, MAX_CONTEXT_CHARS))}
            placeholder={'e.g. "from McDonald\'s", "1 cup brown rice", "cooked in butter"'}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={MAX_CONTEXT_CHARS}
            blurOnSubmit
            returnKeyType="done"
          />
          <Text style={styles.contextCount}>
            {contextText.length} / {MAX_CONTEXT_CHARS}
          </Text>
        </View>

        <View style={styles.contextBtnRow}>
          <TouchableOpacity
            onPress={onRetake}
            style={styles.contextRetakeBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={ms(15)} color={colors.textPrimary} />
            <Text style={styles.contextRetakeText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onScan}
            style={styles.contextScanBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="aperture" size={ms(15)} color={colors.textOnAccent} />
            <Text style={styles.contextScanText}>
              {contextText.trim() ? 'Scan with context' : 'Scan'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

export default React.memo(ContextSheet);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  contextKav: {
    width: '100%',
  },
  contextSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(24),
    borderTopRightRadius: sw(24),
    paddingTop: sw(8),
    paddingBottom: sw(28),
    paddingHorizontal: sw(18),
  },
  contextHeader: {
    gap: sw(4),
    marginTop: sw(4),
    marginBottom: sw(12),
  },
  contextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  contextTitle: {
    color: colors.textPrimary,
    fontSize: ms(17),
    lineHeight: ms(22),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  contextOptional: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginLeft: sw(4),
  },
  contextSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  contextInputWrap: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(14),
    paddingHorizontal: sw(12),
    paddingTop: sw(10),
    paddingBottom: sw(8),
    marginBottom: sw(12),
  },
  contextInput: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    minHeight: sw(60),
    maxHeight: sw(110),
    textAlignVertical: 'top',
    padding: 0,
  },
  contextCount: {
    alignSelf: 'flex-end',
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.semiBold,
    marginTop: sw(4),
  },
  contextBtnRow: {
    flexDirection: 'row',
    gap: sw(10),
  },
  contextRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    paddingHorizontal: sw(18),
    paddingVertical: sw(13),
    borderRadius: sw(14),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  contextRetakeText: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.bold,
  },
  contextScanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(7),
    paddingVertical: sw(13),
    borderRadius: sw(14),
    backgroundColor: colors.accent,
  },
  contextScanText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
    letterSpacing: -0.1,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.textTertiary + '50',
    marginBottom: sw(10),
  },
});
