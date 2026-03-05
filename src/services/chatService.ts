/**
 * Chat Service — Singleton for real-time message delivery.
 *
 * Architecture:
 * - Supabase Realtime postgres_changes on `messages` table
 * - Client-side filter by known conversation IDs
 * - Debounced unread badge updates (1s)
 * - Deduplicated message handling (Set<id>, capped at 200)
 * - Local banner via expo-notifications (foreground only)
 * - AppState-aware: syncs on foreground return
 *
 * Follows the exact singleton pattern from notificationService.ts.
 */

import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useChatStore } from '../stores/useChatStore';
import type { ChatMessage } from '../lib/chatDatabase';

// ── Module state (singleton, no React) ────────────────

let channel: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;
let appState: AppStateStatus = AppState.currentState;
let badgeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

/** Currently open chat — suppresses banners for messages in this conversation */
let viewingConversationId: string | null = null;

/** Dedupe guard */
const seenIds = new Set<string>();
const SEEN_IDS_MAX = 200;

const BADGE_DEBOUNCE_MS = 1000;

// ── Internal helpers ──────────────────────────────────

function debouncedBadgeUpdate() {
  if (badgeDebounceTimer) clearTimeout(badgeDebounceTimer);
  badgeDebounceTimer = setTimeout(() => {
    badgeDebounceTimer = null;
    if (currentUserId) {
      useChatStore.getState().fetchTotalUnreadCount(currentUserId);
    }
  }, BADGE_DEBOUNCE_MS);
}

function handleNewMessage(payload: { new: Record<string, any> }) {
  const row = payload.new as ChatMessage;
  if (!row?.id) return;

  // Ignore own messages (already handled optimistically)
  if (row.sender_id === currentUserId) return;

  // Dedupe
  if (seenIds.has(row.id)) return;
  seenIds.add(row.id);
  if (seenIds.size > SEEN_IDS_MAX) {
    const first = seenIds.values().next().value;
    if (first) seenIds.delete(first);
  }

  // Push to store
  useChatStore.getState().handleNewMessage(row);

  // Debounced badge update
  debouncedBadgeUpdate();

  // Local banner (only if not viewing this conversation)
  if (
    appState === 'active' &&
    row.conversation_id !== viewingConversationId
  ) {
    showLocalBanner(row);
  }
}

function handleMessageUpdate(payload: { new: Record<string, any>; old: Record<string, any> }) {
  const row = payload.new as ChatMessage;
  if (!row?.id || !row.read) return;

  // Only care about read receipts for our own messages
  if (row.sender_id !== currentUserId) return;

  useChatStore.getState().handleMessageRead(row.conversation_id, [row.id]);
}

async function showLocalBanner(message: ChatMessage) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Message',
        body: message.text.slice(0, 100),
        data: { type: 'chat_message', conversation_id: message.conversation_id },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'social' } : {}),
      },
      trigger: null,
    });
  } catch {
    // Swallow — banner display is best-effort
  }
}

function handleAppStateChange(nextState: AppStateStatus) {
  const prev = appState;
  appState = nextState;

  if (nextState === 'active' && prev !== 'active' && currentUserId) {
    // Returning to foreground — sync unread count
    useChatStore.getState().fetchTotalUnreadCount(currentUserId);
  }
}

// ── Public API ────────────────────────────────────────

/**
 * Initialize the chat realtime system.
 * Call once after authentication (in TabNavigator).
 */
export function initChatService(userId: string): void {
  if (currentUserId === userId && channel) return;

  cleanupChatService();
  currentUserId = userId;

  // Subscribe to all message inserts + updates
  // Client-side filtering handles conversation membership
  channel = supabase.channel(`chat:${userId}`);
  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      handleNewMessage,
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      },
      handleMessageUpdate,
    )
    .subscribe();

  // AppState listener
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Initial unread count
  useChatStore.getState().fetchTotalUnreadCount(userId);
}

/**
 * Tear down the chat realtime system.
 * Call on sign-out.
 */
export function cleanupChatService(): void {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  if (badgeDebounceTimer) {
    clearTimeout(badgeDebounceTimer);
    badgeDebounceTimer = null;
  }

  currentUserId = null;
  viewingConversationId = null;
  seenIds.clear();
}

/**
 * Set which conversation the user is currently viewing.
 * Pass `null` when leaving a chat screen.
 * Suppresses local banners for that conversation.
 */
export function setViewingChat(conversationId: string | null): void {
  viewingConversationId = conversationId;
}
