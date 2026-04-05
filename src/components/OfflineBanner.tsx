import React, { useEffect, useState, useCallback } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '../stores/useNetworkStore';
import { checkConnection } from '../lib/supabase';
import { ms, sw } from '../theme/responsive';
import { Fonts } from '../theme/typography';

const BANNER_HEIGHT = sw(28);

const OfflineBanner = React.memo(() => {
  const isOffline = useNetworkStore((s) => s.isOffline);
  const insets = useSafeAreaInsets();
  const hideOffset = -(insets.top + BANNER_HEIGHT);
  const [checking, setChecking] = useState(false);

  const visible = useSharedValue(isOffline ? 1 : 0);

  useEffect(() => {
    visible.value = isOffline ? 1 : 0;
  }, [isOffline]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(visible.value ? 0 : hideOffset, { duration: 300 }) }],
  }));

  const handleReconnect = useCallback(async () => {
    setChecking(true);
    await checkConnection();
    setChecking(false);
  }, []);

  return (
    <Animated.View style={[styles.banner, { paddingTop: insets.top }, animatedStyle]} pointerEvents="box-none">
      <View style={styles.row}>
        <Text style={styles.text}>No Connection</Text>
        <TouchableOpacity
          style={styles.reconnectBtn}
          onPress={handleReconnect}
          disabled={checking}
          activeOpacity={0.7}
        >
          {checking
            ? <ActivityIndicator size="small" color="#D32F2F" />
            : <Text style={styles.reconnectText}>Reconnect</Text>
          }
        </TouchableOpacity>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  text: {
    color: '#fff',
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },
  reconnectBtn: {
    backgroundColor: '#fff',
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    minWidth: sw(80),
    alignItems: 'center',
    justifyContent: 'center',
    hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
  },
  reconnectText: {
    color: '#D32F2F',
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
});
