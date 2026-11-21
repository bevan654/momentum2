import React, { useEffect, useMemo, useRef } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

export interface UndoOffer {
  message: string;
  /** Changes for every new offer, so the same message shows again. */
  id: number;
}

const SHOW_MS = 5000;
/** How far the banner slides up from. Worked out here: \`sw()\` can't run inside the animation. */
const SLIDE_DISTANCE = sw(24);

interface Props {
  offer: UndoOffer | null;
  onUndo: () => void;
  /** The offer timed out (or was replaced): it can no longer be undone. */
  onExpire: () => void;
}

/** "Deleted … · Undo" bar near the bottom of the diary, shown for a few seconds after a delete. */
function UndoBanner({ offer, onUndo, onExpire }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!offer) {
      progress.value = withTiming(0, { duration: 180 });
      return;
    }
    progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    timer.current = setTimeout(onExpire, SHOW_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [offer, onExpire, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * SLIDE_DISTANCE }],
  }));

  return (
    <Animated.View style={[styles.bar, animatedStyle]} pointerEvents={offer ? 'box-none' : 'none'}>
      <Ionicons name="trash-outline" size={ms(15)} color={colors.textSecondary} />
      <Text style={styles.text} numberOfLines={1}>{offer?.message ?? ''}</Text>
      <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo delete" disabled={!offer}>
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(UndoBanner);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: sw(16),
      right: sw(16),
      bottom: sw(80),
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingHorizontal: sw(14),
      paddingVertical: sw(12),
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...colors.cardShadow,
      zIndex: 20,
    },
    text: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    undo: {
      color: colors.accent,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },
  });
