/**
 * Streak calculation with 2-rest-day tolerance.
 *
 * Rules:
 * - Every calendar day (workout or rest) counts toward the streak length.
 * - The streak breaks only when 3+ consecutive rest days occur.
 * - "Gap" between two workout dates:
 *     gap = dateA - dateB  (in days)
 *     rest days between them = gap - 1
 *     Break when rest days >= 3, i.e. gap >= 4
 * - The streak is still alive if today is within 2 rest days of the last workout
 *   (daysSinceLast < 4, i.e. gap < 4, matching chain logic).
 */

function diffDays(a: string, b: string): number {
  const msA = Date.UTC(
    +a.slice(0, 4),
    +a.slice(5, 7) - 1,
    +a.slice(8, 10),
  );
  const msB = Date.UTC(
    +b.slice(0, 4),
    +b.slice(5, 7) - 1,
    +b.slice(8, 10),
  );
  return Math.round((msA - msB) / 86_400_000);
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Calculate the current and longest streak from an array of workout date
 * strings (YYYY-MM-DD). Dates do NOT need to be pre-sorted or unique.
 */
export function calculateStreak(
  workoutDates: string[],
  today: string,
): StreakResult {
  if (workoutDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Deduplicate and sort descending (most recent first)
  const unique = [...new Set(workoutDates)].sort((a, b) =>
    b.localeCompare(a),
  );

  // ── Build all chains ─────────────────────────────────
  // A "chain" is a contiguous group of workout dates where no two
  // consecutive workouts have a gap >= 4 days (i.e. 3+ rest days).
  // Each chain is represented as [newestDate, oldestDate].
  const chains: [string, string][] = [];
  let chainStart = unique[0]; // newest date of current chain

  for (let i = 0; i < unique.length - 1; i++) {
    const gap = diffDays(unique[i], unique[i + 1]);
    if (gap >= 4) {
      // Chain breaks — record this chain and start a new one
      chains.push([chainStart, unique[i]]);
      chainStart = unique[i + 1];
    }
  }
  // Push the last chain
  chains.push([chainStart, unique[unique.length - 1]]);

  // ── Longest streak ───────────────────────────────────
  // For each chain, streak length = newestDate - oldestDate + 1
  let longestStreak = 0;
  for (const [newest, oldest] of chains) {
    const len = diffDays(newest, oldest) + 1;
    if (len > longestStreak) longestStreak = len;
  }

  // ── Current streak ───────────────────────────────────
  // The current streak is the most recent chain extended to today,
  // but only if the streak is still alive (today within 2 rest days
  // of the newest workout in the chain).
  const daysSinceLast = diffDays(today, unique[0]);

  let currentStreak = 0;
  if (daysSinceLast >= 0 && daysSinceLast < 4) {
    // Streak is alive — the most recent chain (chains[0]) is the current one
    const [, oldest] = chains[0];
    currentStreak = diffDays(today, oldest) + 1;

    // Update longest if the current living streak (extended to today) beats it
    if (currentStreak > longestStreak) longestStreak = currentStreak;
  }

  return { currentStreak, longestStreak };
}
