import React, { useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
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

/**
 * The current page, outside React state. Each card draws the page dots, so if the page lived in the
 * pager's state, every page change would re-render all three chart cards; this way only the dots do.
 */
function createPageStore() {
  let page = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => page,
    set: (next: number) => {
      if (next === page) return;
      page = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}
type PageStore = ReturnType<typeof createPageStore>;

const PageDots = React.memo(function PageDots({ store, onPress, styles, accent }: {
  store: PageStore;
  onPress: (index: number) => void;
  styles: ReturnType<typeof createStyles>;
  accent: string;
}) {
  const activePage = useSyncExternalStore(store.subscribe, store.get);
  return (
    <View style={styles.dotsRow}>
      {PAGES.map((p, i) => (
        <Pressable key={p.key} onPress={() => onPress(i)} hitSlop={6}>
          <View style={[styles.dot, i === activePage && { backgroundColor: accent }]} />
        </Pressable>
      ))}
    </View>
  );
});

/* ─── Component ──────────────────────────────────────────── */

function BodyMetricsPager() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pageStore = useRef<PageStore | null>(null);
  if (!pageStore.current) pageStore.current = createPageStore();
  const store = pageStore.current;
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      store.set(Math.round(x / PAGE_W));
    },
    [store],
  );

  const goToPage = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, PAGES.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * PAGE_W, animated: true });
    store.set(clamped);
  }, [store]);

  // Stable across page changes (only the theme changes it), so the cards don't re-render on swipe
  const pageIndicator = useMemo(
    () => <PageDots store={store} onPress={goToPage} styles={styles} accent={colors.accent} />,
    [store, goToPage, styles, colors.accent],
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

export default React.memo(BodyMetricsPager);
