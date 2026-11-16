import { create } from 'zustand';
import {
  type FriendProfile,
  type ActivityFeedItem,
  type NotificationItem,
  type LeaderboardEntry,
  type LeaderboardType,
  type SearchResult,
  getFriends,
  getGlobalFeed,
  getFriendsFeed,
  getLeaderboard as dbGetLeaderboard,
  getNotifications as dbGetNotifications,
  getUnreadCount as dbGetUnreadCount,
  markAsRead as dbMarkAsRead,
  markAllRead as dbMarkAllRead,
  deleteAllNotifications as dbDeleteAll,
  setNotificationResponded as dbSetNotificationResponded,
  searchProfiles,
  sendFriendRequest as dbSendRequest,
  acceptFriendRequest as dbAcceptRequest,
  declineFriendRequest as dbDeclineRequest,
  addReaction as dbAddReaction,
  removeReaction as dbRemoveReaction,
  blockUser as dbBlockUser,
  getBlockedUserIds as dbGetBlockedUserIds,
  reportContent as dbReportContent,
  type ReportTargetType,
  type ReportReason,
} from '../lib/friendsDatabase';

const FEED_PAGE_SIZE = 15;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const MAX_FEED_ITEMS = 500;
const MAX_NOTIFICATIONS = 100;

type LeaderboardScope = 'friends' | 'global';
type LeaderboardCacheKey = `${LeaderboardScope}:${LeaderboardType}`;

function leaderboardCacheKey(
  scope: LeaderboardScope,
  type: LeaderboardType,
): LeaderboardCacheKey {
  return `${scope}:${type}`;
}

interface FriendsState {
  // Friends list
  friends: FriendProfile[];
  friendIds: string[];
  friendsFetchedAt: number | null;

  // Feed
  feed: ActivityFeedItem[];
  feedLoading: boolean;
  feedCursor: string | null;
  feedHasMore: boolean;
  feedFetchedAt: number | null;
  feedMode: 'global' | 'friends';
  setFeedMode: (mode: 'global' | 'friends') => void;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  leaderboardCache: Partial<Record<LeaderboardCacheKey, LeaderboardEntry[]>>;
  leaderboardLoading: boolean;
  leaderboardType: LeaderboardType;
  leaderboardScope: LeaderboardScope;

  // Notifications
  notifications: NotificationItem[];
  notificationsLoading: boolean;
  unreadCount: number;
  notifPage: number;
  notifHasMore: boolean;

  // Search
  searchResults: SearchResult[];
  searchLoading: boolean;

  // Blocks (users this user has blocked — one-way)
  blockedIds: string[];

