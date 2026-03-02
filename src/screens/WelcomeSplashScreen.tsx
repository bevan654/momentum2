import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';

const SPLASH_DURATION = 2500;

export default function WelcomeSplashScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dismissWelcome = useAuthStore((s) => s.dismissWelcome);
  const profile = useAuthStore((s) => s.profile);

  // Animations
  const logoScale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const dotOpacity1 = useSharedValue(0.3);
  const dotOpacity2 = useSharedValue(0.3);
  const dotOpacity3 = useSharedValue(0.3);

  const easeOut = Easing.out(Easing.cubic);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: dotOpacity1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dotOpacity2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dotOpacity3.value }));

  useEffect(() => {
    // Staggered entrance
    logoOpacity.value = withTiming(1, { duration: 400, easing: easeOut });
    logoScale.value = withTiming(1, { duration: 500, easing: easeOut });
    textOpacity.value = withDelay(500, withTiming(1, { duration: 350, easing: easeOut }));
    subtitleOpacity.value = withDelay(850, withTiming(1, { duration: 300, easing: easeOut }));

    // Pulsing dots — staggered infinite repeat
    const pulse = (duration: number) =>
      withSequence(
        withTiming(1, { duration, easing: easeOut }),
        withTiming(0.3, { duration, easing: easeOut }),
      );
    dotOpacity1.value = withRepeat(pulse(400), -1);
    dotOpacity2.value = withDelay(200, withRepeat(pulse(400), -1));
    dotOpacity3.value = withDelay(400, withRepeat(pulse(400), -1));

    // Auto-dismiss
    const timer = setTimeout(dismissWelcome, SPLASH_DURATION);
    return () => {
      clearTimeout(timer);
      cancelAnimation(dotOpacity1);
      cancelAnimation(dotOpacity2);
      cancelAnimation(dotOpacity3);
    };
  }, []);

  const username = profile?.username;
  const isReturning = profile?.height != null && profile?.gender != null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Logo */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image source={require('../../assets/icon.png')} style={styles.logoIcon} />
      </Animated.View>

      {/* Welcome text */}
      <Animated.View style={textStyle}>
        <Text style={styles.title}>
          {username ? `Welcome back, ${username}` : 'Welcome to Momentum'}
        </Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View style={subtitleStyle}>
        <Text style={styles.subtitle}>
          {isReturning ? 'Loading your data' : 'Setting up your account'}
        </Text>

        {/* Loading dots */}
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sw(32),
    },

    /* ─── Logo ─────────────────────────────────────────────── */
    logoWrap: {
      marginBottom: sw(28),
    },
    logoIcon: {
      width: sw(88),
      height: sw(88),
      borderRadius: sw(24),
    },

    /* ─── Text ─────────────────────────────────────────────── */
    title: {
      color: colors.textPrimary,
      fontSize: ms(24),
      lineHeight: ms(30),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
      textAlign: 'center',
      marginBottom: sw(10),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },

    /* ─── Loading dots ─────────────────────────────────────── */
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(8),
      marginTop: sw(20),
    },
    dot: {
      width: sw(8),
      height: sw(8),
      borderRadius: sw(4),
      backgroundColor: colors.accent,
    },
  });
