import { supabase } from './supabase';
import { createNotification } from './friendsDatabase';

// ── Types ──────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  friendId: string;
  friendUsername: string | null;
  friendEmail: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageSender: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  read: boolean;
  created_at: string;
  /** True while the message is being sent (optimistic) */
  pending?: boolean;
  /** Temporary ID assigned before DB insert */
  tempId?: string;
}

// ── Conversations ──────────────────────────────────────

/**
 * Get or create a 1-on-1 conversation between two users.
 * UUIDs are sorted lexicographically so the pair is always canonical.
 */
export async function getOrCreateConversation(
  userId: string,
  friendId: string,
): Promise<string> {
  const [p1, p2] = [userId, friendId].sort();

  // Try to find existing
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id')
    .single();

  // Race condition: another client created it between our select and insert
  if (error) {
    const { data: retry } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .single();

    if (retry) return retry.id;
    throw error;
  }

  return created.id;
}

/**
 * Fetch all conversations for a user, enriched with friend profile + unread counts.
 * Sorted by most recent message.
 */
export async function getConversations(
  userId: string,
): Promise<ConversationSummary[]> {
  const { data: rows } = await supabase
    .from('conversations')
    .select('*')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (!rows || rows.length === 0) return [];

  // Extract friend IDs
  const friendIds = rows.map((r: any) =>
    r.participant_1 === userId ? r.participant_2 : r.participant_1,
  );

  // Batch: profiles + unread counts (parallel)
  const [profilesRes, unreadRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', friendIds),
    supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', rows.map((r: any) => r.id))
      .eq('read', false)
      .neq('sender_id', userId),
  ]);

  // Profile map
  const profileMap = new Map<string, { username: string | null; email: string }>();
  for (const p of profilesRes.data || []) {
    profileMap.set(p.id, { username: p.username, email: p.email });
  }

  // Unread count map
  const unreadMap = new Map<string, number>();
  for (const r of unreadRes.data || []) {
    unreadMap.set(r.conversation_id, (unreadMap.get(r.conversation_id) || 0) + 1);
  }

  return rows.map((r: any) => {
    const friendId = r.participant_1 === userId ? r.participant_2 : r.participant_1;
    const profile = profileMap.get(friendId);
    return {
      id: r.id,
      friendId,
      friendUsername: profile?.username ?? null,
      friendEmail: profile?.email ?? '',
      lastMessageText: r.last_message_text,
      lastMessageAt: r.last_message_at,
      lastMessageSender: r.last_message_sender,
      unreadCount: unreadMap.get(r.id) || 0,
    };
  });
}

// ── Messages ───────────────────────────────────────────

/**
 * Fetch messages for a conversation (cursor-based, newest first).
 */
export async function getMessages(
  conversationId: string,
  limit: number,
  cursor?: string | null,
): Promise<ChatMessage[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data } = await query;
  return (data || []) as ChatMessage[];
}

/**
 * Send a message. Updates the conversation's last_message fields.
 * Also creates a notification for the recipient.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  recipientId: string,
): Promise<ChatMessage | null> {
  const { data: message } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      text,
    })
    .select('*')
    .single();

  if (!message) return null;

  // Update conversation denormalized fields (fire-and-forget)
  supabase
    .from('conversations')
    .update({
      last_message_text: text,
      last_message_at: message.created_at,
      last_message_sender: senderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .then(() => {});

  // Create notification for recipient (fire-and-forget)
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, email')
    .eq('id', senderId)
    .single();

  createNotification(
    recipientId,
    'chat_message' as any,
    'New Message',
    `${profile?.username || profile?.email || 'Someone'}: ${text.slice(0, 100)}`,
    { from_user_id: senderId, conversation_id: conversationId },
  ).catch(() => {});

  return message as ChatMessage;
}

/**
 * Mark all unread messages in a conversation as read (for messages not sent by userId).
 * Returns IDs of updated messages.
 */
export async function markMessagesRead(
  conversationId: string,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .eq('read', false)
    .neq('sender_id', userId)
    .select('id');

  return (data || []).map((r: any) => r.id);
}

/**
 * Get total unread message count across all conversations.
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  // First get all conversation IDs for this user
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  if (!convs || convs.length === 0) return 0;

  const convIds = convs.map((c: any) => c.id);

  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', convIds)
    .eq('read', false)
    .neq('sender_id', userId);

  return count || 0;
}
