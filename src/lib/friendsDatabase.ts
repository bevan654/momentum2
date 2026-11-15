/**
 * Friends, feed, reactions, reports, leaderboards, notifications and streaks.
 * The code lives in ./friends/ by topic; this file re-exports the public API so imports stay
 * `from '../lib/friendsDatabase'`.
 */
export type {
  NotificationType,
  FriendProfile,
  FeedExerciseDetail,
  ActivityFeedItem,
  NotificationItem,
  LeaderboardEntry,
  LeaderboardType,
  SearchResult,
  ReportTargetType,
  ReportReason,
} from './friends/types';
export {
  searchProfiles,
  getFriendsList,
  getFriendIds,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  getBlockedUserIds,
  getFriendshipBetween,
} from './friends/friendships';
export {
  reportContent,
  addReaction,
  removeReaction,
} from './friends/social';
export {
  getFriendsFeed,
  getGlobalFeed,
} from './friends/feed';
export {
  getLeaderboard,
} from './friends/leaderboard';
export {
  getUserStreak,
  fetchWorkoutDates,
  upsertUserStreak,
  getFriendStats,
} from './friends/streaks';
export {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteAllNotifications,
  setNotificationResponded,
} from './friends/notifications';
