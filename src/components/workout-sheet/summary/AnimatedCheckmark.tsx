import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';

function AnimatedCheckmark({ colors }: { colors: ThemeColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 220 }));

    const t = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.checkCircle, animStyle]}>
      <Ionicons name="checkmark" size={ms(28)} color={colors.textOnAccent} />
    </Animated.View>
  );
}

export default React.memo(AnimatedCheckmark);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  checkCircle: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(20),
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
