import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { PHOTO_WIDTH, PHOTO_HEIGHT } from './feedHelpers';

const FeedRowSkeleton = React.memo(function FeedRowSkeleton() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.45,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.skelAvatar, shimmerStyle]} />
        <View style={styles.headerText}>
          <Animated.View style={[styles.skelLine, styles.skelNameLine, shimmerStyle]} />
        </View>
        <Animated.View style={[styles.skelStreak, shimmerStyle]} />
      </View>

      <View style={styles.heroRow}>
        <View style={styles.heroStat}>
          <Animated.View style={[styles.skelLine, styles.skelStatValue, shimmerStyle]} />
          <Animated.View style={[styles.skelLine, styles.skelStatLabel, shimmerStyle]} />
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Animated.View style={[styles.skelLine, styles.skelStatValue, shimmerStyle]} />
          <Animated.View style={[styles.skelLine, styles.skelStatLabel, shimmerStyle]} />
        </View>
      </View>
      <Animated.View style={[styles.skelLine, styles.skelMetaLine, shimmerStyle]} />

      <Animated.View style={[styles.skelMedia, shimmerStyle]} />

      <View style={styles.actionRow}>
        <Animated.View style={[styles.skelIcon, shimmerStyle]} />
      </View>
    </View>
  );
});

export default FeedRowSkeleton;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      gap: 0,
      paddingBottom: sw(4),
      backgroundColor: colors.card,
    },
    skelAvatar: {
      width: sw(26),
      height: sw(26),
      borderRadius: sw(13),
      backgroundColor: colors.cardBorder,
    },
    skelLine: {
      backgroundColor: colors.cardBorder,
    },
    skelNameLine: {
      width: sw(110),
      height: ms(11),
    },
    skelStreak: {
      width: sw(42),
      height: ms(18),
      backgroundColor: colors.cardBorder,
    },
    skelStatValue: {
      width: sw(64),
      height: ms(18),
      marginBottom: sw(4),
    },
    skelStatLabel: {
      width: sw(40),
      height: ms(8),
    },
    skelMetaLine: {
      width: sw(180),
      height: ms(9),
      marginHorizontal: sw(14),
      marginTop: sw(6),
      marginBottom: sw(8),
      backgroundColor: colors.cardBorder,
    },
    skelMedia: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      backgroundColor: colors.cardBorder,
    },
    skelIcon: {
      width: ms(22),
      height: ms(22),
      backgroundColor: colors.cardBorder,
      marginHorizontal: sw(6),
      marginVertical: sw(2),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingHorizontal: sw(12),
      paddingVertical: sw(6),
    },
    headerText: {
      flex: 1,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(14),
      paddingTop: 0,
      paddingBottom: 0,
    },
    heroStat: {
      flex: 1,
      alignItems: 'flex-start',
    },
    heroDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.cardBorder,
      marginHorizontal: sw(10),
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(10),
      paddingTop: sw(5),
      paddingBottom: sw(2),
      gap: sw(2),
    },
  });