  // Actions
  fetchFriends: (userId: string, force?: boolean) => Promise<void>;
  fetchFeed: (userId: string, reset?: boolean, force?: boolean) => Promise<void>;
  fetchLeaderboard: (userId: string, force?: boolean) => Promise<void>;
  setLeaderboardType: (type: LeaderboardType) => void;
  setLeaderboardScope: (scope: LeaderboardScope) => void;
  fetchNotifications: (userId: string, reset?: boolean) => Promise<void>;
  fetchUnreadCount: (userId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  deleteAllNotifications: (userId: string) => Promise<void>;
  setNotificationResponded: (notificationId: string, responded: 'accepted' | 'declined') => Promise<void>;
  searchUsers: (query: string, userId: string) => Promise<void>;
  clearSearch: () => void;
  /** Resolves false if the request couldn't be sent. */
  sendFriendRequest: (userId: string, friendId: string) => Promise<boolean>;
  acceptRequest: (friendshipId: string, userId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  addReaction: (activityId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (activityId: string, userId: string, emoji: string) => Promise<void>;
  fetchBlockedIds: (userId: string) => Promise<void>;
  blockUser: (userId: string, targetUserId: string) => Promise<void>;
  reportContent: (
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
    targetUserId: string | null,
    reason: ReportReason,
    details?: string,
  ) => Promise<{ error: string | null }>;
}

// Reaction writes for the same post go out one after another, so a quick like -> unlike can't
// reach the server in the wrong order (the UI updates before the write; see addReaction).
const _reactionQueue = new Map<string, Promise<void>>();
function queueReaction(activityId: string, write: () => Promise<void>): Promise<void> {
  const next = (_reactionQueue.get(activityId) ?? Promise.resolve()).then(write, write);
  const tail = next.catch(() => {});
  _reactionQueue.set(activityId, tail);
  tail.then(() => { if (_reactionQueue.get(activityId) === tail) _reactionQueue.delete(activityId); });
  return next;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  friendIds: [],
  friendsFetchedAt: null,

  feed: [],
  feedLoading: false,
  feedCursor: null,
  feedHasMore: true,
  feedFetchedAt: null,
  feedMode: 'global',
  setFeedMode: (mode) => {
    set({ feedMode: mode, feedCursor: null, feedHasMore: true, feedFetchedAt: null });
  },

  leaderboard: [],
  leaderboardCache: {},
  leaderboardLoading: false,
  leaderboardType: 'strength',
  leaderboardScope: 'global',

  notifications: [],
  notificationsLoading: false,
  unreadCount: 0,
  notifPage: 0,
  notifHasMore: true,

  searchResults: [],
  searchLoading: false,

  blockedIds: [],

  fetchFriends: async (userId, force = false) => {
    const { friendsFetchedAt, friends: cached } = get();
    if (
      !force &&
      cached.length > 0 &&
      friendsFetchedAt &&
      Date.now() - friendsFetchedAt < CACHE_TTL
    ) {
      return;
    }

    const { friends, friendIds } = await getFriends(userId);
    set({ friends, friendIds, friendsFetchedAt: Date.now() });
  },

  fetchFeed: async (userId, reset = false, force = false) => {
    const { feedCursor, feedHasMore, feedFetchedAt, feed: cached, feedMode, friendIds } = get();

    if (
      reset &&
      !force &&
      cached.length > 0 &&
      feedFetchedAt &&
      Date.now() - feedFetchedAt < CACHE_TTL
    ) {
      return;
    }

    if (!reset && !feedHasMore) return;

    const cursor = reset ? null : feedCursor;

    set({ feedLoading: true });
    try {
      const blockedIds = get().blockedIds;
      const items = feedMode === 'friends'
        ? await getFriendsFeed(friendIds, userId, FEED_PAGE_SIZE, reset ? 0 : cached.length, blockedIds)
        : await getGlobalFeed(userId, FEED_PAGE_SIZE, cursor, blockedIds);

      const merged = reset ? items : [...get().feed, ...items];
      const seen = new Set<string>();
      const deduped = merged.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).slice(0, MAX_FEED_ITEMS);

      const lastItem = items.length > 0 ? items[items.length - 1] : null;

      set({
        feed: deduped,
        feedCursor: lastItem ? lastItem.created_at : feedCursor,
        feedHasMore: items.length === FEED_PAGE_SIZE,
        feedFetchedAt: reset ? Date.now() : get().feedFetchedAt,
      });
    } finally {
      set({ feedLoading: false });
    }
  },

  fetchLeaderboard: async (userId, force = false) => {
    const {
      leaderboardType,
      leaderboardScope,
      leaderboardCache,
      friendIds,
      blockedIds,
    } = get();
    const cacheKey = leaderboardCacheKey(leaderboardScope, leaderboardType);
    const cached = leaderboardCache[cacheKey];
    // Never let an empty response become sticky for the whole app session.
    // Empty boards are cheap to refetch and may be the result of a transient
    // RPC/deployment race rather than genuinely having no ranked users.
    if (!force && cached !== undefined && cached.length > 0) {
      set({ leaderboard: cached, leaderboardLoading: false });
      return;
    }

    set({ leaderboardLoading: true });
    try {
      const entries = await dbGetLeaderboard(
        leaderboardType,
        leaderboardScope,
        friendIds,
        userId,
        blockedIds,
      );
      const previousRanks = new Map(
        (leaderboardCache[cacheKey] ?? []).map((entry) => [entry.user_id, entry.rank]),
      );
      const rankedEntries = entries.map((entry) => {
        const previousRank = previousRanks.get(entry.user_id);
        return {
          ...entry,
          rankChange: previousRank === undefined ? 0 : previousRank - entry.rank,
        };
      });
      set((state) => {
        const activeKey = leaderboardCacheKey(
          state.leaderboardScope,
          state.leaderboardType,
        );
        return {
          leaderboardCache: {
            ...state.leaderboardCache,
            [cacheKey]: rankedEntries,
          },
          ...(activeKey === cacheKey ? { leaderboard: rankedEntries } : {}),
        };
      });
    } finally {
      const activeKey = leaderboardCacheKey(
        get().leaderboardScope,
        get().leaderboardType,
      );
      if (activeKey === cacheKey) set({ leaderboardLoading: false });
    }
  },

  setLeaderboardType: (type) => set((state) => ({
    leaderboardType: type,
    leaderboard: state.leaderboardCache[
      leaderboardCacheKey(state.leaderboardScope, type)
    ] ?? [],
    leaderboardLoading: false,
  })),
  setLeaderboardScope: (scope) => set((state) => ({
    leaderboardScope: scope,
    leaderboard: state.leaderboardCache[
      leaderboardCacheKey(scope, state.leaderboardType)
    ] ?? [],
    leaderboardLoading: false,
  })),

  fetchNotifications: async (userId, reset = false) => {
    const { notifPage, notifHasMore } = get();
    if (!reset && !notifHasMore) return;

    const page = reset ? 0 : notifPage;
    const offset = page * FEED_PAGE_SIZE;

    set({ notificationsLoading: true });
    try {
      const items = await dbGetNotifications(userId, FEED_PAGE_SIZE, offset);
      const merged = reset ? items : [...get().notifications, ...items];
      set({
        notifications: merged.slice(0, MAX_NOTIFICATIONS),
        notifPage: page + 1,
        notifHasMore: items.length === FEED_PAGE_SIZE,
      });
    } finally {
      set({ notificationsLoading: false });
    }
  },

  fetchUnreadCount: async (userId) => {
    const count = await dbGetUnreadCount(userId);
    set({ unreadCount: count });
  },

  markNotificationRead: async (notificationId) => {
    await dbMarkAsRead(notificationId);
    set((s) => {
      // Only an unread one lowers the badge (a double tap, or an already-read row, must not)
      const wasUnread = s.notifications.some((n) => n.id === notificationId && !n.read);
      if (!wasUnread) return {};
      return {
        notifications: s.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      };
    });
  },

  markAllNotificationsRead: async (userId) => {
    try {
      await dbMarkAllRead(userId);
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },

  deleteAllNotifications: async (userId) => {
    try {
      await dbDeleteAll(userId);
      set({ notifications: [], unreadCount: 0, notifPage: 0, notifHasMore: true });
    } catch {}
  },

  setNotificationResponded: async (notificationId, responded) => {
    // Optimistic local update so the row keeps its state across remounts even
    // if the network call lags or fails.
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === notificationId
          ? { ...n, read: true, data: { ...(n.data || {}), responded } }
          : n,
      ),
    }));
    try {
      await dbSetNotificationResponded(notificationId, responded);
    } catch {}
  },

  searchUsers: async (query, userId) => {
    set({ searchLoading: true });
    try {
      const results = await searchProfiles(query, userId);
      set({ searchResults: results });
    } finally {
      set({ searchLoading: false });
    }
  },

  clearSearch: () => set({ searchResults: [], searchLoading: false }),

  sendFriendRequest: async (userId, friendId) => {
    const sent = await dbSendRequest(userId, friendId);
    if (!sent) return false;
    set((s) => ({
      searchResults: s.searchResults.map((r) =>
        r.id === friendId ? { ...r, friendshipStatus: 'pending' as const } : r,
      ),
    }));
    return true;
  },

  acceptRequest: async (friendshipId, userId) => {
    await dbAcceptRequest(friendshipId, userId);
    await get().fetchFriends(userId, true);
  },

  declineRequest: async (friendshipId) => {
    await dbDeclineRequest(friendshipId);
  },

  // Optimistic: the heart updates on tap, then the write goes out. (The db helpers log and swallow
  // errors, so the UI ended in this state on failure before too, only a round-trip later.)
  addReaction: async (activityId, userId, emoji) => {
    set((s) => ({
      feed: s.feed.map((item) => {
        if (item.id !== activityId) return item;
        const existing = item.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          return {
            ...item,
            reactions: item.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r,
            ),
          };
        }
        return {
          ...item,
          reactions: [...item.reactions, { emoji, count: 1, reacted: true }],
        };
      }),
    }));
    await queueReaction(activityId, () => dbAddReaction(activityId, userId, emoji));
  },

  removeReaction: async (activityId, userId, emoji) => {
    set((s) => ({
      feed: s.feed.map((item) => {
        if (item.id !== activityId) return item;
        return {
          ...item,
          reactions: item.reactions
            .map((r) =>
              r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r,
            )
            .filter((r) => r.count > 0),
        };
      }),
    }));
    await queueReaction(activityId, () => dbRemoveReaction(activityId, userId, emoji));
  },

  fetchBlockedIds: async (userId) => {
    const ids = await dbGetBlockedUserIds(userId);
    set({ blockedIds: ids });
  },

  blockUser: async (userId, targetUserId) => {
    // Optimistic update — drop the user from local feed/friends/leaderboard caches.
    const prev = get();
    const filterOut = (ids: string[]) => ids.filter((id) => id !== targetUserId);
    set({
      blockedIds: [...prev.blockedIds, targetUserId],
      friends: prev.friends.filter((f) => f.id !== targetUserId),
      friendIds: filterOut(prev.friendIds),
      feed: prev.feed.filter((item) => item.user_id !== targetUserId),
      leaderboard: prev.leaderboard.filter((entry) => entry.user_id !== targetUserId),
      searchResults: prev.searchResults.filter((r) => r.id !== targetUserId),
    });
    try {
      await dbBlockUser(userId, targetUserId);
    } catch (err) {
      // Rollback on failure
      set({
        blockedIds: prev.blockedIds,
        friends: prev.friends,
        friendIds: prev.friendIds,
        feed: prev.feed,
        leaderboard: prev.leaderboard,
        searchResults: prev.searchResults,
      });
      throw err;
    }
  },

  reportContent: async (reporterId, targetType, targetId, targetUserId, reason, details) => {
    return dbReportContent(reporterId, targetType, targetId, targetUserId, reason, details);
  },
}));
