import React, { useEffect, useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

export interface RefreshResult {
  ok: boolean;
  /** Changes on every refresh, so the same result shows again. */
  id: number;
}

const SHOW_MS = 1600;
/** How far the pill slides in from. Worked out here: `sw()` can't run inside the animation (UI thread). */
const SLIDE_DISTANCE = sw(16);

/**
 * Small pill that drops in under the date bar after a pull-to-refresh, says whether it
 * worked, then slides away. Doesn't take touches, so it never blocks the diary.
 */
function RefreshBanner({ result }: { result: RefreshResult | null }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!result) return;
    progress.value = 0;
    progress.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(SHOW_MS, withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) })),
    );
  }, [result, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * SLIDE_DISTANCE }],
  }));

  const ok = result?.ok ?? true;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pill, animatedStyle]}
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden={!result}
    >
      <Ionicons
        name={ok ? 'checkmark-circle' : 'cloud-offline-outline'}
        size={ms(15)}
        color={ok ? colors.positive : colors.accentOrange}
      />
      <Text style={styles.text}>{ok ? 'Diary updated' : "Couldn't refresh. Check your connection."}</Text>
    </Animated.View>
  );
}

export default React.memo(RefreshBanner);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      position: 'absolute',
      top: sw(8),
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      paddingHorizontal: sw(14),
      paddingVertical: sw(8),
      borderRadius: sw(20),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...colors.cardShadow,
      zIndex: 10,
    },
    text: {
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
  });
