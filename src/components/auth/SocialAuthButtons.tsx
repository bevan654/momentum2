import React, { memo, useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { ms, sw } from '../../theme/responsive';

interface Props {
  disabled?: boolean;
}

function SocialAuthButtons({ disabled = false }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const signInWithSocial = useAuthStore((state) => state.signInWithSocial);

  const handlePress = async (provider: 'google' | 'apple') => {
    const { error, cancelled } = await signInWithSocial(provider);
    if (error && !cancelled) {
      Alert.alert(`${provider === 'google' ? 'Google' : 'Apple'} Sign In Failed`, error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={[styles.socialButton, disabled && styles.disabled]}
          onPress={() => handlePress('google')}
          disabled={disabled}
          activeOpacity={0.75}
        >
          <Ionicons name="logo-google" size={ms(20)} color={colors.textPrimary} />
          <Text style={styles.buttonText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          style={[styles.socialButton, disabled && styles.disabled]}
          onPress={() => handlePress('apple')}
          disabled={disabled}
          activeOpacity={0.75}
        >
          <Ionicons name="logo-apple" size={ms(21)} color={colors.textPrimary} />
          <Text style={styles.buttonText}>Apple</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: sw(14),
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
    },
    divider: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
    },
    dividerText: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: sw(12),
    },
    socialButton: {
      flex: 1,
      minHeight: sw(52),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(9),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: sw(12),
    },
    buttonText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    disabled: {
      opacity: 0.5,
    },
  });

export default memo(SocialAuthButtons);
