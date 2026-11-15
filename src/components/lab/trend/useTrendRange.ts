import { useState, useCallback, useEffect, useMemo, useRef, type DependencyList } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useLabTimeRangeStore, nearestRangeOption } from '../../../stores/useLabTimeRangeStore';
import { formatMonthDay } from '../../../utils/dateLabels';
import { TREND_RANGES, type TrendRangeLabel } from './trendConfig';

/**
 * A trend card's own range selector (1W–1Y), synced to the global Lab range bar:
 * every global change (and the first mount) snaps it to the nearest option.
 */
export function useTrendRange(initial: TrendRangeLabel) {
  const [selectedRange, setSelectedRange] = useState<TrendRangeLabel>(initial);

  // Sync to global Lab time range when user taps the global bar
  const globalRangeDays = useLabTimeRangeStore((s) => s.rangeDays);
  const globalVersion = useLabTimeRangeStore((s) => s.version);
  useEffect(() => {
    const nearest = nearestRangeOption(globalRangeDays, TREND_RANGES);
    setSelectedRange(nearest.label);
  }, [globalVersion]);

  const selectedDays = TREND_RANGES.find((r) => r.label === selectedRange)!.days;
  const rangeIndex = TREND_RANGES.findIndex((r) => r.label === selectedRange);

  const goShorter = useCallback(() => {
    const idx = TREND_RANGES.findIndex((r) => r.label === selectedRange);
    if (idx > 0) setSelectedRange(TREND_RANGES[idx - 1].label);
  }, [selectedRange]);
  const goLonger = useCallback(() => {
    const idx = TREND_RANGES.findIndex((r) => r.label === selectedRange);
    if (idx < TREND_RANGES.length - 1) setSelectedRange(TREND_RANGES[idx + 1].label);
  }, [selectedRange]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - selectedDays + 1);
    return `${formatMonthDay(start)} – ${formatMonthDay(now)}`;
  }, [selectedDays]);

  return { selectedRange, selectedDays, rangeIndex, goShorter, goLonger, dateRange };
}

/**
 * Runs `load` when `deps` change (signed in only), fading the chart out when `fadeKey`
 * changed since the last load, and back in once entries arrive. Returns the chart's opacity style.
 * Call after useTrendRange so the effects run in the same order as before.
 */
export function useTrendLoad(
  userId: string | undefined,
  fadeKey: string,
  load: (userId: string) => void,
  deps: DependencyList,
  entries: readonly unknown[],
) {
  const chartOpacity = useSharedValue(1);
  const prevKey = useRef(fadeKey);

  useEffect(() => {
    if (userId) {
      if (prevKey.current !== fadeKey) {
        chartOpacity.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.ease) });
        prevKey.current = fadeKey;
      }
      load(userId);
    }
  }, deps);

  useEffect(() => {
    if (entries.length > 0) {
      chartOpacity.value = withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) });
    }
  }, [entries]);

  return useAnimatedStyle(() => ({ opacity: chartOpacity.value }));
}
