import { supabase } from '../supabase';
import type { NotificationType, NotificationItem } from './types';

// In-app notifications. createNotification is shared with the other files in lib/friends but not re-exported from friendsDatabase.

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

/** Mark a friend-request notification as accepted/declined and persist it in `data`. */
export async function setNotificationResponded(
  notificationId: string,
  responded: 'accepted' | 'declined',
): Promise<void> {
  const { data: row } = await supabase
    .from('notifications')
    .select('data')
    .eq('id', notificationId)
    .single();
  const merged = { ...(row?.data || {}), responded };
  await supabase
    .from('notifications')
    .update({ data: merged, read: true })
    .eq('id', notificationId);
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
