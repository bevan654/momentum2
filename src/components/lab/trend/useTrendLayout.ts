import { useMemo } from 'react';
import { sw } from '../../../theme/responsive';
import { buildSmoothPath } from '../../../utils/smoothPath';
import type { EmaPoint } from '../../../utils/ema';
import { CHART_H, Y_LABEL_W, CARD_INNER_W, type TrendBar } from './trendConfig';

/**
 * Geometry of a trend chart: slot and bar widths, the y scale (padded 15%, at least 0.5),
 * the tallest bar and the EMA path.
 * @param extraSlots empty slots after the last bar (WeightCard's projection)
 * @param extraValue a value the y scale must include (WeightCard's goal)
 */
export function useTrendLayout(
  entries: readonly TrendBar[],
  emaPoints: EmaPoint[],
  extraSlots = 0,
  extraValue: number | null = null,
) {
  const hasData = entries.length > 0;
  const slotCount = entries.length || 1;
  const slotW = (CARD_INNER_W - Y_LABEL_W) / (slotCount + extraSlots);
  const barW = Math.min(sw(20), slotW * 0.6);

  const yScale = useMemo(() => {
    if (!hasData) return { yMin: 0, yMax: 100, yRange: 100 };
    const all = [...entries.map((e) => e.value), ...emaPoints.map((e) => e.value)];
    if (extraValue !== null) all.push(extraValue);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = Math.max((max - min) * 0.15, 0.5);
    return { yMin: min - pad, yMax: max + pad, yRange: max - min + pad * 2 };
  }, [entries, emaPoints, hasData, extraValue]);

  const peakIndex = useMemo(() => {
    let max = 0, idx = -1;
    entries.forEach((e, i) => { if (e.value > max) { max = e.value; idx = i; } });
    return idx;
  }, [entries]);

  const emaPath = useMemo(() => {
    if (emaPoints.length < 2) return null;
    const { yMin, yRange } = yScale;
    const pts = emaPoints.map((p, i) => ({
      x: Y_LABEL_W + i * slotW + slotW / 2,
      y: CHART_H * (1 - (p.value - yMin) / yRange),
    }));
    return buildSmoothPath(pts);
  }, [emaPoints, yScale, slotW]);

  return { slotW, barW, yScale, peakIndex, emaPath };
}

export type TrendLayout = ReturnType<typeof useTrendLayout>;
