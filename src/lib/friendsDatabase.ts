import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'reaction'
  | 'nudge'
  | 'leaderboard_weekly';

export interface FriendProfile {
  id: string;
  username: string | null;
  email: string;
  currentStreak: number;
}

export interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  friend_profile?: {
    id: string;
    username: string | null;
    email: string;
  };
}

export interface FeedSetDetail {
  kg: number;
  reps: number;
  set_number: number;
}

export interface FeedExerciseDetail {
  name: string;
  sets_count: number;
  best_kg: number;
  best_reps: number;
  total_volume: number;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  sets: FeedSetDetail[];
}

export interface ActivityFeedItem {
  id: string;
  user_id: string;
  workout_id: string | null;
  duration: number;
  total_volume: number;
  exercise_names: string[];
  total_exercises: number;
  total_sets: number;
  created_at: string;
  profile: { username: string | null; email: string };
  reactions: ReactionSummary[];
  exercise_details: FeedExerciseDetail[];
  streak: number;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  type: string;
  value: number;
  week_start: string;
  profile: { username: string | null; email: string };
  rank?: number;
}

export interface NudgeRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  username: string | null;
  email: string;
  friendshipStatus: FriendshipStatus | null;
}

export interface CommentItem {
  id: string;
  activity_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  created_at: string;
  profile: { username: string | null; email: string };
}

// ── Profiles ───────────────────────────────────────────

export async function searchProfiles(
  query: string,
  currentUserId: string,
): Promise<SearchResult[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, email')
    .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', currentUserId)
    .limit(20);

  if (!profiles || profiles.length === 0) return [];

  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

  const friendMap = new Map<string, FriendshipStatus>();
  for (const f of friendships || []) {
    const otherId = f.user_id === currentUserId ? f.friend_id : f.user_id;
    friendMap.set(otherId, f.status as FriendshipStatus);
  }

  return profiles
    .filter((p) => friendMap.get(p.id) !== 'blocked')
    .map((p) => ({
      id: p.id,
      username: p.username,
      email: p.email,
      friendshipStatus: friendMap.get(p.id) ?? null,
    }));
}

// ── Friends ────────────────────────────────────────────

export async function getFriendsList(userId: string): Promise<FriendProfile[]> {
  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted')
    .limit(500);

  if (!friendships || friendships.length === 0) return [];

  const friendIds = friendships.map((f) =>
    f.user_id === userId ? f.friend_id : f.user_id,
  );

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, email')
    .in('id', friendIds);

  if (!profiles) return [];

  return profiles.map((p) => ({
    id: p.id,
    username: p.username,
    email: p.email,
    currentStreak: 0,
  }));
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (!data) return [];
  return data.map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
}

export async function sendFriendRequest(
  userId: string,
  friendId: string,
): Promise<void> {
  const { data: friendship } = await supabase
    .from('friendships')
    .insert({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    })
    .select('id')
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, email')
    .eq('id', userId)
    .single();

  await createNotification(
    friendId,
    'friend_request',
    'New Friend Request',
    `${profile?.username || profile?.email || 'Someone'} wants to be friends`,
    { from_user_id: userId, friendship_id: friendship?.id },
  );
}

export async function acceptFriendRequest(
  friendshipId: string,
  acceptorId: string,
): Promise<void> {
  const { data: friendship } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select('user_id, friend_id')
    .single();

  if (friendship) {
    const senderId = friendship.user_id === acceptorId
      ? friendship.friend_id
      : friendship.user_id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', acceptorId)
      .single();

    await createNotification(
      senderId,
      'friend_accepted',
      'Friend Request Accepted',
      `${profile?.username || profile?.email || 'Someone'} accepted your request`,
      { from_user_id: acceptorId },
    );
  }
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
  await supabase.from('friendships').delete().eq('id', friendshipId);
}

export async function removeFriend(friendshipId: string): Promise<void> {
  await supabase.from('friendships').delete().eq('id', friendshipId);
}

