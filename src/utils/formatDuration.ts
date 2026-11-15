/**
 * Format a duration in whole seconds as a clock: "H:MM:SS" from one hour up,
 * otherwise "MM:SS". Negative / non-finite input is treated as 0.
 */
export function formatClock(totalSeconds: number): string {
  const t = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Short rest-countdown format: "1:05", "0:45". */
export function formatCountdown(totalSeconds: number): string {
  const t = Number.isFinite(totalSeconds) ? Math.max(0, Math.ceil(totalSeconds)) : 0;
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;
}

/** A workout's length in hours and minutes: "1h 5m", "45m". */
export function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Rest between sets, compact: "1m30s", "2m", "45s". */
export function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return rem > 0 ? `${m}m${rem}s` : `${m}m`;
  }
  return `${seconds}s`;
}
