import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import WeightCard from './WeightCard';
import MeasurementsCard from './MeasurementsCard';
import BodyFatCard from './BodyFatCard';

/* ─── Config ─────────────────────────────────────────────── */

const PAGES = [
  { key: 'weight', label: 'Weight', Component: WeightCard },
  { key: 'measurements', label: 'Measurements', Component: MeasurementsCard },
  { key: 'body_fat', label: 'Body Fat', Component: BodyFatCard },
] as const;

const ARROW_SIZE = sw(26);
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
            <p.Component />
          </View>
        ))}
      </ScrollView>

      {/* Left arrow */}
      {activePage > 0 && (
        <Pressable
          onPress={() => goToPage(activePage - 1)}
          style={[styles.arrowBtn, styles.arrowLeft]}
        >
          <Ionicons name="chevron-back" size={ms(14)} color={colors.textPrimary} />
        </Pressable>
      )}

      {/* Right arrow */}
      {activePage < PAGES.length - 1 && (
        <Pressable
          onPress={() => goToPage(activePage + 1)}
          style={[styles.arrowBtn, styles.arrowRight]}
        >
          <Ionicons name="chevron-forward" size={ms(14)} color={colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
    },
    arrowBtn: {
      position: 'absolute',
      top: '50%',
      marginTop: -ARROW_SIZE / 2,
      width: ARROW_SIZE,
      height: ARROW_SIZE,
      borderRadius: ARROW_SIZE / 2,
      backgroundColor: colors.card,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    arrowLeft: {
      left: sw(6),
    },
    arrowRight: {
      right: sw(6),
    },
  });
