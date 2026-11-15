// Types shared by the friends / feed / notifications data layer.

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'reaction'
  | 'nudge'
  | 'leaderboard_weekly'
  | 'leaderboard_overtake'
  | 'ai_nudge';

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

interface FeedSetDetail {
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
  /** Reps over all sets. Missing on posts from builds before it was added. */
  total_reps?: number | null;
  exercise_type?: string | null;
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
  ghost_username: string | null;
  ghost_result: 'victory' | 'defeated' | 'draw' | null;
  ghost_exercises: { name: string; sets: { kg: number; reps: number }[] }[] | null;
  routine_name: string | null;
  program_name: string | null;
  program_week: number | null;
  program_total_weeks: number | null;
  program_day_label: string | null;
  photo_url: string | null;
  title: string | null;
  caption: string | null;
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
  user_id: string;
  type: LeaderboardType;
  value: number;
  profile: { username: string | null; email: string };
  rank: number;
  rankChange?: number;
}

export type LeaderboardType =
  | 'strength'
  | 'bench'
  | 'squat'
  | 'deadlift'
  | 'streak'
  | 'streak_best';

export interface SearchResult {
  id: string;
  username: string | null;
  email: string;
  friendshipStatus: FriendshipStatus | null;
}

export type ReportTargetType = 'user' | 'activity' | 'comment' | 'message' | 'nudge' | 'ai_message';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'violence'
  | 'self_harm'
  | 'impersonation'
  | 'other';
