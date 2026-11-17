import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import SocialAuthButtons from '../components/auth/SocialAuthButtons';
import AuthLayout from '../components/auth/AuthLayout';
import AuthBrand from '../components/auth/AuthBrand';
import AuthInput from '../components/auth/AuthInput';
import { useAuthStyles } from '../components/auth/authStyles';
import {
  USERNAME_MAX,
  USERNAME_MIN,
  cleanUsernameInput,
  useEmailAvailability,
  useUsernameAvailability,
} from '../hooks/useUsernameAvailability';

interface Props {
  navigation: any;
}

export default function SignUpScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { signUp, verifyOtp, resendOtp, loading } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const authStyles = useAuthStyles();

  // Debounced availability checks. Both fail open: an RPC error counts as available.
  const usernameStatus = useUsernameAvailability(username, { errorStatus: 'ok' });
  const emailStatus = useEmailAvailability(email, { errorStatus: 'ok' });

  const onUsernameChange = (v: string) => {
    // strip whitespace and clamp to 10 characters; allow only the letters/digits/underscore
    setUsername(cleanUsernameInput(v));
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

  const passwordHint =
    password.length > 0 && password.length < 6
      ? `${6 - password.length} more character${6 - password.length === 1 ? '' : 's'} needed`
      : null;

  if (verificationSent) {
    const canVerify = otp.trim().length === 6 && !verifying;
    return (
      <AuthLayout topGap={sw(24)}>
        <View style={authStyles.topSpacer} />
        <AuthBrand
          title="Enter your code"
          icon={
            <View style={styles.verifyIconWrap}>
              <Ionicons name="mail-unread-outline" size={ms(36)} color={colors.accent} />
            </View>
          }
        >
          <Text style={styles.verifySubtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.verifyEmail}>{verificationSent}</Text>
          </Text>
        </AuthBrand>

        <View style={authStyles.form}>
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
            style={[authStyles.button, !canVerify && authStyles.buttonDisabled]}
            activeOpacity={0.8}
            onPress={handleVerify}
            disabled={!canVerify}
          >
            <Text style={authStyles.buttonText}>
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

        <View style={authStyles.footer} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout topGap={sw(24)}>
      {/* Spacer — pushes content toward center */}
      <View style={authStyles.topSpacer} />

      <AuthBrand title="Create your account" />

      {/* Form */}
      <View style={authStyles.form}>
        <AuthInput
          icon="person-outline"
          status={usernameStatus}
          hint={usernameHint}
          placeholder={`Username (max ${USERNAME_MAX})`}
          value={username}
          onChangeText={onUsernameChange}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
          maxLength={USERNAME_MAX}
        />

        <AuthInput
          icon="mail-outline"
          status={emailStatus}
          hint={emailHint}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <AuthInput
          icon="lock-closed-outline"
          hint={passwordHint}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />

        <TouchableOpacity
          style={[authStyles.button, (!canSubmit || loading) && authStyles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={!canSubmit || loading}
          activeOpacity={0.8}
        >
          <Text style={authStyles.buttonText}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <SocialAuthButtons disabled={loading} />

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
      <View style={authStyles.footer}>
        <TouchableOpacity
          style={authStyles.switchAuth}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={authStyles.switchText}>
            Already have an account? <Text style={authStyles.switchLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </AuthLayout>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
