import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/useColors';
import { sw, SCREEN_HEIGHT } from '../theme/responsive';

const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;

interface SheetWrapperProps {
  children: React.ReactNode;
  /** If true, only renders backdrop — child handles its own sheet chrome */
  hasOwnSheet?: boolean;
}

export default function SheetWrapper({ children, hasOwnSheet = false }: SheetWrapperProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dismissing = useRef(false);

  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);
  const ctx = useSharedValue(0);
  const sheetMarginTop = insets.top + sw(10);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    translateY.value = withSpring(SCREEN_HEIGHT, { damping: 28, stiffness: 280, mass: 0.8 });
    backdropOpacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(goBack)();
    });
  }, [goBack]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(8)
    .onStart(() => {
      ctx.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, ctx.value + e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
        translateY.value = withSpring(SCREEN_HEIGHT, { damping: 28, stiffness: 280, mass: 0.8 });
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.8 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (hasOwnSheet) {
    return (
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>
        <Animated.View style={[styles.sheet, { marginTop: sheetMarginTop, backgroundColor: colors.background }, sheetStyle]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: colors.textTertiary + '60' }]} />
            </Animated.View>
          </GestureDetector>
          {children}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>
      <Animated.View style={[styles.sheet, { marginTop: sheetMarginTop, backgroundColor: colors.background }, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.textTertiary + '60' }]} />
          </Animated.View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: sw(12),
    paddingBottom: sw(8),
  },
  handle: {
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
  },
});
