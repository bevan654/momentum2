import React, { useState, useMemo, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';

const USERNAME_MAX = 10;
const USERNAME_MIN = 3;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

interface Props {
  navigation: any;
}

export default function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle');
  const [verificationSent, setVerificationSent] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { signUp, verifyOtp, resendOtp, loading } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  // Debounced username availability check
  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.length === 0) { setUsernameStatus('idle'); return; }
    if (trimmed.length < USERNAME_MIN || !USERNAME_REGEX.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_or_email_taken', {
        p_username: trimmed,
        p_email: '',
      });
      if (error) { setUsernameStatus('ok'); return; } // fail-open
      const row = Array.isArray(data) ? data[0] : data;
      setUsernameStatus(row?.username_taken ? 'taken' : 'ok');
    }, 400);
    return () => clearTimeout(handle);
  }, [username]);

  // Debounced email availability check
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length === 0) { setEmailStatus('idle'); return; }
    if (!EMAIL_REGEX.test(trimmed)) { setEmailStatus('invalid'); return; }
    setEmailStatus('checking');
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_or_email_taken', {
        p_username: '',
        p_email: trimmed,
      });
      if (error) { setEmailStatus('ok'); return; } // fail-open
      const row = Array.isArray(data) ? data[0] : data;
      setEmailStatus(row?.email_taken ? 'taken' : 'ok');
    }, 500);
    return () => clearTimeout(handle);
  }, [email]);

  const onUsernameChange = (v: string) => {
    // strip whitespace and clamp to 10 characters; allow only the letters/digits/underscore
    const cleaned = v.replace(/\s/g, '').slice(0, USERNAME_MAX);
    setUsername(cleaned);
  };

  const handleSignUp = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (usernameStatus === 'invalid') {
      Alert.alert('Error', `Username must be ${USERNAME_MIN}–${USERNAME_MAX} letters, numbers, or underscores`);
      return;
    }
    if (usernameStatus === 'taken') {
      Alert.alert('Error', 'That username is already taken');
      return;
    }
    if (emailStatus === 'invalid') {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (emailStatus === 'taken') {
      Alert.alert('Error', 'An account with that email already exists');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    const { error, needsVerification } = await signUp(trimmedEmail, password, username.trim());
    if (error) {
      Alert.alert('Sign Up Failed', error);
      return;
    }
    if (needsVerification) {
      setVerificationSent(trimmedEmail);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationSent) return;
    const { error } = await resendOtp(verificationSent);
    if (error) Alert.alert('Resend Failed', error);
    else Alert.alert('Code Sent', 'We just sent a new verification code.');
  };

  const handleVerify = async () => {
    if (!verificationSent || otp.trim().length < 6) return;
    setVerifying(true);
    const { error } = await verifyOtp(verificationSent, otp);
    setVerifying(false);
    if (error) Alert.alert('Verification Failed', error);
    // On success, onAuthStateChange will create a session and the app routes onward.
  };

  const canSubmit =
    usernameStatus === 'ok' &&
    emailStatus === 'ok' &&
    password.length >= 6;

  const usernameHint = (() => {
    if (username.length === 0) return null;
    if (usernameStatus === 'invalid') {
      if (username.length < USERNAME_MIN) return `${USERNAME_MIN - username.length} more character${USERNAME_MIN - username.length === 1 ? '' : 's'} needed`;
      return 'Letters, numbers, and underscores only';
    }
    if (usernameStatus === 'checking') return 'Checking availability…';
    if (usernameStatus === 'taken') return 'Username is already taken';
    if (usernameStatus === 'ok') return 'Username available';
    return null;
  })();

  const emailHint = (() => {
    if (email.length === 0) return null;
    if (emailStatus === 'invalid') return 'Enter a valid email address';
    if (emailStatus === 'checking') return 'Checking…';
    if (emailStatus === 'taken') return 'An account with this email already exists';
    return null;
  })();

  const statusColor = (s: FieldStatus) =>
    s === 'ok' ? colors.accent : (s === 'taken' || s === 'invalid') ? '#ef4444' : colors.textTertiary;

  const passwordHint =
    password.length > 0 && password.length < 6
      ? `${6 - password.length} more character${6 - password.length === 1 ? '' : 's'} needed`
      : null;

  if (verificationSent) {
    const canVerify = otp.trim().length === 6 && !verifying;
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + sw(24) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={entranceStyle}>
          <View style={styles.topSpacer} />
          <View style={styles.brandSection}>
            <View style={styles.verifyIconWrap}>
              <Ionicons name="mail-unread-outline" size={ms(36)} color={colors.accent} />
            </View>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.verifySubtitle}>
              We sent a 6-digit code to{'\n'}
              <Text style={styles.verifyEmail}>{verificationSent}</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="······"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={handleVerify}
            />

            <TouchableOpacity
              style={[styles.button, !canVerify && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handleVerify}
              disabled={!canVerify}
            >
              <Text style={styles.buttonText}>
                {verifying ? 'Verifying…' : 'Verify'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResendVerification}
              activeOpacity={0.7}
              style={styles.resendBtn}
            >
              <Text style={styles.resendText}>Resend code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer} />
        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + sw(24) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={entranceStyle}>
        {/* Spacer — pushes content toward center */}
        <View style={styles.topSpacer} />

        {/* Branding */}
        <View style={styles.brandSection}>
          <Image source={require('../../assets/logo.png')} style={styles.logoIcon} />
          <Text style={styles.title}>Create your account</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={ms(20)} color={colors.textTertiary} />
              <TextInput
                style={styles.inputField}
                placeholder={`Username (max ${USERNAME_MAX})`}
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={onUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                returnKeyType="next"
                maxLength={USERNAME_MAX}
              />
              {usernameStatus === 'checking' && (
                <Ionicons name="ellipsis-horizontal" size={ms(18)} color={colors.textTertiary} />
              )}
              {usernameStatus === 'ok' && (
                <Ionicons name="checkmark-circle" size={ms(18)} color={colors.accent} />
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <Ionicons name="close-circle" size={ms(18)} color="#ef4444" />
              )}
            </View>
            {usernameHint && (
              <Text style={[styles.hint, { color: statusColor(usernameStatus) }]}>{usernameHint}</Text>
            )}
          </View>

          <View>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={ms(20)} color={colors.textTertiary} />
              <TextInput
                style={styles.inputField}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
              {emailStatus === 'checking' && (
                <Ionicons name="ellipsis-horizontal" size={ms(18)} color={colors.textTertiary} />
              )}
              {emailStatus === 'ok' && (
                <Ionicons name="checkmark-circle" size={ms(18)} color={colors.accent} />
              )}
              {(emailStatus === 'taken' || emailStatus === 'invalid') && (
                <Ionicons name="close-circle" size={ms(18)} color="#ef4444" />
              )}
            </View>
            {emailHint && (
              <Text style={[styles.hint, { color: statusColor(emailStatus) }]}>{emailHint}</Text>
            )}
          </View>

          <View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={ms(20)} color={colors.textTertiary} />
              <TextInput
                style={styles.inputField}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={handleSignUp}
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
            {passwordHint && (
              <Text style={styles.hint}>{passwordHint}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={!canSubmit || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By creating an account, you agree to our{' '}
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://momentumfitness.vercel.app/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL('https://momentumfitness.vercel.app/privacy')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.switchAuth}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
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

    /* ─── Layout ───────────────────────────────────────────── */
    topSpacer: {
      flex: 1,
    },

    /* ─── Branding ─────────────────────────────────────────── */
    brandSection: {
      alignItems: 'center',
      marginBottom: sw(32),
    },
    logoIcon: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(20),
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

    /* ─── Form ─────────────────────────────────────────────── */
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
    hint: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginTop: sw(6),
      marginLeft: sw(4),
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
    legal: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(16),
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginTop: sw(14),
      paddingHorizontal: sw(8),
    },
    legalLink: {
      color: colors.textSecondary,
      fontFamily: Fonts.semiBold,
      textDecorationLine: 'underline',
    },

    /* ─── Footer ───────────────────────────────────────────── */
    footer: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: sw(16),
    },
    switchAuth: {
      alignItems: 'center',
      paddingVertical: sw(12),
    },
    switchText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },
    switchLink: {
      color: colors.accent,
      fontFamily: Fonts.semiBold,
    },

    /* ─── Verification screen ───────────────────────────────── */
    verifyIconWrap: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(20),
      backgroundColor: colors.accent + '1A',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(16),
    },
    verifySubtitle: {
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginTop: sw(8),
    },
    verifyEmail: {
      color: colors.textPrimary,
      fontFamily: Fonts.semiBold,
    },
    verifyHint: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginTop: sw(12),
      paddingHorizontal: sw(8),
    },
    resendBtn: {
      alignItems: 'center',
      paddingVertical: sw(12),
      marginTop: sw(4),
    },
    resendText: {
      color: colors.accent,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    otpInput: {
      backgroundColor: colors.card,
      borderRadius: sw(14),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: sw(18),
      color: colors.textPrimary,
      fontSize: ms(28),
      lineHeight: ms(34),
      fontFamily: Fonts.bold,
      letterSpacing: ms(10),
      textAlign: 'center',
    },
  });
