import { supabase } from '../supabase';
import type { NudgeRow, CommentItem, ReportTargetType, ReportReason } from './types';
import { createNotification } from './notifications';

// Interactions on feed posts and between friends: bookmarks, comments, reactions, nudges, reports.

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
  const { data: profiles } = await supabase.rpc('list_public_profiles', { p_ids: userIds });

  const profileMap = new Map<string, { username: string | null; email: string }>();
  for (const p of profiles || []) {
    profileMap.set(p.id, { username: p.username, email: '' });
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

export async function addReaction(
  activityId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { error } = await supabase.from('reactions').insert({
    activity_id: activityId,
    user_id: userId,
    emoji,
  });
  if (error) {
    if (__DEV__) console.warn('[reactions] insert failed', error);
    return;
  }

  // Notify the post owner — fire-and-forget so we don't block the optimistic UI
  (async () => {
    try {
      const { data: activity } = await supabase
        .from('activity_feed')
        .select('user_id')
        .eq('id', activityId)
        .single();

      if (!activity || activity.user_id === userId) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, email')
        .eq('id', userId)
        .single();

      const name = profile?.username || profile?.email || 'Someone';
      const isHeart = emoji === '\u{2764}\u{FE0F}' || emoji === '❤️';

      await createNotification(
        activity.user_id,
        'reaction',
        isHeart ? 'New like' : 'New reaction',
        isHeart
          ? `${name} liked your workout`
          : `${name} reacted ${emoji} to your workout`,
        { from_user_id: userId, activity_id: activityId, emoji },
      );
    } catch {
      // ignore — notification is best-effort
    }
  })();
}

export async function removeReaction(
  activityId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', userId)
    .eq('emoji', emoji);
  if (error && __DEV__) console.warn('[reactions] delete failed', error);
}

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

  const { error: insertError } = await supabase.from('nudges').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    message,
  });
  // Used to report success (and notify) even when the nudge wasn't saved
  if (insertError) return { error: "Couldn't send the nudge. Try again." };

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

async function getLastNudge(
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

export async function reportContent(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  targetUserId: string | null,
  reason: ReportReason,
  details?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    target_user_id: targetUserId,
    reason,
    details: details?.trim() || null,
  });
  return { error: error?.message ?? null };
}
