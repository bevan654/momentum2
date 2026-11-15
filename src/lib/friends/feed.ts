import { supabase } from '../supabase';
import { bestSet } from '../../utils/feedExerciseDetails';
import type { FeedExerciseDetail, ActivityFeedItem, ReactionSummary } from './types';

// Activity feed (friends and global) with profiles, reactions, photos and exercise details attached.

const PHOTO_BUCKET = 'workout_photos';

export async function getFriendsFeed(
  friendIds: string[],
  currentUserId: string,
  limit: number,
  offset: number,
  blockedIds: string[] = [],
): Promise<ActivityFeedItem[]> {
  const allIds = [...friendIds, currentUserId].filter((id) => !blockedIds.includes(id));
  if (allIds.length === 0) return [];
  const { data } = await supabase
    .from('activity_feed')
    .select('*')
    .in('user_id', allIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!data || data.length === 0) return [];
  return attachProfilesAndReactions(data, currentUserId);
}

export async function getGlobalFeed(
  currentUserId: string,
  limit: number,
  cursor?: string | null,
  blockedIds: string[] = [],
): Promise<ActivityFeedItem[]> {
  // Goes through a SECURITY DEFINER RPC so we can return rows from users who
  // aren't friends with the current viewer (a plain `from('activity_feed')`
  // query gets filtered to friends-only by RLS).
  const { data, error } = await supabase.rpc('get_global_feed', {
    p_limit: limit,
    p_cursor: cursor ?? null,
    p_blocked: blockedIds,
  });

  if (error || !data || data.length === 0) return [];
  // Strip friends-only posts authored by users who aren't the viewer.
  // (The viewer always sees their own posts even if marked friends_only.)
  // The RPC returns full activity_feed rows so the column is available.
  const filtered = (data as any[]).filter(
    (r) => !r.friends_only || r.user_id === currentUserId,
  );
  if (filtered.length === 0) return [];
  return attachProfilesAndReactions(filtered, currentUserId);
}

