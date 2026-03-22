import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, SCREEN_WIDTH } from '../../theme/responsive';
import WeightCard from './WeightCard';
import MeasurementsCard from './MeasurementsCard';
import BodyFatCard from './BodyFatCard';

/* ─── Config ─────────────────────────────────────────────── */

const PAGES = [
  { key: 'weight', label: 'Weight', Component: WeightCard },
  { key: 'measurements', label: 'Measurements', Component: MeasurementsCard },
  { key: 'body_fat', label: 'Body Fat', Component: BodyFatCard },
] as const;

const PAGE_W = SCREEN_WIDTH - sw(16) * 2;

/* ─── Component ──────────────────────────────────────────── */

export default function BodyMetricsPager() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / PAGE_W);
      setActivePage(page);
    },
    [],
  );

  const goToPage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, PAGES.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * PAGE_W, animated: true });
    setActivePage(clamped);
  }, []);

  const pageIndicator = useMemo(
    () => (
      <View style={styles.dotsRow}>
        {PAGES.map((p, i) => (
          <Pressable key={p.key} onPress={() => goToPage(i)} hitSlop={6}>
            <View style={[styles.dot, i === activePage && { backgroundColor: colors.accent }]} />
          </Pressable>
        ))}
      </View>
    ),
    [activePage, colors.accent, styles, goToPage],
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {PAGES.map((p) => (
          <View key={p.key} style={{ width: PAGE_W }}>
            <p.Component pageIndicator={pageIndicator} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    dot: {
      width: sw(5),
      height: sw(5),
      borderRadius: sw(3),
      backgroundColor: colors.textTertiary + '40',
    },
  });
