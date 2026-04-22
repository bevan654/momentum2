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

export default function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signUp, loading } = useAuthStore();
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

  const handleSignUp = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    const { error } = await signUp(email.trim().toLowerCase(), password, username.trim());
    if (error) Alert.alert('Sign Up Failed', error);
  };

  const canSubmit =
    username.trim().length >= 3 && email.trim().length > 0 && password.length >= 6;

  const passwordHint =
    password.length > 0 && password.length < 6
      ? `${6 - password.length} more character${6 - password.length === 1 ? '' : 's'} needed`
      : null;

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
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={ms(20)} color={colors.textTertiary} />
            <TextInput
              style={styles.inputField}
              placeholder="Username"
              placeholderTextColor={colors.textTertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              textContentType="username"
              returnKeyType="next"
            />
          </View>

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
              returnKeyType="next"
            />
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
  });
