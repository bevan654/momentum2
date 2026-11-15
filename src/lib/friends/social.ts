import { supabase } from '../supabase';
import type { ReportTargetType, ReportReason } from './types';
import { createNotification } from './notifications';

// Interactions on feed posts: reactions and reports.

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
