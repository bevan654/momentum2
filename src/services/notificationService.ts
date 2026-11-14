/**
 * Notification Service — Singleton for real-time & push notifications.
 *
 * Architecture:
 * - Supabase Realtime postgres_changes on `notifications` table
 * - Debounced unread badge updates (2s)
 * - Deduplicated notification handling (Set<id>, capped at 200)
 * - Local banner via expo-notifications (foreground only)
 * - Fallback low-frequency poller on realtime disconnect (5 min)
 * - Push token registration (profiles.push_token)
 * - AppState-aware: pauses banners in background, syncs on foreground
 *
 * Battery rules:
 * - No high-frequency polling
 * - Debounced badge queries (1 query per 2s window, not per notification)
 * - Fallback poller ONLY runs when realtime is disconnected
 * - Push token written once per session (diff check)
 * - No timers in background
 */

import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase, onClientSwap } from '../lib/supabase';
import { useFriendsStore } from '../stores/useFriendsStore';
import type { NotificationItem } from '../lib/friendsDatabase';

// ── Module state (singleton, no React) ────────────────

let channel: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;
let appState: AppStateStatus = AppState.currentState;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let badgeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let unsubscribeClientSwap: (() => void) | null = null;

/** Dedupe guard — prevents processing the same notification twice */
const seenIds = new Set<string>();
const SEEN_IDS_MAX = 200;

/** When true, local banners are suppressed (user is viewing notifications) */
let viewingNotifications = false;

const FALLBACK_POLL_MS = 5 * 60 * 1000; // 5 minutes
const BADGE_DEBOUNCE_MS = 2000;

// ── Internal helpers ──────────────────────────────────

function debouncedBadgeUpdate() {
  if (badgeDebounceTimer) clearTimeout(badgeDebounceTimer);
  badgeDebounceTimer = setTimeout(() => {
    badgeDebounceTimer = null;
    if (currentUserId) {
      useFriendsStore.getState().fetchUnreadCount(currentUserId);
    }
  }, BADGE_DEBOUNCE_MS);
}

function handleNewNotification(payload: { new: Record<string, any> }) {
  const row = payload.new as NotificationItem;
  if (!row?.id) return;

  // Dedupe
  if (seenIds.has(row.id)) return;
  seenIds.add(row.id);

  // Evict oldest when cap reached
  if (seenIds.size > SEEN_IDS_MAX) {
    const first = seenIds.values().next().value;
    if (first) seenIds.delete(first);
  }

  // Prepend to store notifications list (optimistic)
  const store = useFriendsStore.getState();
  const alreadyInList = store.notifications.some((n) => n.id === row.id);
  if (!alreadyInList) {
    useFriendsStore.setState({
      notifications: [row, ...store.notifications],
    });
  }

  // Debounced badge update
  debouncedBadgeUpdate();

  // Local banner
  if (shouldShowBanner()) {
    showLocalBanner(row);
  }
}

function shouldShowBanner(): boolean {
  return appState === 'active' && !viewingNotifications;
}

async function showLocalBanner(notification: NotificationItem) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body || undefined,
        data: { type: notification.type, ...(notification.data || {}) },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'social' } : {}),
      },
      trigger: null, // immediate
    });
  } catch {
    // Swallow — banner display is best-effort
  }
}

function handleAppStateChange(nextState: AppStateStatus) {
  const prev = appState;
  appState = nextState;

  if (nextState === 'active' && prev !== 'active' && currentUserId) {
    // Returning to foreground — sync unread count (one query)
    useFriendsStore.getState().fetchUnreadCount(currentUserId);
  }
}

// ── Fallback poller (only on realtime disconnect) ─────

function startFallbackPoller() {
  if (fallbackTimer) return;
  fallbackTimer = setInterval(() => {
    if (currentUserId && appState === 'active') {
      useFriendsStore.getState().fetchUnreadCount(currentUserId);
    }
  }, FALLBACK_POLL_MS);
}

function stopFallbackPoller() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
}

