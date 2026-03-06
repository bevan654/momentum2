import { create } from 'zustand';
import {
  type FriendProfile,
  type ActivityFeedItem,
  type NotificationItem,
  type LeaderboardEntry,
  type SearchResult,
  getFriendsList,
  getFriendIds,
  getGlobalFeed,
  getFriendsFeed,
  getLeaderboard as dbGetLeaderboard,
  getNotifications as dbGetNotifications,
  getUnreadCount as dbGetUnreadCount,
  markAsRead as dbMarkAsRead,
  markAllRead as dbMarkAllRead,
  deleteAllNotifications as dbDeleteAll,
  searchProfiles,
  sendFriendRequest as dbSendRequest,
  acceptFriendRequest as dbAcceptRequest,
  declineFriendRequest as dbDeclineRequest,
  sendNudge as dbSendNudge,
  addReaction as dbAddReaction,
  removeReaction as dbRemoveReaction,
  removeFriend as dbRemoveFriend,
  getBookmarks as dbGetBookmarks,
  addBookmark as dbAddBookmark,
  removeBookmark as dbRemoveBookmark,
  type CommentItem,
  getComments as dbGetComments,
  addComment as dbAddComment,
  deleteComment as dbDeleteComment,
  getCommentCounts as dbGetCommentCounts,
} from '../lib/friendsDatabase';

const FEED_PAGE_SIZE = 15;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const MAX_FEED_ITEMS = 100;
const MAX_NOTIFICATIONS = 100;
const MAX_COMMENT_THREADS = 30;

interface FriendsState {
  // Friends list
  friends: FriendProfile[];
  friendsLoading: boolean;
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
  pendingFeedItems: ActivityFeedItem[];
  addPendingFeedItem: (item: ActivityFeedItem) => void;
  flushPendingFeed: () => void;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardType: 'volume' | 'streak';
  leaderboardScope: 'friends' | 'global';

  // Notifications
  notifications: NotificationItem[];
  notificationsLoading: boolean;
  unreadCount: number;
  notifPage: number;
  notifHasMore: boolean;

  // Search
  searchResults: SearchResult[];
  searchLoading: boolean;

  // Bookmarks
  bookmarks: string[];
  bookmarksLoading: boolean;

  // Comments
  comments: Record<string, CommentItem[]>;
  commentsLoading: boolean;
  commentCounts: Record<string, number>;

  // Profile sheet
  profileSheetFriend: FriendProfile | null;
  profileSheetVisible: boolean;
  showProfileSheet: (friend: FriendProfile) => void;
  hideProfileSheet: () => void;

