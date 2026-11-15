import { supabase } from '../supabase';
import { toLocalDateString } from '../../utils/localDate';

// Workout streaks and a friend's profile stats.

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
  const { data } = await supabase
    .from('workouts')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) return [];

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
    supabase
      .from('activity_feed')
      .select('total_volume')
      .eq('user_id', userId),
    getUserStreak(userId),
  ]);

  const totalVolume = (volumeRes.data || []).reduce(
    (sum: number, r: any) => sum + (Number(r.total_volume) || 0),
    0,
  );

  return {
    workoutCount: countRes.count || 0,
    totalVolume: Math.round(totalVolume),
    streak: streakData?.current_streak ?? 0,
  };
}