async function attachProfilesAndReactions(
  feedRows: any[],
  currentUserId: string,
): Promise<ActivityFeedItem[]> {
  const userIds = [...new Set(feedRows.map((r: any) => r.user_id))];
  const feedIds = feedRows.map((r: any) => r.id).filter(Boolean);
  const workoutIds = [...new Set(feedRows.map((r: any) => r.workout_id).filter(Boolean))];

  // Batch 1: profiles, reactions, exercise details, streaks, workout photos (parallel)
  const [profilesRes, reactionsRes, exercisesRes, streaksRes, workoutsRes] = await Promise.all([
    // Uses an RPC instead of `from('profiles')` so non-friend posters in the
    // global feed still resolve to a username (RLS now hides strangers' rows).
    supabase.rpc('list_public_profiles', { p_ids: userIds }),
    feedIds.length > 0
      ? supabase.from('reactions').select('*').in('activity_id', feedIds)
      : Promise.resolve({ data: [] as any[] }),
    workoutIds.length > 0
      ? supabase
          .from('exercises')
          .select('workout_id, name, exercise_order, exercise_type, sets(kg, reps, completed, set_number)')
          .in('workout_id', workoutIds)
          .order('exercise_order', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    supabase.rpc('list_public_streaks', { p_ids: userIds }),
    // Workout photos. Uses a SECURITY DEFINER RPC instead of `from('workouts')`
    // so strangers' photos in the global feed aren't blocked by owner-only RLS.
    workoutIds.length > 0
      ? supabase.rpc('list_workout_photos', { p_workout_ids: workoutIds })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Build workoutId → public photo URL map
  const photoUrlByWorkout = new Map<string, string>();
  for (const w of (workoutsRes.data as any[]) || []) {
    if (!w.photo_path) continue;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(w.photo_path);
    if (data?.publicUrl) photoUrlByWorkout.set(w.id, data.publicUrl);
  }

  // Batch 2: catalog for muscle groups (depends on exercise names)
  // Include names from BOTH the exercises query AND the activity feed's exercise_names
  // so the catalog is available even when detailed exercise data can't be fetched (e.g. RLS)
  const exNamesFromQuery = (exercisesRes.data || []).map((e: any) => e.name);
  const exNamesFromFeed = feedRows.flatMap((r: any) => r.exercise_names || []);
  const exNames = [...new Set([...exNamesFromQuery, ...exNamesFromFeed])];
  const catalogRes = exNames.length > 0
    ? await supabase
        .from('exercises_catalog')
        .select('name, category, primary_muscles, secondary_muscles')
        .in('name', exNames)
    : { data: [] as any[] };

  // Build profile map
  const profileMap = new Map<string, { username: string | null; email: string }>();
  for (const p of profilesRes.data || []) {
    // RPC list_public_profiles doesn't return email; keep the field for type
    // compatibility but leave it empty.
    profileMap.set(p.id, { username: p.username, email: (p as any).email ?? '' });
  }

  // Build streak map
  const streakMap = new Map<string, number>();
  for (const s of streaksRes.data || []) {
    streakMap.set(s.user_id, s.current_streak ?? 0);
  }

  // Build reaction map — group reactions by activity_id first (O(n) instead of O(n*m))
  const reactionsByActivity = new Map<string, any[]>();
  for (const r of reactionsRes.data || []) {
    const arr = reactionsByActivity.get(r.activity_id);
    if (arr) arr.push(r);
    else reactionsByActivity.set(r.activity_id, [r]);
  }

  const reactionMap = new Map<string, ReactionSummary[]>();
  for (const feedId of feedIds) {
    const feedReactions = reactionsByActivity.get(feedId) || [];
    const emojiCounts = new Map<string, { count: number; reacted: boolean }>();
    for (const r of feedReactions) {
      const existing = emojiCounts.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === currentUserId) existing.reacted = true;
      } else {
        emojiCounts.set(r.emoji, { count: 1, reacted: r.user_id === currentUserId });
      }
    }
    reactionMap.set(
      feedId,
      Array.from(emojiCounts.entries()).map(([emoji, data]) => ({
        emoji,
        ...data,
      })),
    );
  }

  // Build catalog map
  const parseArr = (v: any): string[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {}
      if (v.startsWith('{') && v.endsWith('}')) {
        return v.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^"|"$/g, ''));
      }
    }
    return [];
  };

  const catalogMap = new Map<string, { category: string; primary_muscles: string[]; secondary_muscles: string[] }>();
  for (const c of catalogRes.data || []) {
    catalogMap.set(c.name, {
      category: c.category,
      primary_muscles: parseArr(c.primary_muscles),
      secondary_muscles: parseArr(c.secondary_muscles),
    });
  }

  // Build exercise details by workout
  const exercisesByWorkout: Record<string, FeedExerciseDetail[]> = {};
  for (const ex of exercisesRes.data || []) {
    const wid = (ex as any).workout_id;
    if (!exercisesByWorkout[wid]) exercisesByWorkout[wid] = [];

    const completed = ((ex as any).sets || []).filter((s: any) => s.completed || (Number(s.kg) > 0 || Number(s.reps) > 0));
    let totalVol = 0;
    let totalReps = 0;
    for (const s of completed) {
      totalVol += (Number(s.kg) || 0) * (Number(s.reps) || 0);
      totalReps += Number(s.reps) || 0;
    }
    const best = bestSet(completed.map((s: any) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })));

    const cat = catalogMap.get((ex as any).name);
    exercisesByWorkout[wid].push({
      name: (ex as any).name,
      sets_count: completed.length,
      best_kg: best.kg,
      best_reps: best.reps,
      total_volume: totalVol,
      total_reps: totalReps,
      exercise_type: (ex as any).exercise_type ?? null,
      category: cat?.category || null,
      primary_muscles: cat?.primary_muscles || [],
      secondary_muscles: cat?.secondary_muscles || [],
      sets: completed
        .map((s: any) => ({
          kg: Number(s.kg) || 0,
          reps: Number(s.reps) || 0,
          set_number: Number(s.set_number) || 0,
        }))
        .sort((a: any, b: any) => a.set_number - b.set_number),
    });
  }

  return feedRows.map((r: any, i: number) => {
    const id = r.id ?? r.workout_id ?? `feed-${r.user_id}-${i}`;

    // 1. Prefer denormalized exercise_details from the feed row (always accessible)
    // 2. Fall back to joined exercises/sets query (may be blocked by RLS)
    // 3. Last resort: exercise names only
    const feedDetails: any[] | null = Array.isArray(r.exercise_details) ? r.exercise_details : null;
    let details: FeedExerciseDetail[];

    if (feedDetails && feedDetails.length > 0) {
      details = feedDetails.map((fd: any) => {
        const cat = catalogMap.get(fd.name);
        const pm = Array.isArray(fd.primary_muscles) && fd.primary_muscles.length > 0
          ? fd.primary_muscles
          : cat?.primary_muscles || [];
        const sm = Array.isArray(fd.secondary_muscles) && fd.secondary_muscles.length > 0
          ? fd.secondary_muscles
          : cat?.secondary_muscles || [];
        return {
          name: fd.name,
          sets_count: fd.sets_count ?? 0,
          best_kg: fd.best_kg ?? 0,
          best_reps: fd.best_reps ?? 0,
          total_volume: fd.total_volume ?? 0,
          total_reps: fd.total_reps ?? null,
          exercise_type: fd.exercise_type ?? null,
          category: fd.category || cat?.category || null,
          primary_muscles: pm,
          secondary_muscles: sm,
          sets: fd.sets || [],
        };
      });
    } else {
      details = exercisesByWorkout[r.workout_id] || [];
      if (details.length === 0 && (r.exercise_names || []).length > 0) {
        details = (r.exercise_names as string[]).map((name: string) => {
          const cat = catalogMap.get(name);
          return {
            name,
            sets_count: 0,
            best_kg: 0,
            best_reps: 0,
            total_volume: 0,
            category: cat?.category || null,
            primary_muscles: cat?.primary_muscles || [],
            secondary_muscles: cat?.secondary_muscles || [],
            sets: [],
          };
        });
      }
    }

    return {
      id,
      user_id: r.user_id,
      workout_id: r.workout_id,
      duration: r.duration,
      total_volume: r.total_volume,
      exercise_names: r.exercise_names || [],
      total_exercises: r.total_exercises,
      total_sets: r.total_sets,
      created_at: r.created_at,
      profile: profileMap.get(r.user_id) || { username: null, email: '' },
      reactions: reactionMap.get(r.id) || [],
      exercise_details: details,
      streak: streakMap.get(r.user_id) ?? 0,
      ghost_username: r.ghost_username || null,
      ghost_result: r.ghost_result || null,
      ghost_exercises: r.ghost_exercises || null,
      routine_name: r.routine_name || null,
      program_name: r.program_name || null,
      program_week: r.program_week || null,
      program_total_weeks: r.program_total_weeks || null,
      program_day_label: r.program_day_label || null,
      photo_url: r.workout_id ? (photoUrlByWorkout.get(r.workout_id) ?? null) : null,
      title: r.title || null,
      caption: r.caption || null,
    };
  });
}
