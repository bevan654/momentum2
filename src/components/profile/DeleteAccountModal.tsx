import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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
import BottomSheet from '../workout-sheet/BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'warning' | 'password' | 'deleting';

const DELETED_ITEMS = [
  'Your profile, username, and email',
  'All workouts, exercises, and sets',
  'Routines and training programs',
  'Food entries, custom foods, and goals',
  'Supplement logs and goals',
  'Weight, body fat, and measurements',
  'Friends, posts, comments, and reactions',
  'Streaks, ranks, and achievements',
];

export default function DeleteAccountModal({ visible, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  const [step, setStep] = useState<Step>('warning');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('warning');
    setPassword('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'deleting') return; // don't allow close mid-deletion
    reset();
    onClose();
  }, [step, reset, onClose]);

  const handleContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('password');
  }, []);

  const handleDelete = useCallback(async () => {
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setError(null);
    setStep('deleting');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const { error: deleteError } = await deleteAccount(password);
    if (deleteError) {
      setError(deleteError);
      setStep('password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Success — auth state listener will route to AuthNavigator. Modal will
    // unmount with the rest of the tab tree on the next render.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
  }, [password, deleteAccount, reset]);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      height="75%"
      modal
      bgColor={colors.card}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={sw(20)}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'warning' && (
            <WarningStep
              styles={styles}
              colors={colors}
              onCancel={handleClose}
              onContinue={handleContinue}
            />
          )}
          {step === 'password' && (
            <PasswordStep
              styles={styles}
              colors={colors}
              password={password}
              onChangePassword={setPassword}
              error={error}
              onCancel={handleClose}
              onConfirm={handleDelete}
            />
          )}
          {step === 'deleting' && (
            <DeletingStep styles={styles} colors={colors} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

/* ─── Warning step ──────────────────────────────────────── */

const WarningStep = React.memo(function WarningStep({
  styles,
  colors,
  onCancel,
  onContinue,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <View>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentRed + '22' }]}>
        <Ionicons name="warning-outline" size={ms(28)} color={colors.accentRed} />
      </View>
      <Text style={styles.title}>Delete Account</Text>
      <Text style={styles.subtitle}>
        This permanently deletes your account and all of your data. This cannot be undone.
      </Text>

      <View style={styles.listCard}>
        {DELETED_ITEMS.map((item, i) => (
          <View key={item} style={[styles.listRow, i === DELETED_ITEMS.length - 1 && { borderBottomWidth: 0 }]}>
            <Ionicons name="close-circle" size={ms(16)} color={colors.accentRed} />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dangerButton, { backgroundColor: colors.accentRed }]}
          onPress={onContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.dangerButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

/* ─── Password step ─────────────────────────────────────── */

const PasswordStep = React.memo(function PasswordStep({
  styles,
  colors,
  password,
  onChangePassword,
  error,
  onCancel,
  onConfirm,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  password: string;
  onChangePassword: (v: string) => void;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentRed + '22' }]}>
        <Ionicons name="lock-closed-outline" size={ms(26)} color={colors.accentRed} />
      </View>
      <Text style={styles.title}>Confirm It's You</Text>
      <Text style={styles.subtitle}>
        Re-enter your password to permanently delete your account.
      </Text>

      <TextInput
        style={[styles.input, error ? { borderColor: colors.accentRed } : null]}
        placeholder="Password"
        placeholderTextColor={colors.textTertiary}
        value={password}
        onChangeText={onChangePassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={onConfirm}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.dangerButton,
            { backgroundColor: colors.accentRed, opacity: password ? 1 : 0.5 },
          ]}
          onPress={onConfirm}
          activeOpacity={0.85}
          disabled={!password}
        >
          <Text style={styles.dangerButtonText}>Delete Permanently</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

/* ─── Deleting step ─────────────────────────────────────── */

const DeletingStep = React.memo(function DeletingStep({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.deletingWrap}>
      <ActivityIndicator size="large" color={colors.accentRed} />
      <Text style={styles.deletingText}>Deleting your account…</Text>
      <Text style={styles.deletingHint}>This may take a few seconds.</Text>
    </View>
  );
});

/* ─── Styles ────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: sw(20),
      paddingTop: sw(8),
      paddingBottom: sw(28),
    },
    iconCircle: {
      width: sw(56),
      height: sw(56),
      borderRadius: sw(28),
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: sw(8),
      marginBottom: sw(16),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      lineHeight: ms(27),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      marginBottom: sw(8),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginBottom: sw(20),
      paddingHorizontal: sw(8),
    },
    listCard: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      paddingHorizontal: sw(14),
      marginBottom: sw(20),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingVertical: sw(10),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.cardBorder,
    },
    listText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    input: {
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.medium,
      borderRadius: sw(10),
      paddingHorizontal: sw(14),
      paddingVertical: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: sw(8),
    },
    errorText: {
      color: colors.accentRed,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginBottom: sw(12),
      marginLeft: sw(2),
    },
    buttonRow: {
      flexDirection: 'row',
      gap: sw(10),
      marginTop: sw(12),
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
    dangerButton: {
      flex: 1,
      paddingVertical: sw(14),
      borderRadius: sw(10),
      alignItems: 'center',
    },
    dangerButtonText: {
      color: '#FFFFFF',
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    deletingWrap: {
      alignItems: 'center',
      paddingVertical: sw(40),
    },
    deletingText: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.semiBold,
      marginTop: sw(16),
    },
    deletingHint: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.regular,
      marginTop: sw(6),
    },
  });
