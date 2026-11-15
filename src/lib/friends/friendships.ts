import { supabase } from '../supabase';
import type { FriendshipStatus, FriendProfile, FriendshipRow, SearchResult } from './types';
import { createNotification } from './notifications';

// Profile search, friend list, requests, removing, blocking.

export async function searchProfiles(
  query: string,
  currentUserId: string,
): Promise<SearchResult[]> {
  // Username-only — searching by email would let anyone confirm whether a given
  // address has an account, which is a privacy / enumeration leak.
  // Goes through a SECURITY DEFINER RPC since direct profile reads are RLS'd
  // to self + accepted friends.
  const { data: profiles } = await supabase.rpc('search_public_profiles', {
    p_query: query,
    p_current_user: currentUserId,
  });

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
    .filter((p: any) => friendMap.get(p.id) !== 'blocked')
    .map((p: any) => ({
      id: p.id,
      username: p.username,
      email: '',
      friendshipStatus: friendMap.get(p.id) ?? null,
    }));
}

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
    .from('public_profiles')
    .select('id, username')
    .in('id', friendIds);

  if (!profiles) return [];

  return profiles.map((p) => ({
    id: p.id,
    username: p.username,
    email: '',
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

/** Returns false if the request couldn't be saved (then no notification is sent). */
export async function sendFriendRequest(
  userId: string,
  friendId: string,
): Promise<boolean> {
  const { data: friendship, error: insertError } = await supabase
    .from('friendships')
    .insert({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    })
    .select('id')
    .single();
  // Failed insert (offline, duplicate request, blocked): don't notify about a request that doesn't exist
  if (insertError || !friendship) return false;

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
    { from_user_id: userId, friendship_id: friendship.id },
  );
  return true;
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

export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  await supabase
    .from('friendships')
    .delete()
    .eq('user_id', userId)
    .eq('friend_id', blockedUserId)
    .eq('status', 'blocked');
}

/** IDs of users this user has blocked. One-way: who I've chosen not to see. */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('status', 'blocked');
  return (data ?? []).map((row: { friend_id: string }) => row.friend_id);
}

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
