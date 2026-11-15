export interface EmaPoint {
  date: string;
  value: number;
}

/** Exponential moving average trend line, oldest first, rounded to 0.1. */
export function computeEma<T extends { date: string }>(
  entries: T[],
  valueOf: (entry: T) => number,
  alpha = 0.2,
): EmaPoint[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const emaPoints: EmaPoint[] = [];

  let ema = valueOf(sorted[0]);
  emaPoints.push({ date: sorted[0].date, value: Math.round(ema * 10) / 10 });

  for (let i = 1; i < sorted.length; i++) {
    ema = alpha * valueOf(sorted[i]) + (1 - alpha) * ema;
    emaPoints.push({ date: sorted[i].date, value: Math.round(ema * 10) / 10 });
  }

  return emaPoints;
}
