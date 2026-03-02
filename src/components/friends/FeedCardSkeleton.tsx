import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';

function FeedCardSkeleton() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
  }));

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.avatarBone, shimmerStyle]} />
        <View style={styles.headerText}>
          <Animated.View style={[styles.nameBone, shimmerStyle]} />
          <Animated.View style={[styles.timeBone, shimmerStyle]} />
        </View>
      </View>

      {/* Stats strip */}
      <Animated.View style={[styles.statsBone, shimmerStyle]} />

      {/* Body map area */}
      <Animated.View style={[styles.bodyBone, shimmerStyle]} />

      {/* Action row */}
      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <Animated.View style={[styles.iconBone, shimmerStyle]} />
          <Animated.View style={[styles.iconBone, shimmerStyle]} />
          <Animated.View style={[styles.iconBone, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.iconBone, shimmerStyle]} />
      </View>
    </View>
  );
}

export default React.memo(FeedCardSkeleton);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      padding: sw(14),
      marginBottom: sw(10),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      marginBottom: sw(12),
    },
    avatarBone: {
      width: sw(36),
      height: sw(36),
      borderRadius: sw(18),
      backgroundColor: colors.surface,
    },
    headerText: {
      flex: 1,
      gap: sw(6),
    },
    nameBone: {
      width: sw(120),
      height: sw(12),
      borderRadius: sw(6),
      backgroundColor: colors.surface,
    },
    timeBone: {
      width: sw(60),
      height: sw(10),
      borderRadius: sw(5),
      backgroundColor: colors.surface,
    },
    statsBone: {
      height: sw(40),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
      marginBottom: sw(8),
    },
    bodyBone: {
      height: sw(120),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: sw(10),
    },
    actionLeft: {
      flexDirection: 'row',
      gap: sw(16),
    },
    iconBone: {
      width: sw(22),
      height: sw(22),
      borderRadius: sw(11),
      backgroundColor: colors.surface,
    },
  });
