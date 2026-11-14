import { sw, SCREEN_WIDTH } from '../../../theme/responsive';
import type { ActivityFeedItem } from '../../../lib/friendsDatabase';

export const PHOTO_WIDTH = SCREEN_WIDTH - sw(16); // small gutter (sw(8) on each side)
export const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 0.5625); // 16:9 landscape — denser feed

/* ─── Helpers ────────────────────────────────────────── */

const AVATAR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA',
  '#60A5FA', '#F59E0B', '#EC4899', '#10B981',
  '#8B5CF6', '#06B6D4',
];

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function displayNameFor(username: string | null, email: string): string {
  return username || (email ? email.split('@')[0] : 'friend');
}

export function initialFor(username: string | null, email: string): string {
  return (username || email || '?').charAt(0).toUpperCase();
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${Math.round(kg)} kg`;
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function workoutTitleFor(item: ActivityFeedItem): string {
  if (item.routine_name) return item.routine_name;
  if (item.program_name) {
    return item.program_day_label || item.program_name;
  }
  return 'Workout';
}

export function captionFor(item: ActivityFeedItem): string {
  if (item.caption && item.caption.trim().length > 0) return item.caption.trim();
  const names = item.exercise_names || [];
  if (names.length === 0) return '';
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2} more` : shown;
}

export const LIKE_EMOJI = '❤️';

export function reactionTotals(reactions: ActivityFeedItem['reactions']): { likes: number; liked: boolean } {
  const heart = (reactions || []).find((r) => r.emoji === LIKE_EMOJI);
  return { likes: heart?.count ?? 0, liked: heart?.reacted ?? false };
}
