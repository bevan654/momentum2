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
  /** Workout days in the last 8 days, newest first (the widget's 7 dots). */
  recentDates: string[];
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

    const weekAgo = parseLocalDate(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentStart = toLocalDateString(weekAgo);
    set({
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      chainStart: result.chainStart,
      lastWorkout: result.lastWorkout,
      recentDates: dates.filter((d) => d >= recentStart && d <= today),
      loaded: true,
    });
  },
}));
