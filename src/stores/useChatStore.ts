import { create } from 'zustand';
import type { ConversationSummary, ChatMessage } from '../lib/chatDatabase';
import * as chatDb from '../lib/chatDatabase';

const MESSAGES_PAGE_SIZE = 30;
const CONVERSATIONS_CACHE_TTL = 2 * 60 * 1000; // 2 min

interface ChatState {
  // Conversation list
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  conversationsFetchedAt: number | null;

  // Active chat messages (keyed by conversationId)
  messages: Record<string, ChatMessage[]>;
  messagesLoading: boolean;
  messagesHasMore: Record<string, boolean>;

  // Unread count (total across all conversations)
  totalUnreadCount: number;

  // Actions
  fetchConversations: (userId: string, force?: boolean) => Promise<void>;
  fetchMessages: (conversationId: string, reset?: boolean) => Promise<void>;
  sendMessage: (
    conversationId: string,
    senderId: string,
    text: string,
    recipientId: string,
  ) => Promise<void>;
  markConversationRead: (conversationId: string, userId: string) => Promise<void>;
  fetchTotalUnreadCount: (userId: string) => Promise<void>;
  getOrCreateConversation: (userId: string, friendId: string) => Promise<string>;

  // Realtime handlers (called by chatService)
  handleNewMessage: (message: ChatMessage) => void;
  handleMessageRead: (conversationId: string, messageIds: string[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationsLoading: false,
  conversationsFetchedAt: null,

  messages: {},
  messagesLoading: false,
  messagesHasMore: {},

  totalUnreadCount: 0,

  fetchConversations: async (userId, force = false) => {
    const { conversationsFetchedAt, conversations: cached } = get();
    if (
      !force &&
      cached.length > 0 &&
      conversationsFetchedAt &&
      Date.now() - conversationsFetchedAt < CONVERSATIONS_CACHE_TTL
    ) {
      return;
    }

    set({ conversationsLoading: true });
    try {
      const conversations = await chatDb.getConversations(userId);
      set({
        conversations,
        conversationsLoading: false,
        conversationsFetchedAt: Date.now(),
      });
    } catch {
      set({ conversationsLoading: false });
    }
  },

  fetchMessages: async (conversationId, reset = false) => {
    const { messages: allMessages, messagesHasMore } = get();
    const existing = allMessages[conversationId] || [];

    if (!reset && existing.length > 0 && messagesHasMore[conversationId] === false) {
      return; // No more pages
    }

    set({ messagesLoading: true });
    try {
      const cursor = reset
        ? null
        : existing.length > 0
          ? existing[0].created_at
          : null;

      const fetched = await chatDb.getMessages(
        conversationId,
        MESSAGES_PAGE_SIZE,
        cursor,
      );

      const merged = reset ? fetched : [...fetched, ...existing];

      set({
        messages: { ...get().messages, [conversationId]: merged },
        messagesHasMore: {
          ...get().messagesHasMore,
          [conversationId]: fetched.length >= MESSAGES_PAGE_SIZE,
        },
        messagesLoading: false,
      });
    } catch {
      set({ messagesLoading: false });
    }
  },

  sendMessage: async (conversationId, senderId, text, recipientId) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: senderId,
      text,
      read: false,
      created_at: new Date().toISOString(),
      pending: true,
      tempId,
    };

    // Optimistic insert at end (ascending order — oldest first)
    const current = get().messages[conversationId] || [];
    set({
      messages: {
        ...get().messages,
        [conversationId]: [...current, optimistic],
      },
    });

    // Update conversation list optimistically
    const convs = get().conversations.map((c) =>
      c.id === conversationId
        ? {
            ...c,
            lastMessageText: text,
            lastMessageAt: optimistic.created_at,
            lastMessageSender: senderId,
          }
        : c,
    );
    // Move to top
    const idx = convs.findIndex((c) => c.id === conversationId);
    if (idx > 0) {
      const [conv] = convs.splice(idx, 1);
      convs.unshift(conv);
    }
    set({ conversations: convs });

    try {
      const real = await chatDb.sendMessage(conversationId, senderId, text, recipientId);
      if (real) {
        // Replace optimistic with real message
        const msgs = get().messages[conversationId] || [];
        set({
          messages: {
            ...get().messages,
            [conversationId]: msgs.map((m) =>
              m.tempId === tempId ? { ...real, pending: false } : m,
            ),
          },
        });
      }
    } catch {
      // Rollback on failure
      const msgs = get().messages[conversationId] || [];
      set({
        messages: {
          ...get().messages,
          [conversationId]: msgs.filter((m) => m.tempId !== tempId),
        },
      });
    }
  },

  markConversationRead: async (conversationId, userId) => {
    // Optimistic: mark all as read locally
    const msgs = get().messages[conversationId] || [];
    set({
      messages: {
        ...get().messages,
        [conversationId]: msgs.map((m) =>
          m.sender_id !== userId && !m.read ? { ...m, read: true } : m,
        ),
      },
    });

    // Update conversation unread count
    const convs = get().conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c,
    );
    set({ conversations: convs });

    // Recalculate total
    const newTotal = convs.reduce((sum, c) => sum + c.unreadCount, 0);
    set({ totalUnreadCount: newTotal });

    try {
      await chatDb.markMessagesRead(conversationId, userId);
    } catch {
      // Swallow — read receipts are best-effort
    }
  },

  fetchTotalUnreadCount: async (userId) => {
    try {
      const count = await chatDb.getTotalUnreadCount(userId);
      set({ totalUnreadCount: count });
    } catch {
      // Swallow
    }
  },

  getOrCreateConversation: async (userId, friendId) => {
    return chatDb.getOrCreateConversation(userId, friendId);
  },

  handleNewMessage: (message) => {
    const convId = message.conversation_id;
    const existing = get().messages[convId] || [];

    // Dedupe
    if (existing.some((m) => m.id === message.id)) return;

    set({
      messages: {
        ...get().messages,
        [convId]: [...existing, message],
      },
    });

    // Update conversation list
    const convs = get().conversations.map((c) =>
      c.id === convId
        ? {
            ...c,
            lastMessageText: message.text,
            lastMessageAt: message.created_at,
            lastMessageSender: message.sender_id,
            unreadCount: c.unreadCount + 1,
          }
        : c,
    );

    // Move to top
    const idx = convs.findIndex((c) => c.id === convId);
    if (idx > 0) {
      const [conv] = convs.splice(idx, 1);
      convs.unshift(conv);
    }

    const newTotal = convs.reduce((sum, c) => sum + c.unreadCount, 0);
    set({ conversations: convs, totalUnreadCount: newTotal });
  },

  handleMessageRead: (conversationId, messageIds) => {
    const msgs = get().messages[conversationId] || [];
    const idSet = new Set(messageIds);
    set({
      messages: {
        ...get().messages,
        [conversationId]: msgs.map((m) =>
          idSet.has(m.id) ? { ...m, read: true } : m,
        ),
      },
    });
  },
}));
