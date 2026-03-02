import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { sw, ms } from '../../theme/responsive';

interface Props {
  onRemove: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function WidgetRemoveButton({ onRemove }: Props) {
  return (
    <AnimatedTouchable
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.button}
      onPress={onRemove}
      hitSlop={8}
      activeOpacity={0.7}
    >
      <Ionicons name="close" size={ms(14)} color="#FFFFFF" />
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: -sw(6),
    left: -sw(6),
    width: sw(24),
    height: sw(24),
    borderRadius: sw(12),
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
