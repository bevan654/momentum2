import { sw, SCREEN_WIDTH } from '../../../theme/responsive';

/* Shared geometry and options of the Lab trend cards (Weight, Body Fat, Measurements). */

export const CHART_H = sw(140);
export const Y_LABEL_W = sw(34);
export const GRID_STEPS = 4;
export const BAR_RADIUS = sw(3);
export const EMA_COLOR = '#3B82F6';

/** Chart width: the pager page minus the card padding. */
export const CARD_INNER_W = SCREEN_WIDTH - sw(16) * 4;

export const TREND_RANGES = [
  { label: '1W', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

export type TrendRangeLabel = typeof TREND_RANGES[number]['label'];

/** One bar of a trend chart, oldest first. */
export interface TrendBar {
  date: string;
  value: number;
}
