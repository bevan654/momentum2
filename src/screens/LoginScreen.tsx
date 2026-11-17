import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import SocialAuthButtons from '../components/auth/SocialAuthButtons';
import AuthLayout from '../components/auth/AuthLayout';
import AuthBrand from '../components/auth/AuthBrand';
import AuthInput from '../components/auth/AuthInput';
import { useAuthStyles } from '../components/auth/authStyles';

interface Props {
  navigation: any;
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, loading } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const authStyles = useAuthStyles();

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
    <AuthLayout topGap={sw(24)}>
      {/* Spacer — pushes content toward center */}
      <View style={authStyles.topSpacer} />

      <AuthBrand title="Welcome back" />

      {/* Form */}
      <View style={authStyles.form}>
        <AuthInput
          icon="mail-outline"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <AuthInput
          icon="lock-closed-outline"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />

        <TouchableOpacity
          style={styles.forgotRow}
          onPress={() => navigation.navigate('ForgotPassword')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[authStyles.button, (!canSubmit || loading) && authStyles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={!canSubmit || loading}
          activeOpacity={0.8}
        >
          <Text style={authStyles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <SocialAuthButtons disabled={loading} />
      </View>

      {/* Footer */}
      <View style={authStyles.footer}>
        <TouchableOpacity
          style={authStyles.switchAuth}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={authStyles.switchText}>
            Don't have an account? <Text style={authStyles.switchLink}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </AuthLayout>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    forgotRow: {
      alignSelf: 'flex-end',
      paddingVertical: sw(4),
      paddingHorizontal: sw(2),
      marginTop: sw(-4),
    },
    forgotText: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
  });
