import { create } from 'zustand';

/**
 * Global time-range selector for the Lab tab.
 *
 * Each card has its own internal selector (e.g. WeightCard has 1W/2W/1M/6M/1Y).
 * Cards sync to the global value by watching `version` — on every global change
 * (setRange), cards map `rangeDays` to their nearest supported option.
 *
 * Cards tapping their own internal selector does NOT touch the global; only
 * global taps cascade to all cards.
 */
interface LabTimeRangeState {
  rangeDays: number;
  version: number;
  setRange: (days: number) => void;
}

export const LAB_RANGE_OPTIONS: { label: string; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

export const useLabTimeRangeStore = create<LabTimeRangeState>((set) => ({
  rangeDays: 7,
  version: 0,
  setRange: (days) => set((s) => ({ rangeDays: days, version: s.version + 1 })),
}));

/** Find the option in `options` whose `.days` is closest to `targetDays`. */
export function nearestRangeOption<T extends { days: number }>(
  targetDays: number,
  options: readonly T[],
): T {
  return options.reduce((best, curr) =>
    Math.abs(curr.days - targetDays) < Math.abs(best.days - targetDays) ? curr : best,
  );
}
