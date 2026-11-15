import { supabase } from '../supabase';
import type { LeaderboardEntry, LeaderboardType } from './types';

// Community leaderboards.

export async function getLeaderboard(
  type: LeaderboardType,
  scope: 'friends' | 'global',
  friendIds: string[],
  currentUserId: string,
  blockedIds: string[] = [],
): Promise<LeaderboardEntry[]> {
  const visibleFriendIds = [...new Set([...friendIds, currentUserId])]
    .filter((id) => !blockedIds.includes(id));

  const { data, error } = await supabase.rpc('get_community_leaderboard', {
    p_type: type,
    p_scope: scope,
    p_friend_ids: visibleFriendIds,
    p_blocked_ids: blockedIds,
  });

  if (error) {
    if (__DEV__) {
      console.warn('Leaderboard RPC failed', {
        type,
        scope,
        message: error.message,
      });
    }
    // Compatibility path for projects where the new leaderboard RPC has not
    // been deployed yet. The legacy enum calls strength entries `volume`.
    if (type !== 'strength' && type !== 'streak') return [];
    const legacyType = type === 'strength' ? 'volume' : 'streak';
    let legacyQuery = supabase
      .from('leaderboard_entries')
      .select('user_id, type, value, week_start')
      .eq('type', legacyType)
      .order('week_start', { ascending: false })
      .order('value', { ascending: false })
      .limit(200);

    if (scope === 'friends') {
      if (visibleFriendIds.length === 0) return [];
      legacyQuery = legacyQuery.in('user_id', visibleFriendIds);
    } else if (blockedIds.length > 0) {
      legacyQuery = legacyQuery.not('user_id', 'in', `(${blockedIds.join(',')})`);
    }

    const { data: legacyData, error: legacyError } = await legacyQuery;
    if (legacyError || !legacyData || legacyData.length === 0) return [];

    const latestWeek = legacyData[0].week_start;
    const latestEntries = legacyData
      .filter((entry: any) => entry.week_start === latestWeek)
      .slice(0, 50);
    const userIds = [...new Set(latestEntries.map((entry: any) => entry.user_id))];
    const { data: profiles } = await supabase.rpc('list_public_profiles', { p_ids: userIds });
    const usernames = new Map<string, string | null>(
      (profiles || []).map((profile: any) => [profile.id, profile.username]),
    );

    return latestEntries.map((entry: any, index: number) => ({
      user_id: entry.user_id,
      type,
      value: Number(entry.value) || 0,
      profile: { username: usernames.get(entry.user_id) ?? null, email: '' },
      rank: index + 1,
    }));
  }

  if (!data) return [];

  return data.map((entry: any) => ({
    user_id: entry.user_id,
    type: entry.type as LeaderboardType,
    value: Number(entry.value) || 0,
    profile: { username: entry.username ?? null, email: '' },
    rank: Number(entry.rank) || 0,
  }));
}
