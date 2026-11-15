import { supabase } from '../supabase';
import { toLocalDateString } from '../../utils/localDate';

// Workout streaks and a friend's profile stats.

// Supabase returns at most 1000 rows per request, so whole-history reads go page by page.
const PAGE_SIZE = 1000;
const MAX_PAGES = 20; // 20k rows: a safety stop, far beyond any real history

async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    // null, not the rows so far: a partial history would give a wrong (too low) streak or total
    if (error || !data) return null;
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

/** Fetch distinct workout dates (YYYY-MM-DD) for a user, descending. null if the history couldn't be read. */
export async function fetchWorkoutDates(
  userId: string,
): Promise<string[] | null> {
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

  if (!data) return null;
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