// ── Push token registration ───────────────────────────
// Runs for the whole signed-in session (initPushToken / stopPushToken), separate
// from the Realtime channel above, which only lives while Community is focused.

const TOKEN_DEBOUNCE_MS = 30_000; // 30s debounce for token re-registration

let pushUserId: string | null = null;
let pushAppState: AppStateStatus = AppState.currentState;
let pushAppStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let tokenDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handlePushAppStateChange(nextState: AppStateStatus) {
  const prev = pushAppState;
  pushAppState = nextState;
  if (nextState !== 'active' || prev === 'active' || !pushUserId) return;

  // Re-register push token (FCM tokens can rotate, especially on Android)
  // Debounced to avoid redundant writes on rapid foreground/background switches
  if (tokenDebounceTimer) clearTimeout(tokenDebounceTimer);
  tokenDebounceTimer = setTimeout(() => {
    tokenDebounceTimer = null;
    registerPushToken();
  }, TOKEN_DEBOUNCE_MS);
}

async function registerPushToken(): Promise<void> {
  const userId = pushUserId;
  if (!Device.isDevice || !userId) return;

  try {
    // Request permissions first (required on iOS + Android 13+)
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    // Get push token — projectId required for EAS builds
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '157d9970-0ab2-46aa-8b0a-e12bc42c009d',
    });
    const token = tokenData.data;

    // Only write if token changed
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single();

    // Signed out (or switched account) while waiting on the permission prompt
    if (fetchError || pushUserId !== userId) return;

    if (profile?.push_token !== token) {
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);
    }
  } catch {
    // Expected in Expo Go — push tokens require a development build.
  }
}

/**
 * Register this device's push token for the signed-in user and keep it fresh
 * on foreground. Call once after authentication (in TabNavigator).
 */
export function initPushToken(userId: string): void {
  if (pushUserId === userId) return;
  stopPushToken();
  pushUserId = userId;
  pushAppState = AppState.currentState;
  pushAppStateSubscription = AppState.addEventListener('change', handlePushAppStateChange);
  registerPushToken();
}

/** Stop push-token refreshes. Call on sign-out. */
export function stopPushToken(): void {
  pushAppStateSubscription?.remove();
  pushAppStateSubscription = null;
  if (tokenDebounceTimer) {
    clearTimeout(tokenDebounceTimer);
    tokenDebounceTimer = null;
  }
  pushUserId = null;
}

// ── Public API ────────────────────────────────────────

/**
 * Initialize the notification system.
 * Call once after authentication (in TabNavigator).
 * Safe to call multiple times — cleans up previous channel.
 */
export function initNotifications(userId: string): void {
  if (currentUserId === userId && channel) return;

  cleanupNotifications();
  currentUserId = userId;

  // Subscribe to postgres_changes for this user's notifications
  channel = supabase.channel(`notif:${userId}`);
  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      handleNewNotification,
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        stopFallbackPoller();
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        startFallbackPoller();
      }
    });

  // AppState listener
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Re-subscribe channel after supabase client swap (post-30min background).
  // The old `channel` ref is attached to the discarded client; we drop it and
  // re-init from scratch on the fresh client.
  unsubscribeClientSwap = onClientSwap(() => {
    const uid = currentUserId;
    if (uid) {
      cleanupNotifications();
      initNotifications(uid);
    }
  });

  // Initial unread count sync
  useFriendsStore.getState().fetchUnreadCount(userId);
}

/**
 * Tear down the notification system.
 * Call on sign-out.
 */
export function cleanupNotifications(): void {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (unsubscribeClientSwap) {
    unsubscribeClientSwap();
    unsubscribeClientSwap = null;
  }

  stopFallbackPoller();

  if (badgeDebounceTimer) {
    clearTimeout(badgeDebounceTimer);
    badgeDebounceTimer = null;
  }

  currentUserId = null;
  seenIds.clear();
  viewingNotifications = false;
}

/**
 * Set whether the user is currently viewing the notifications screen.
 * When true, local banners are suppressed to avoid double-showing.
 */
export function setViewingNotifications(viewing: boolean): void {
  viewingNotifications = viewing;
}
