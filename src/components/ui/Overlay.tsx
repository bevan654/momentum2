import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Portal, useLayerBackHandler } from './Portal';

const ENTER = { fade: 200, slide: 300 };
const EXIT = { fade: 180, slide: 240 };

type Props = {
  visible?: boolean;
  /** Back button / swipe-down request. Same meaning as RN Modal's onRequestClose. */
  onRequestClose?: () => void;
  /** Animates the whole layer, like RN Modal (content draws its own backdrop). */
  animationType?: 'fade' | 'slide' | 'none';
  /** After the enter animation finishes. */
  onShow?: () => void;
  /** After the exit animation finishes and the layer is gone (both platforms). */
  onDismiss?: () => void;
  children: React.ReactNode;
};

/**
 * Drop-in replacement for a transparent RN <Modal>, rendered through the
 * nearest PortalHost instead of a native window. Native modals can't be
 * presented while another is dismissing on iOS; portalled overlays stack freely.
 */
function Overlay({
  visible = true,
  onRequestClose,
  animationType = 'fade',
  onShow,
  onDismiss,
  children,
}: Props) {
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const type = reduceMotion && animationType === 'slide' ? 'fade' : animationType;

  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  const shown = useCallback(() => onShowRef.current?.(), []);
  const finish = useCallback(() => {
    setMounted(false);
    onDismissRef.current?.();
  }, []);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    cancelAnimation(progress);
    if (type === 'none') {
      progress.value = visible ? 1 : 0;
      if (visible) shown();
      else finish();
      return;
    }
    if (visible) {
      progress.value = withTiming(1, { duration: ENTER[type], easing: Easing.out(Easing.cubic) }, (f) => {
        if (f) runOnJS(shown)();
      });
    } else {
      progress.value = withTiming(0, { duration: EXIT[type], easing: Easing.in(Easing.cubic) }, (f) => {
        if (f) runOnJS(finish)();
      });
    }
  }, [visible, mounted, type]);

  useEffect(() => () => cancelAnimation(progress), []);

  const requestClose = useCallback(() => onRequestCloseRef.current?.(), []);
  useLayerBackHandler(visible, requestClose);

  const animStyle = useAnimatedStyle(() => {
    if (type === 'slide') return { transform: [{ translateY: (1 - progress.value) * height }] };
    return { opacity: progress.value };
  });

  if (!mounted) return null;

  return (
    <Portal>
      <Animated.View
        style={[StyleSheet.absoluteFill, animStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
        accessibilityViewIsModal
      >
        {children}
      </Animated.View>
    </Portal>
  );
}

export default React.memo(Overlay);
