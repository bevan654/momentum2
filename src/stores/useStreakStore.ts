import { create } from 'zustand';
import { fetchWorkoutDates, getUserStreak, upsertUserStreak } from '../lib/friendsDatabase';
import { calculateStreak } from '../utils/streakCalculator';
import { parseLocalDate, toLocalDateString } from '../utils/localDate';

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  /** First workout day of the current streak and the latest workout day (YYYY-MM-DD), for the home screen widget. */
  chainStart: string | null;
  lastWorkout: string | null;
  /** Workout days in the last 29 days, newest first (the widgets' 7 dots and 28-day calendar). */
  recentDates: string[];
  /** Whose dates chainStart / lastWorkout / recentDates are (set by refreshStreak only). */
  computedFor: string | null;
  loaded: boolean;
  initStreak: (userId: string) => Promise<void>;
  refreshStreak: (userId: string) => Promise<void>;
}

export const useStreakStore = create<StreakState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
  chainStart: null,
  lastWorkout: null,
  recentDates: [],
  computedFor: null,
  loaded: false,

  initStreak: async (userId: string) => {
    // 1) Load cached DB values immediately (fast)
    if (!get().loaded) {
      const cached = await getUserStreak(userId);
      if (cached) {
        set({
          currentStreak: cached.current_streak,
          longestStreak: cached.longest_streak,
          loaded: true,
        });
      }
    }

    // 2) Recalculate from actual workout dates (accurate)
    get().refreshStreak(userId);
  },

  refreshStreak: async (userId: string) => {
    const dates = await fetchWorkoutDates(userId);
    // Couldn't read the history (offline, error): keep what we have. This used to save 0 / 0 to the
    // server, wiping the streak friends and the leaderboard see.
    if (!dates) return;
    const today = toLocalDateString();
    const result = calculateStreak(dates, today);

    // Persist to DB (fire-and-forget)
    const lastWorkout = dates.length > 0 ? dates[0] : null;
    upsertUserStreak(userId, result.currentStreak, result.longestStreak, lastWorkout);

    const windowStart = parseLocalDate(today);
    windowStart.setDate(windowStart.getDate() - 28);
    const recentStart = toLocalDateString(windowStart);
    set({
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      chainStart: result.chainStart,
      lastWorkout: result.lastWorkout,
      recentDates: dates.filter((d) => d >= recentStart && d <= today),
      computedFor: userId,
      loaded: true,
    });
  },
}));
