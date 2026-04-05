import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWorkoutDates, getUserStreak, upsertUserStreak } from '../lib/friendsDatabase';
import { calculateStreak } from '../utils/streakCalculator';

const STREAK_CACHE_KEY = '@momentum_streak_cache';

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  loaded: boolean;
  initStreak: (userId: string) => Promise<void>;
  refreshStreak: (userId: string) => Promise<void>;
}

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function cacheStreak(current: number, longest: number) {
  AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify({ current, longest, date: todayDateString() })).catch(() => {});
}

export const useStreakStore = create<StreakState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
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
        cacheStreak(cached.current_streak, cached.longest_streak);
      } else {
        // DB unreachable — try local cache
        try {
          const raw = await AsyncStorage.getItem(STREAK_CACHE_KEY);
          if (raw) {
            const local = JSON.parse(raw);
            set({ currentStreak: local.current, longestStreak: local.longest, loaded: true });
          }
        } catch {}
      }
    }

    // 2) Recalculate from actual workout dates (accurate)
    get().refreshStreak(userId);
  },

  refreshStreak: async (userId: string) => {
    const dates = await fetchWorkoutDates(userId);
    if (!dates || dates.length === 0) {
      // Network might have failed — if we already have cached values, keep them
      if (get().loaded) return;
      return;
    }

    const today = todayDateString();
    const result = calculateStreak(dates, today);

    // Persist to DB (fire-and-forget)
    const lastWorkout = dates.length > 0 ? dates[0] : null;
    upsertUserStreak(userId, result.currentStreak, result.longestStreak, lastWorkout);

    set({
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
      loaded: true,
    });
    cacheStreak(result.currentStreak, result.longestStreak);
  },
}));
