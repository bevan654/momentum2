import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import AuthLayout from '../components/auth/AuthLayout';
import AuthBrand from '../components/auth/AuthBrand';
import AuthInput from '../components/auth/AuthInput';
import { useAuthStyles } from '../components/auth/authStyles';

interface Props {
  navigation: any;
}

type Step = 'email' | 'code';

export default function ForgotPasswordScreen({ navigation }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const authStyles = useAuthStyles();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // One normalised address (as Login/SignUp send it) for the request, resend, confirm and the copy
  const normalizedEmail = email.trim().toLowerCase();

  const handleSendCode = useCallback(async () => {
    if (!normalizedEmail) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await requestPasswordReset(normalizedEmail);
      if (error) {
        Alert.alert('Error', error);
        return;
      }
      setStep('code');
    } finally {
      setSubmitting(false);
    }
  }, [normalizedEmail, requestPasswordReset]);

  const handleResend = useCallback(async () => {
    setSubmitting(true);
    try {
      const { error } = await requestPasswordReset(normalizedEmail);
      if (error) Alert.alert('Error', error);
      else Alert.alert('Sent', 'A new code is on the way.');
    } finally {
      setSubmitting(false);
    }
  }, [normalizedEmail, requestPasswordReset]);

  const handleConfirm = useCallback(async () => {
    if (code.trim().length < 4) {
      Alert.alert('Error', 'Enter the code from your email.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await confirmPasswordReset(normalizedEmail, code, newPassword);
      if (error) {
        Alert.alert('Error', error);
        return;
      }
      Alert.alert(
        'Password reset',
        'Your password has been updated. Sign in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
      );
    } finally {
      setSubmitting(false);
    }
  }, [code, newPassword, normalizedEmail, confirmPasswordReset, navigation]);

  const canSendCode = normalizedEmail.length > 0 && !submitting;
  const canConfirm = code.trim().length >= 4 && newPassword.length >= 6 && !submitting;

  return (
    <AuthLayout topGap={sw(8)} scroll>
      <TouchableOpacity
        style={styles.backRow}
        onPress={() => (step === 'code' ? setStep('email') : navigation.goBack())}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
        <Text style={styles.backText}>{step === 'code' ? 'Back' : 'Sign In'}</Text>
      </TouchableOpacity>

      <View style={styles.topSpacer} />

      <AuthBrand compact title={step === 'email' ? 'Reset password' : 'Enter the code'}>
        <Text style={styles.subtitle}>
          {step === 'email'
            ? "We'll email you a code to reset your password."
            : `We sent a code to ${normalizedEmail}. Enter it below and set a new password.`}
        </Text>
      </AuthBrand>

      {step === 'email' ? (
        <View style={authStyles.form}>
          <AuthInput
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
          />

          <TouchableOpacity
            style={[authStyles.button, !canSendCode && authStyles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={!canSendCode}
            activeOpacity={0.8}
          >
            <Text style={authStyles.buttonText}>{submitting ? 'Sending...' : 'Send code'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={authStyles.form}>
          <AuthInput
            icon="key-outline"
            placeholder="Code from the email"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            returnKeyType="next"
            maxLength={10}
          />

          <AuthInput
            icon="lock-closed-outline"
            placeholder="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleConfirm}
          />

          <TouchableOpacity
            style={[authStyles.button, !canConfirm && authStyles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.8}
          >
            <Text style={authStyles.buttonText}>
              {submitting ? 'Resetting...' : 'Reset password'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendRow}
            onPress={handleResend}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.resendText}>
              Didn't get a code? <Text style={styles.resendLink}>Send again</Text>
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </AuthLayout>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      paddingVertical: sw(8),
      alignSelf: 'flex-start',
    },
    backText: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.medium,
    },
    topSpacer: {
      height: sw(40),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginTop: sw(8),
      paddingHorizontal: sw(8),
    },
    resendRow: {
      alignItems: 'center',
      paddingVertical: sw(12),
    },
    resendText: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    resendLink: {
      color: colors.accent,
      fontFamily: Fonts.semiBold,
    },
  });
