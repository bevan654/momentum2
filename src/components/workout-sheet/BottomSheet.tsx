import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw } from '../../theme/responsive';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;

/* ─── Spring / timing configs ─────────────────────────── */
const OPEN_SPRING = { damping: 26, stiffness: 400, mass: 0.7 };
const SNAP_SPRING = { damping: 24, stiffness: 350, mass: 0.7 };
const CLOSE_DURATION = 280;

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number | string;
  backdropOpacityValue?: number;
  bgColor?: string;
  radius?: number;
  handleWidth?: number;
  /** Wrap in a native <Modal> for z-ordering above everything (use for nested overlays). */
  modal?: boolean;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  height = '90%',
  backdropOpacityValue = 0.5,
  bgColor,
  radius,
  handleWidth,
  modal = false,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const [mounted, setMounted] = useState(visible);
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closingRef = useRef(false);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerHeight(h);
  }, []);

  const rawHeight =
    typeof height === 'string' && height.endsWith('%')
      ? (parseFloat(height) / 100) * containerHeight
      : typeof height === 'number'
      ? height
      : containerHeight * 0.9;
  const sheetHeight = Math.min(rawHeight, containerHeight);

  const sheetBg = bgColor ?? colors.background;
  const sheetRadius = radius ?? sw(20);
  const hw = handleWidth ?? sw(40);

  // Keep a shared value so worklets can read current height
  const sheetHeightSV = useSharedValue(sheetHeight);
  useEffect(() => { sheetHeightSV.value = sheetHeight; }, [sheetHeight]);

  // Backdrop opacity derived from sheet position — perfectly synced, no separate animation
  const backdropAnimStyle = useAnimatedStyle(() => {
    const h = sheetHeightSV.value;
    if (h <= 0) return { opacity: 0 };
    const progress = 1 - translateY.value / h;
    return {
      opacity: Math.max(0, Math.min(backdropOpacityValue, progress * backdropOpacityValue)),
    };
  });

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /* ── Open / close lifecycle ─────────────────────────── */

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
      // Start off-screen so the spring has something to animate from
      translateY.value = sheetHeight;
      cancelAnimation(translateY);
      translateY.value = withSpring(0, OPEN_SPRING);
    } else if (mounted && !closingRef.current) {
      closingRef.current = true;
      cancelAnimation(translateY);
      translateY.value = withTiming(
        sheetHeight,
        { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(setMounted)(false);
          }
        },
      );
    }
  }, [visible]);

  useEffect(() => {
    return () => { cancelAnimation(translateY); };
  }, []);

  /* ── Gesture (UI thread) ────────────────────────────── */

  const context = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    onCloseRef.current();
  }, []);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetY(8)
      .onStart(() => {
        context.value = translateY.value;
      })
      .onUpdate((e) => {
        translateY.value = Math.max(0, context.value + e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
          closingRef.current = true;
          translateY.value = withTiming(
            sheetHeightSV.value,
            { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) },
            (finished) => {
              if (finished) runOnJS(setMounted)(false);
            },
          );
          runOnJS(handleDismiss)();
        } else {
          translateY.value = withSpring(0, SNAP_SPRING);
        }
      }),
  [handleDismiss]);

  /* ── Render ──────────────────────────────────────────── */

  if (!mounted) return null;

  const content = (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="auto"
      onLayout={onContainerLayout}
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => onCloseRef.current()}>
        <Animated.View style={[styles.backdrop, backdropAnimStyle]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            backgroundColor: sheetBg,
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
          },
          sheetAnimStyle,
        ]}
      >
        {/* Handle — draggable zone (Gesture Handler, UI thread) */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.handleRow}>
            <View style={[styles.handle, { width: hw }]} />
          </Animated.View>
        </GestureDetector>

        {children}
      </Animated.View>
    </View>
  );

  if (modal) {
    return (
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => onCloseRef.current()}
      >
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          {content}
        </GestureHandlerRootView>
      </Modal>
    );
  }

  return content;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: sw(14),
  },
  handle: {
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.cardBorder,
  },
});
