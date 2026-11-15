import { useWindowDimensions } from 'react-native';
import Animated, {
  measure,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

/**
 * Keeps a view's content above the keyboard wherever the view sits (inside a sheet, under a
 * header, full screen). KeyboardAvoidingView measures against its parent, which comes out short
 * inside a sheet, and Android's window resize is off once Reanimated tracks the keyboard (Sheet
 * does), so this pads by exactly how much of the keyboard overlaps the view's bottom edge.
 *
 * Attach `ref` to an Animated.View and add `style` to it. `open` is 1 while the keyboard covers
 * the view, for content that should drop its home-indicator spacing then.
 */
export function useKeyboardInset() {
  const ref = useAnimatedRef<Animated.View>();
  const keyboard = useAnimatedKeyboard();
  const { height: windowHeight } = useWindowDimensions();
  const padding = useSharedValue(0);

  useAnimatedReaction(
    () => keyboard.height.value,
    (kb) => {
      if (kb <= 0) {
        padding.value = 0;
        return;
      }
      const m = measure(ref);
      if (!m) return;
      // Distance from the view's bottom edge to the bottom of the window.
      const below = Math.max(0, windowHeight - (m.pageY + m.height));
      padding.value = Math.max(0, kb - below);
    },
    [windowHeight],
  );

  const style = useAnimatedStyle(() => ({ paddingBottom: padding.value }));
  const open = useDerivedValue(() => (padding.value > 0 ? 1 : 0));
  return { ref, style, open };
}
