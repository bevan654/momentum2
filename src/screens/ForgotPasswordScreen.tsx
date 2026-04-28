import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';

interface Props {
  navigation: any;
}

type Step = 'email' | 'code';

export default function ForgotPasswordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Entrance animation
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
    flex: 1,
  }));

  useEffect(() => {
    const config = { duration: 500, easing: Easing.out(Easing.cubic) };
    fadeAnim.value = withTiming(1, config);
    slideAnim.value = withTiming(0, config);
  }, []);

  const handleSendCode = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await requestPasswordReset(trimmed);
      if (error) {
        Alert.alert('Error', error);
        return;
      }
      setStep('code');
    } finally {
      setSubmitting(false);
    }
  }, [email, requestPasswordReset]);

  const handleResend = useCallback(async () => {
    setSubmitting(true);
    try {
      const { error } = await requestPasswordReset(email);
      if (error) Alert.alert('Error', error);
      else Alert.alert('Sent', 'A new code is on the way.');
    } finally {
      setSubmitting(false);
    }
  }, [email, requestPasswordReset]);

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
      const { error } = await confirmPasswordReset(email, code, newPassword);
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
  }, [code, newPassword, email, confirmPasswordReset, navigation]);

  const canSendCode = email.trim().length > 0 && !submitting;
  const canConfirm = code.trim().length >= 4 && newPassword.length >= 6 && !submitting;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + sw(8) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={entranceStyle}>
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

          <View style={styles.brandSection}>
            <Image source={require('../../assets/logo.png')} style={styles.logoIcon} />
            <Text style={styles.title}>
              {step === 'email' ? 'Reset password' : 'Enter the code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'email'
                ? "We'll email you a code to reset your password."
                : `We sent a code to ${email}. Enter it below and set a new password.`}
            </Text>
          </View>

          {step === 'email' ? (
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={ms(20)} color={colors.textTertiary} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Email"
                  placeholderTextColor={colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={handleSendCode}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, !canSendCode && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={!canSendCode}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Send code'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={ms(20)} color={colors.textTertiary} />
                <TextInput
                  style={styles.inputField}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textTertiary}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  returnKeyType="next"
                  maxLength={10}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={ms(20)} color={colors.textTertiary} />
                <TextInput
                  style={styles.inputField}
                  placeholder="New password"
                  placeholderTextColor={colors.textTertiary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={handleConfirm}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={ms(20)}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, !canConfirm && styles.buttonDisabled]}
                onPress={handleConfirm}
                disabled={!canConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
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
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: sw(24),
    },
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
    brandSection: {
      alignItems: 'center',
      marginBottom: sw(28),
    },
    logoIcon: {
      width: sw(64),
      height: sw(64),
      borderRadius: sw(18),
      marginBottom: sw(16),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      lineHeight: ms(27),
      fontFamily: Fonts.semiBold,
      letterSpacing: -0.3,
      textAlign: 'center',
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
    form: {
      gap: sw(14),
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: sw(12),
      paddingHorizontal: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(12),
    },
    inputField: {
      flex: 1,
      paddingVertical: sw(16),
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      padding: sw(16),
      alignItems: 'center',
      marginTop: sw(8),
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
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
