import { supabase } from '../supabase';
import { toLocalDateString } from '../../utils/localDate';

// Workout streaks and a friend's profile stats.

// Supabase returns at most 1000 rows per request, so whole-history reads go page by page.
const PAGE_SIZE = 1000;
const MAX_PAGES = 20; // 20k rows: a safety stop, far beyond any real history

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function getUserStreak(
  userId: string,
): Promise<{ current_streak: number; longest_streak: number } | null> {
  const { data } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', userId)
    .maybeSingle();

  return data;
}

/** Fetch distinct workout dates (YYYY-MM-DD) for a user, descending. */
export async function fetchWorkoutDates(
  userId: string,
): Promise<string[]> {
  // All of it: the longest streak needs the whole history (a single request stopped at 1000 workouts).
  const data = await fetchAllRows<{ created_at: string }>((from, to) =>
    supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );

  if (data.length === 0) return [];

  // Convert UTC timestamps to local dates and deduplicate
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const row of data) {
    const d = toLocalDateString(new Date(row.created_at));
    if (!seen.has(d)) {
      seen.add(d);
      dates.push(d);
    }
  }
  return dates;
}

/** Upsert the user's streak into user_streaks table. */
export async function upsertUserStreak(
  userId: string,
  currentStreak: number,
  longestStreak: number,
  lastWorkoutDate: string | null,
): Promise<void> {
  await supabase.from('user_streaks').upsert(
    {
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_workout_date: lastWorkoutDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
}

export async function getFriendStats(
  userId: string,
): Promise<{ workoutCount: number; totalVolume: number; streak: number }> {
  const [countRes, volumeRes, streakData] = await Promise.all([
    supabase
      .from('activity_feed')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    // Every post's volume (a single request stopped at 1000, so heavy users' totals were too low)
    fetchAllRows<{ total_volume: number | null }>((from, to) =>
      supabase
        .from('activity_feed')
        .select('total_volume')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    getUserStreak(userId),
  ]);

  const totalVolume = volumeRes.reduce(
    (sum: number, r: any) => sum + (Number(r.total_volume) || 0),
    0,
  );

  return {
    workoutCount: countRes.count || 0,
    totalVolume: Math.round(totalVolume),
    streak: streakData?.current_streak ?? 0,
  };
}
