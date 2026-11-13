import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedKeyboard,
  useReducedMotion,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw } from '../../theme/responsive';
import { Portal, useLayerBackHandler } from './Portal';

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 800;
// Critically damped: settles in ~300ms with no visible bounce.
const OPEN_SPRING = { damping: 32, stiffness: 320, mass: 1, overshootClamping: true };
const CLOSE_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };
const REDUCED_TIMING = { duration: 120 };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after the close animation finishes and the sheet has unmounted. */
  onDismissed?: () => void;
  children: React.ReactNode;
  /** Pixels or a percentage of the window ("70%"). */
  height?: number | `${number}%`;
  /** Shift the sheet up with the keyboard. Leave off for sheets that use their own KeyboardAvoidingView. */
  avoidKeyboard?: boolean;
  /** Mount children only after the open animation ends (for heavy content). */
  deferContent?: boolean;
  backdropOpacityValue?: number;
  bgColor?: string;
  radius?: number;
  handleWidth?: number;
};

function Sheet({
  visible,
  onClose,
  onDismissed,
  children,
  height = '90%',
  avoidKeyboard = false,
  deferContent = false,
  backdropOpacityValue = 0.5,
  bgColor,
  radius,
  handleWidth,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboard = useAnimatedKeyboard();

  // Height is known before first paint, so the sheet never jumps.
  const maxHeight = window.height - insets.top;
  const requested = typeof height === 'number' ? height : (parseFloat(height) / 100) * window.height;
  const sheetHeight = Math.min(requested, maxHeight);

  const translateY = useSharedValue(sheetHeight);
  const heightSV = useSharedValue(sheetHeight);
  const [mounted, setMounted] = useState(visible);
  const [contentReady, setContentReady] = useState(!deferContent);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  useEffect(() => {
    heightSV.value = sheetHeight;
  }, [sheetHeight]);

  const finishClose = useCallback(() => {
    setMounted(false);
    setContentReady(!deferContent);
    onDismissedRef.current?.();
  }, [deferContent]);

  const markReady = useCallback(() => setContentReady(true), []);

  /* ── Open / close ─────────────────────────────────── */

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    cancelAnimation(translateY);
    if (visible) {
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) runOnJS(markReady)();
      };
      translateY.value = reduceMotion
        ? withTiming(0, REDUCED_TIMING, done)
        : withSpring(0, OPEN_SPRING, done);
    } else {
      translateY.value = withTiming(
        heightSV.value,
        reduceMotion ? REDUCED_TIMING : CLOSE_TIMING,
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      );
    }
  }, [visible, mounted]);

  useEffect(() => () => cancelAnimation(translateY), []);

  const requestClose = useCallback(() => onCloseRef.current(), []);

  /* ── Android back closes the top-most open sheet ──── */

  useLayerBackHandler(visible, requestClose);

  /* ── Drag to dismiss (UI thread) ──────────────────── */

  const start = useSharedValue(0);

  const pan = useMemo(() =>
    Gesture.Pan()
      // Off while closing: grabbing the handle would cancel the close animation
      // and leave the sheet stuck on screen with nothing left to close it.
      .enabled(visible)
      .activeOffsetY(8)
      .failOffsetX([-20, 20])
      .onStart(() => {
        cancelAnimation(translateY);
        start.value = translateY.value;
      })
      .onUpdate((e) => {
        translateY.value = Math.max(0, start.value + e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
          // Parent flips `visible`, which runs the close animation from here.
          runOnJS(requestClose)();
        } else {
          // The drag may have interrupted the open spring, so this settle also marks content ready.
          translateY.value = withSpring(0, { ...OPEN_SPRING, velocity: e.velocityY }, (finished) => {
            if (finished) runOnJS(markReady)();
          });
        }
      }),
  [requestClose, markReady, visible]);

  /* ── Animated styles ──────────────────────────────── */

  const backdropStyle = useAnimatedStyle(() => {
    const h = heightSV.value;
    const progress = h > 0 ? 1 - translateY.value / h : 0;
    return { opacity: Math.max(0, Math.min(1, progress)) * backdropOpacityValue };
  });

  const sheetStyle = useAnimatedStyle(() => {
    if (!avoidKeyboard) return { transform: [{ translateY: translateY.value }] };
    // Sit on top of the keyboard; shrink if the top would pass the top safe area.
    const kb = keyboard.height.value;
    const shrink = Math.max(0, kb - (maxHeight - heightSV.value));
    return {
      height: heightSV.value - shrink,
      transform: [{ translateY: translateY.value - kb }],
    };
  });

  if (!mounted) return null;

  const sheetRadius = radius ?? sw(20);

  return (
    <Portal>
      {/* No touches while closing, so the backdrop can't call onClose again. */}
      <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: bgColor ?? colors.background,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={styles.handleRow}>
              <View style={[styles.handle, { width: handleWidth ?? sw(40) }]} />
            </Animated.View>
          </GestureDetector>

          {contentReady ? children : <View style={styles.flex} />}
        </Animated.View>
      </View>
    </Portal>
  );
}

export default React.memo(Sheet);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
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
    // Taller than the visible handle so it's easy to grab.
    paddingTop: sw(12),
    paddingBottom: sw(16),
  },
  handle: {
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.cardBorder,
  },
  flex: {
    flex: 1,
  },
});
