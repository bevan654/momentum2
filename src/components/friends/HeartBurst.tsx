import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ms } from '../../theme/responsive';

interface Props {
  visible: boolean;
  onFinished: () => void;
}

function HeartBurst({ visible, onFinished }: Props) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = 1;
      scale.value = withSequence(
        withSpring(1.3, { damping: 6, stiffness: 200 }),
        withTiming(1, { duration: 100 }),
        withDelay(
          200,
          withTiming(0, { duration: 300 }, (finished) => {
            if (finished) {
              runOnJS(onFinished)();
            }
          }),
        ),
      );
      opacity.value = withDelay(400, withTiming(0, { duration: 200 }));
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      <Ionicons name="heart" size={ms(72)} color="#EF4444" />
    </Animated.View>
  );
}

export default React.memo(HeartBurst);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
});
