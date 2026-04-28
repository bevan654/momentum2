import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { ReportTargetType, ReportReason } from '../../lib/friendsDatabase';
import BottomSheet from '../workout-sheet/BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** ID of the user who created the offending content (null when reporting a non-attributable target). */
  targetUserId: string | null;
  /** Optional context attached to the report — e.g. the AI message text for ai_message reports. */
  contextLabel?: string;
  contextText?: string;
}

const REASONS: { key: ReportReason; label: string; description: string }[] = [
  { key: 'harassment', label: 'Harassment or bullying', description: 'Targeted abuse, threats, or intimidation' },
  { key: 'hate_speech', label: 'Hate speech', description: 'Attacks based on race, gender, religion, or identity' },
  { key: 'sexual_content', label: 'Sexual or nude content', description: 'Inappropriate sexual material' },
  { key: 'violence', label: 'Violence or dangerous acts', description: 'Encourages physical harm or unsafe behaviour' },
  { key: 'self_harm', label: 'Self-harm or eating disorder', description: 'Promotes self-harm or disordered eating' },
  { key: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { key: 'spam', label: 'Spam', description: 'Repeated, unsolicited, or commercial content' },
  { key: 'other', label: 'Something else', description: 'Tell us what\'s wrong' },
];

type Step = 'reason' | 'submitting' | 'done';

export default function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetUserId,
  contextLabel,
  contextText,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const reportContent = useFriendsStore((s) => s.reportContent);

  const [step, setStep] = useState<Step>('reason');
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('reason');
    setSelected(null);
    setDetails('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'submitting') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!userId || !selected) return;
    setStep('submitting');
    setError(null);
    // Auto-attach the context (e.g. the offending AI message) so moderators can
    // see what was reported without relying on the user to copy/paste it.
    const submittedDetails = contextText
      ? `${contextLabel ?? 'Reported content'}:\n${contextText}\n\n— Reporter notes —\n${details || '(none)'}`
      : details;
    const { error: err } = await reportContent(
      userId,
      targetType,
      targetId,
      targetUserId,
      selected,
      submittedDetails,
    );
    if (err) {
      setError('Could not submit report. Please try again.');
      setStep('reason');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('done');
  }, [userId, selected, details, targetType, targetId, targetUserId, contextLabel, contextText, reportContent]);

  const handleSelect = useCallback((reason: ReportReason) => {
    Haptics.selectionAsync();
    setSelected(reason);
  }, []);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      height="80%"
      modal
      bgColor={colors.card}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={sw(20)}
        style={styles.flex}
      >
        {step === 'reason' && (
          <ReasonStep
            styles={styles}
            colors={colors}
            selected={selected}
            onSelect={handleSelect}
            details={details}
            onChangeDetails={setDetails}
            error={error}
            onCancel={handleClose}
            onSubmit={handleSubmit}
          />
        )}
        {step === 'submitting' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.statusText}>Submitting report…</Text>
          </View>
        )}
        {step === 'done' && (
          <DoneStep styles={styles} colors={colors} onClose={handleClose} />
        )}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

/* ─── Reason picker ─────────────────────────────────── */

const ReasonStep = React.memo(function ReasonStep({
  styles,
  colors,
  selected,
  onSelect,
  details,
  onChangeDetails,
  error,
  onCancel,
  onSubmit,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  selected: ReportReason | null;
  onSelect: (r: ReportReason) => void;
  details: string;
  onChangeDetails: (v: string) => void;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Report content</Text>
      <Text style={styles.subtitle}>
        Help keep Momentum safe. We review every report and act within 24 hours.
      </Text>

      <View style={styles.reasonList}>
        {REASONS.map((reason) => {
          const active = selected === reason.key;
          return (
            <Pressable
              key={reason.key}
              onPress={() => onSelect(reason.key)}
              style={[styles.reasonRow, active && { borderColor: colors.accent, backgroundColor: colors.accent + '15' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.reasonLabel, active && { color: colors.accent }]}>
                  {reason.label}
                </Text>
                <Text style={styles.reasonDescription}>{reason.description}</Text>
              </View>
              {active && (
                <Ionicons name="checkmark-circle" size={ms(20)} color={colors.accent} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.detailsLabel}>Additional details (optional)</Text>
      <TextInput
        style={styles.detailsInput}
        placeholder="What happened?"
        placeholderTextColor={colors.textTertiary}
        value={details}
        onChangeText={onChangeDetails}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.accentRed, opacity: selected ? 1 : 0.5 },
          ]}
          onPress={onSubmit}
          activeOpacity={0.85}
          disabled={!selected}
        >
          <Text style={styles.submitButtonText}>Submit Report</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
});

/* ─── Done state ─────────────────────────────────────── */

const DoneStep = React.memo(function DoneStep({
  styles,
  colors,
  onClose,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onClose: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={[styles.successIcon, { backgroundColor: colors.accentGreen + '22' }]}>
        <Ionicons name="checkmark" size={ms(28)} color={colors.accentGreen} />
      </View>
      <Text style={styles.title}>Report submitted</Text>
      <Text style={styles.subtitle}>
        Thanks — we'll review this within 24 hours and take action if it violates our guidelines.
      </Text>
      <TouchableOpacity
        style={[styles.cancelButton, { marginTop: sw(20), alignSelf: 'stretch' }]}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
});

/* ─── Styles ─────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: {
      paddingHorizontal: sw(20),
      paddingTop: sw(8),
      paddingBottom: sw(28),
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sw(28),
    },
    successIcon: {
      width: sw(56),
      height: sw(56),
      borderRadius: sw(28),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(16),
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      marginTop: sw(12),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(20),
      lineHeight: ms(25),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      marginBottom: sw(6),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginBottom: sw(20),
    },
    reasonList: {
      gap: sw(8),
      marginBottom: sw(18),
    },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      padding: sw(14),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    reasonLabel: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    reasonDescription: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.regular,
      marginTop: sw(2),
    },
    detailsLabel: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: sw(8),
    },
    detailsInput: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      borderRadius: sw(10),
      padding: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: sw(80),
      marginBottom: sw(12),
    },
    errorText: {
      color: colors.accentRed,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginBottom: sw(8),
    },
    buttonRow: {
      flexDirection: 'row',
      gap: sw(10),
      marginTop: sw(8),
    },
    cancelButton: {
      flex: 1,
      paddingVertical: sw(14),
      borderRadius: sw(10),
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    cancelButtonText: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.semiBold,
    },
    submitButton: {
      flex: 1,
      paddingVertical: sw(14),
      borderRadius: sw(10),
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
  });
