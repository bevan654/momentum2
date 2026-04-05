import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '../stores/useNetworkStore';
import { ms, sw } from '../theme/responsive';
import { Fonts } from '../theme/typography';

const BANNER_HEIGHT = sw(28);

const OfflineBanner = React.memo(() => {
  const isOffline = useNetworkStore((s) => s.isOffline);
  const insets = useSafeAreaInsets();
  const hideOffset = -(insets.top + BANNER_HEIGHT);

  const visible = useSharedValue(isOffline ? 1 : 0);

  useEffect(() => {
    visible.value = isOffline ? 1 : 0;
  }, [isOffline]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(visible.value ? 0 : hideOffset, { duration: 300 }) }],
  }));

  return (
    <Animated.View style={[styles.banner, { paddingTop: insets.top }, animatedStyle]} pointerEvents="none">
      <Text style={styles.text}>No Connection</Text>
    </Animated.View>
  );
});

export default OfflineBanner;

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: sw(6),
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },
});
