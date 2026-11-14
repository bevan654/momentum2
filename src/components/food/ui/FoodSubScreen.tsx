import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw } from '../../../theme/responsive';
import { useLayerBackHandler } from '../../ui/Portal';
import FoodSheetHeader from './FoodSheetHeader';
import { useKeyboardInset } from './useKeyboardInset';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Screen-level use: Android back only closes this while it returns true (e.g. tab focused). */
  isBackActive?: () => boolean;
  right?: React.ReactNode;
  /** Pinned under the scroll content (e.g. the main action button). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A screen opened on top of the Log Food sheet (Quick add, food detail, make a meal):
 * fades in over the sheet, back button + Android back close only this screen,
 * scrollable body with a pinned footer that respects the home indicator and keyboard.
 */
function FoodSubScreen({ visible, title, subtitle, onBack, isBackActive, right, footer, children }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // Starts hidden so the first show fades in, whether the screen is always mounted or mounted on open.
  const progress = useSharedValue(0);
  const kbInset = useKeyboardInset();
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: visible ? 180 : 140 });
  }, [visible]);
  const animStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  useLayerBackHandler(visible, onBack, isBackActive);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.screen, animStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal={visible}
    >
      <Animated.View ref={kbInset.ref} style={[styles.flex, kbInset.style]}>
        <FoodSheetHeader title={title} subtitle={subtitle} leading="back" onLeading={onBack} right={right} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, sw(12)) }]}>{footer}</View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

export default React.memo(FoodSubScreen);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      paddingTop: sw(14),
    },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: sw(16),
      paddingTop: sw(6),
      paddingBottom: sw(24),
      gap: sw(16),
    },
    footer: {
      paddingHorizontal: sw(16),
      paddingTop: sw(10),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.background,
    },
  });
