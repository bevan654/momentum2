import { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { DISMISS_THRESHOLD, VELOCITY_THRESHOLD } from './historyConstants';

/**
 * Bottom sheet that appears on mount and closes on a downward drag (or a fast flick) of its handle.
 * Used by the History sheet and the routine preview. `dismiss` is for the backdrop tap; the gesture
 * calls `onClose` itself.
 */
export function useSwipeDismissSheet(sheetHeight: number, onClose: () => void) {
  const translateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);
  const ctx = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
    backdropOpacity.value = 1;
  }, []);

  const dismiss = useCallback(() => {
    translateY.value = sheetHeight;
    backdropOpacity.value = 0;
    onClose();
  }, [onClose, sheetHeight]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => {
          ctx.value = translateY.value;
        })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
            translateY.value = sheetHeight;
            backdropOpacity.value = 0;
            runOnJS(onClose)();
          } else {
            translateY.value = 0;
          }
        }),
    [onClose, sheetHeight],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return { dismiss, panGesture, sheetStyle, backdropStyle };
}