  // Actions
  fetchFriends: (userId: string, force?: boolean) => Promise<void>;
  fetchFeed: (userId: string, reset?: boolean, force?: boolean) => Promise<void>;
  fetchLeaderboard: (userId: string) => Promise<void>;
  setLeaderboardType: (type: 'volume' | 'streak') => void;
  setLeaderboardScope: (scope: 'friends' | 'global') => void;
  fetchNotifications: (userId: string, reset?: boolean) => Promise<void>;
  fetchUnreadCount: (userId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  deleteAllNotifications: (userId: string) => Promise<void>;
  searchUsers: (query: string, userId: string) => Promise<void>;
  clearSearch: () => void;
  sendFriendRequest: (userId: string, friendId: string) => Promise<void>;
  acceptRequest: (friendshipId: string, userId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string, userId: string) => Promise<void>;
  sendNudge: (senderId: string, receiverId: string, message: string) => Promise<{ error: string | null }>;
  addReaction: (activityId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (activityId: string, userId: string, emoji: string) => Promise<void>;
  fetchBookmarks: (userId: string) => Promise<void>;
  toggleBookmark: (activityId: string, userId: string) => Promise<void>;
  fetchComments: (activityId: string) => Promise<void>;
  postComment: (activityId: string, userId: string, text: string, parentId?: string) => Promise<void>;
  removeComment: (commentId: string, activityId: string) => Promise<void>;
  fetchCommentCounts: (activityIds: string[]) => Promise<void>;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  friendsLoading: false,
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
  pendingFeedItems: [],

  addPendingFeedItem: (item) => {
    set((s) => {
      // Skip if already in feed or pending
      if (s.feed.some((f) => f.id === item.id)) return s;
      if (s.pendingFeedItems.some((f) => f.id === item.id)) return s;
      return { pendingFeedItems: [item, ...s.pendingFeedItems] };
    });
  },

  flushPendingFeed: () => {
    const { pendingFeedItems, feed } = get();
    if (pendingFeedItems.length === 0) return;
    const merged = [...pendingFeedItems, ...feed];
    const seen = new Set<string>();
    const deduped = merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    set({ feed: deduped.slice(0, MAX_FEED_ITEMS), pendingFeedItems: [] });
  },

  leaderboard: [],
  leaderboardLoading: false,
  leaderboardType: 'volume',
  leaderboardScope: 'friends',

  notifications: [],
  notificationsLoading: false,
  unreadCount: 0,
  notifPage: 0,
  notifHasMore: true,

  searchResults: [],
  searchLoading: false,

  bookmarks: [],
  bookmarksLoading: false,

  comments: {},
  commentsLoading: false,
  commentCounts: {},

  profileSheetFriend: null,
  profileSheetVisible: false,
  showProfileSheet: (friend) => set({ profileSheetFriend: friend, profileSheetVisible: true }),
  hideProfileSheet: () => {
    set({ profileSheetVisible: false });
    // Delay clearing friend data so the close animation can play before unmounting
    setTimeout(() => set({ profileSheetFriend: null }), 350);
  },

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

    set({ friendsLoading: true });
    try {
      const [friends, friendIds] = await Promise.all([
        getFriendsList(userId),
        getFriendIds(userId),
      ]);
      set({ friends, friendIds, friendsFetchedAt: Date.now() });
    } finally {
      set({ friendsLoading: false });
    }
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
      const items = feedMode === 'friends'
        ? await getFriendsFeed(friendIds, userId, FEED_PAGE_SIZE, reset ? 0 : cached.length)
        : await getGlobalFeed(userId, FEED_PAGE_SIZE, cursor);

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

  fetchLeaderboard: async (userId) => {
    const { leaderboardType, leaderboardScope, friendIds } = get();
    set({ leaderboardLoading: true });
    try {
      const entries = await dbGetLeaderboard(
        leaderboardType,
        leaderboardScope,
        friendIds,
        userId,
      );
      set({ leaderboard: entries });
    } finally {
      set({ leaderboardLoading: false });
    }
  },

  setLeaderboardType: (type) => set({ leaderboardType: type, leaderboard: [] }),
  setLeaderboardScope: (scope) => set({ leaderboardScope: scope, leaderboard: [] }),

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
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
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
    await dbSendRequest(userId, friendId);
    set((s) => ({
      searchResults: s.searchResults.map((r) =>
        r.id === friendId ? { ...r, friendshipStatus: 'pending' as const } : r,
      ),
    }));
  },

  acceptRequest: async (friendshipId, userId) => {
    await dbAcceptRequest(friendshipId, userId);
    await get().fetchFriends(userId, true);
  },

  declineRequest: async (friendshipId) => {
    await dbDeclineRequest(friendshipId);
  },

  removeFriend: async (friendshipId, userId) => {
    await dbRemoveFriend(friendshipId);
    await get().fetchFriends(userId, true);
  },

  sendNudge: async (senderId, receiverId, message) => {
    return dbSendNudge(senderId, receiverId, message);
  },

  addReaction: async (activityId, userId, emoji) => {
    await dbAddReaction(activityId, userId, emoji);
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
  },

  removeReaction: async (activityId, userId, emoji) => {
    await dbRemoveReaction(activityId, userId, emoji);
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
  },

  fetchBookmarks: async (userId) => {
    set({ bookmarksLoading: true });
    try {
      const ids = await dbGetBookmarks(userId);
      set({ bookmarks: ids });
    } finally {
      set({ bookmarksLoading: false });
    }
  },

  fetchComments: async (activityId) => {
    set({ commentsLoading: true });
    try {
      const items = await dbGetComments(activityId);
      set((s) => {
        const updated = { ...s.comments, [activityId]: items };
        // Evict oldest threads if over cap
        const keys = Object.keys(updated);
        if (keys.length > MAX_COMMENT_THREADS) {
          const toRemove = keys.slice(0, keys.length - MAX_COMMENT_THREADS);
          for (const k of toRemove) delete updated[k];
        }
        return { comments: updated };
      });
    } finally {
      set({ commentsLoading: false });
    }
  },

  postComment: async (activityId, userId, text, parentId) => {
    const comment = await dbAddComment(activityId, userId, text, parentId);
    if (comment) {
      set((s) => ({
        comments: {
          ...s.comments,
          [activityId]: [...(s.comments[activityId] || []), comment],
        },
        commentCounts: {
          ...s.commentCounts,
          [activityId]: (s.commentCounts[activityId] || 0) + 1,
        },
      }));
    }
  },

  removeComment: async (commentId, activityId) => {
    // Optimistic: remove from local
    const prev = get().comments[activityId] || [];
    set((s) => ({
      comments: {
        ...s.comments,
        [activityId]: prev.filter((c) => c.id !== commentId),
      },
      commentCounts: {
        ...s.commentCounts,
        [activityId]: Math.max(0, (s.commentCounts[activityId] || 0) - 1),
      },
    }));

    try {
      await dbDeleteComment(commentId);
    } catch {
      // Rollback
      set((s) => ({
        comments: { ...s.comments, [activityId]: prev },
        commentCounts: {
          ...s.commentCounts,
          [activityId]: (s.commentCounts[activityId] || 0) + 1,
        },
      }));
    }
  },

  fetchCommentCounts: async (activityIds) => {
    if (activityIds.length === 0) return;
    try {
      const counts = await dbGetCommentCounts(activityIds);
      set((s) => ({
        commentCounts: { ...s.commentCounts, ...counts },
      }));
    } catch {}
  },

  toggleBookmark: async (activityId, userId) => {
    const { bookmarks } = get();
    const isBookmarked = bookmarks.includes(activityId);

    // Optimistic update
    if (isBookmarked) {
      set({ bookmarks: bookmarks.filter((id) => id !== activityId) });
    } else {
      set({ bookmarks: [activityId, ...bookmarks] });
    }

    try {
      if (isBookmarked) {
        await dbRemoveBookmark(userId, activityId);
      } else {
        await dbAddBookmark(userId, activityId);
      }
    } catch {
      // Rollback
      set({ bookmarks });
    }
  },

}));
