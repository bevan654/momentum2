import React, { useEffect, useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

interface Props {
  count: number;
  onPress: () => void;
}

function NewPostsPill({ count, onPress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useSharedValue(-sw(60));
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (count > 0) {
      translateY.value = withSpring(0, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(-sw(60), { damping: 14, stiffness: 200 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [count]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (count === 0) return null;

  return (
    <Animated.View style={[styles.wrapper, animStyle]}>
      <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.8}>
        <Ionicons name="arrow-up" size={ms(14)} color={colors.textOnAccent} />
        <Text style={styles.text}>
          {count} new {count === 1 ? 'post' : 'posts'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default React.memo(NewPostsPill);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      top: sw(8),
      alignSelf: 'center',
      zIndex: 10,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      backgroundColor: colors.accent,
      paddingHorizontal: sw(16),
      paddingVertical: sw(8),
      borderRadius: sw(20),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    text: {
      color: colors.textOnAccent,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(18),
    },
  });