export async function blockUser(
  userId: string,
  blockedUserId: string,
): Promise<void> {
  // Remove existing friendship first
  await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${blockedUserId}),and(user_id.eq.${blockedUserId},friend_id.eq.${userId})`,
    );

  await supabase.from('friendships').insert({
    user_id: userId,
    friend_id: blockedUserId,
    status: 'blocked',
  });
}

// ── Activity Feed ──────────────────────────────────────

export async function getFriendsFeed(
  friendIds: string[],
  currentUserId: string,
  limit: number,
  offset: number,
): Promise<ActivityFeedItem[]> {
  const allIds = [...friendIds, currentUserId];
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
): Promise<ActivityFeedItem[]> {
  let query = supabase
    .from('activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;

  if (!data || data.length === 0) return [];
  return attachProfilesAndReactions(data, currentUserId);
}

async function attachProfilesAndReactions(
  feedRows: any[],
  currentUserId: string,
): Promise<ActivityFeedItem[]> {
  const userIds = [...new Set(feedRows.map((r: any) => r.user_id))];
  const feedIds = feedRows.map((r: any) => r.id).filter(Boolean);
  const workoutIds = [...new Set(feedRows.map((r: any) => r.workout_id).filter(Boolean))];

  // Batch 1: profiles, reactions, exercise details, streaks (parallel)
  const [profilesRes, reactionsRes, exercisesRes, streaksRes] = await Promise.all([
    supabase.from('profiles').select('id, username, email').in('id', userIds),
    feedIds.length > 0
      ? supabase.from('reactions').select('*').in('activity_id', feedIds)
      : Promise.resolve({ data: [] as any[] }),
    workoutIds.length > 0
      ? supabase
          .from('exercises')
          .select('workout_id, name, exercise_order, sets(kg, reps, completed, set_number)')
          .in('workout_id', workoutIds)
          .order('exercise_order', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('user_streaks')
      .select('user_id, current_streak')
      .in('user_id', userIds),
  ]);

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
    profileMap.set(p.id, { username: p.username, email: p.email });
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
    let bestKg = 0;
    let bestReps = 0;
    let totalVol = 0;
    for (const s of completed) {
      const kg = Number(s.kg) || 0;
      const reps = Number(s.reps) || 0;
      totalVol += kg * reps;
      if (kg > bestKg) {
        bestKg = kg;
        bestReps = reps;
      }
    }

    const cat = catalogMap.get((ex as any).name);
    exercisesByWorkout[wid].push({
      name: (ex as any).name,
      sets_count: completed.length,
      best_kg: bestKg,
      best_reps: bestReps,
      total_volume: totalVol,
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

    // Use detailed exercise data if available; otherwise build from
    // the activity feed's denormalized exercise_names + catalog muscles
    let details = exercisesByWorkout[r.workout_id] || [];
    if (details.length === 0 && (r.exercise_names || []).length > 0) {
      const names: string[] = r.exercise_names;
      const totalSets = r.total_sets || 0;
      const perExVol = names.length > 0
        ? Math.round((r.total_volume || 0) / names.length)
        : 0;
      const perExSets = names.length > 0
        ? Math.round(totalSets / names.length)
        : 0;
      details = names.map((name: string) => {
        const cat = catalogMap.get(name);
        return {
          name,
          sets_count: perExSets,
          best_kg: 0,
          best_reps: 0,
          total_volume: perExVol,
          category: cat?.category || null,
          primary_muscles: cat?.primary_muscles || [],
          secondary_muscles: cat?.secondary_muscles || [],
          sets: [],
        };
      });
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
    };
  });
}

// ── Bookmarks ─────────────────────────────────────────

export async function getBookmarks(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('bookmarks')
    .select('activity_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data || []).map((r: any) => r.activity_id);
}

export async function addBookmark(
  userId: string,
  activityId: string,
): Promise<void> {
  await supabase.from('bookmarks').insert({
    user_id: userId,
    activity_id: activityId,
  });
}

export async function removeBookmark(
  userId: string,
  activityId: string,
): Promise<void> {
  await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('activity_id', activityId);
}

// ── Comments ──────────────────────────────────────────

export async function getComments(
  activityId: string,
  limit = 50,
  offset = 0,
): Promise<CommentItem[]> {
  const { data } = await supabase
    .from('comments')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((c: any) => c.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, email')
    .in('id', userIds);

  const profileMap = new Map<string, { username: string | null; email: string }>();
  for (const p of profiles || []) {
    profileMap.set(p.id, { username: p.username, email: p.email });
  }

  return data.map((c: any) => ({
    id: c.id,
    activity_id: c.activity_id,
    user_id: c.user_id,
    parent_id: c.parent_id,
    text: c.text,
    created_at: c.created_at,
    profile: profileMap.get(c.user_id) || { username: null, email: '' },
  }));
}

export async function addComment(
  activityId: string,
  userId: string,
  text: string,
  parentId?: string,
): Promise<CommentItem | null> {
  const { data } = await supabase
    .from('comments')
    .insert({
      activity_id: activityId,
      user_id: userId,
      text,
      parent_id: parentId || null,
    })
    .select('*')
    .single();

  if (!data) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, email')
    .eq('id', userId)
    .single();

  return {
    id: data.id,
    activity_id: data.activity_id,
    user_id: data.user_id,
    parent_id: data.parent_id,
    text: data.text,
    created_at: data.created_at,
    profile: profile || { username: null, email: '' },
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', commentId);
}

export async function getCommentCounts(
  activityIds: string[],
): Promise<Record<string, number>> {
  if (activityIds.length === 0) return {};

  const { data } = await supabase
    .from('comments')
    .select('activity_id')
    .in('activity_id', activityIds);

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.activity_id] = (counts[row.activity_id] || 0) + 1;
  }
  return counts;
}

// ── Reactions ──────────────────────────────────────────

export async function addReaction(
  activityId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  await supabase.from('reactions').insert({
    activity_id: activityId,
    user_id: userId,
    emoji,
  });
}

export async function removeReaction(
  activityId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  await supabase
    .from('reactions')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
}

// ── Nudges ─────────────────────────────────────────────

export async function sendNudge(
  senderId: string,
  receiverId: string,
  message: string,
): Promise<{ error: string | null }> {
  const lastNudge = await getLastNudge(senderId, receiverId);
  if (lastNudge) {
    const hoursSince =
      (Date.now() - new Date(lastNudge.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      return { error: 'You can only nudge this friend once every 24 hours' };
    }
  }

  await supabase.from('nudges').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    message,
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, email')
    .eq('id', senderId)
    .single();

  await createNotification(
    receiverId,
    'nudge',
    'You got a nudge!',
    `${profile?.username || profile?.email || 'A friend'}: ${message}`,
    { from_user_id: senderId },
  );

  return { error: null };
}

export async function getLastNudge(
  senderId: string,
  receiverId: string,
): Promise<NudgeRow | null> {
  const { data } = await supabase
    .from('nudges')
    .select('*')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as NudgeRow | null;
}

// ── Leaderboards ───────────────────────────────────────

export async function getLeaderboard(
  type: string,
  scope: 'friends' | 'global',
  friendIds: string[],
  currentUserId: string,
): Promise<LeaderboardEntry[]> {
  let query = supabase
    .from('leaderboard_entries')
    .select('*')
    .eq('type', type)
    .order('value', { ascending: false })
    .limit(50);

  if (scope === 'friends') {
    const allIds = [...friendIds, currentUserId];
    query = query.in('user_id', allIds);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((e: any) => e.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, email')
    .in('id', userIds);

  const profileMap = new Map<string, { username: string | null; email: string }>();
  for (const p of profiles || []) {
    profileMap.set(p.id, { username: p.username, email: p.email });
  }

  return data.map((e: any, i: number) => ({
    id: e.id,
    user_id: e.user_id,
    type: e.type,
    value: Number(e.value),
    week_start: e.week_start,
    profile: profileMap.get(e.user_id) || { username: null, email: '' },
    rank: i + 1,
  }));
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

// ── Notifications ──────────────────────────────────────

export async function getNotifications(
  userId: string,
  limit: number,
  offset: number,
): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return (data || []) as NotificationItem[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

export async function deleteAllNotifications(userId: string): Promise<void> {
  await supabase.from('notifications').delete().eq('user_id', userId);
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  data?: Record<string, any>,
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data: data || {},
    read: false,
  });
}

// ── Streaks ────────────────────────────────────────────

export async function getFriendStreak(
  userId: string,
): Promise<number> {
  const streak = await getUserStreak(userId);
  return streak?.current_streak ?? 0;
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
    const local = new Date(row.created_at);
    const yyyy = local.getFullYear();
    const mm = String(local.getMonth() + 1).padStart(2, '0');
    const dd = String(local.getDate()).padStart(2, '0');
    const d = `${yyyy}-${mm}-${dd}`;
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

// ── Friend Profile Stats ──────────────────────────────

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

// ── Friendship lookup helper ──────────────────────────

export async function getFriendshipBetween(
  userId: string,
  friendId: string,
): Promise<FriendshipRow | null> {
  const { data } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
    )
    .maybeSingle();

  return data as FriendshipRow | null;
}
