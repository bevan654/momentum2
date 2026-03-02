import { create } from 'zustand';
import { fetchWorkoutDates, upsertUserStreak } from '../lib/friendsDatabase';
import { calculateStreak } from '../utils/streakCalculator';

interface StreakState {
  currentStreak: number;
  longestStreak: number;
  refreshStreak: (userId: string) => Promise<void>;
}

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const useStreakStore = create<StreakState>((set) => ({
  currentStreak: 0,
  longestStreak: 0,

  refreshStreak: async (userId: string) => {
    const dates = await fetchWorkoutDates(userId);
    const today = todayDateString();
    const result = calculateStreak(dates, today);

    // Persist to DB (fire-and-forget)
    const lastWorkout = dates.length > 0 ? dates[0] : null;
    upsertUserStreak(userId, result.currentStreak, result.longestStreak, lastWorkout);

    set({
      currentStreak: result.currentStreak,
      longestStreak: result.longestStreak,
    });
  },
}));
