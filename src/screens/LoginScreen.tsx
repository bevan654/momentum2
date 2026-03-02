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

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, loading } = useAuthStore();
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

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) Alert.alert('Sign In Failed', error);
  };

  const canSubmit = email.trim().length > 0 && password.length > 0;

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
          <Image source={require('../../assets/icon.png')} style={styles.logoIcon} />
          <Text style={styles.title}>Welcome back</Text>
        </View>

        {/* Form */}
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
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={ms(20)} color={colors.textTertiary} />
            <TextInput
              style={styles.inputField}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSignIn}
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
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={!canSubmit || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.switchAuth}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchLink}>Sign Up</Text>
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
