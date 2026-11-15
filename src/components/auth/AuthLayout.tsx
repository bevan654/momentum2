import React, { memo, useEffect, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw } from '../../theme/responsive';

interface Props {
  /** Space below the safe-area top inset. */
  topGap: number;
  /** Wrap the content in a ScrollView (Forgot Password). */
  scroll?: boolean;
  children: React.ReactNode;
}

/**
 * Full-screen auth container: keyboard-avoiding background plus the fade + slide-up entrance.
 * Keep it as the root element of a screen's every branch so the entrance only plays once.
 */
function AuthLayout({ topGap, scroll = false, children }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const content = <Animated.View style={entranceStyle}>{children}</Animated.View>;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + topGap }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
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
    scrollContent: {
      flexGrow: 1,
    },
  });

export default memo(AuthLayout);
