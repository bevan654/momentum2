# Community Instagram-Style Feed — Implementation Plan

## Overview

Transform the Community tab into an Instagram-style feed experience. Enhance the existing
FeedCard components (not redesign from scratch), add comments, likes, bookmarks, and real-time
updates. No DMs.

---

## Feature Build Order

### Feature 1: Friend Profiles Bar (Horizontal Avatar ScrollView)
**Priority: First — sets visual foundation**

**What:**
Horizontal ScrollView at the top of the feed area showing friend avatars with usernames.
Tap navigates to that user's profile sheet (reuses existing FriendProfileModal).

**Files to create:**
- `src/components/friends/FriendAvatarBar.tsx` — Horizontal ScrollView, circular avatars
  with username below, "Add" button at the end if no friends

**Files to modify:**
- `src/components/friends/FriendsTab.tsx` — Replace collapsed sidebar rail with FriendAvatarBar
  above the feed. Remove sidebar rail, expand button, drawer, scrim entirely.
  Layout becomes: Header → FriendAvatarBar → ActivityFeed (full width).
  Keep search/notification overlay toggles in header.

**Data:** Uses existing `useFriendsStore.friends` — no new DB needed.

**Store changes:** None.

**DB changes:** None.

---

### Feature 2: Enhanced Feed Card — Action Row + Like System
**Priority: Second — core interaction**

**What:**
Add an Instagram-style action row below each feed card: heart (like), comment, share, bookmark.
Like = ❤️ reaction stored in existing `reactions` table. Double-tap card to like with heart
burst animation. Single tap heart button to toggle. Show like count below action row.

**Files to modify:**
- `src/components/friends/FeedCard.tsx` — Add action row below body map section (before
  current ReactionBar). Heart icon, comment icon (with count badge), share icon, bookmark icon.
  Wrap card content in TapGestureHandler for double-tap detection.
- `src/components/friends/ReactionBar.tsx` — Keep as-is but shift it below the new action row
  as a secondary reaction display.

**Files to create:**
- `src/components/friends/FeedActionRow.tsx` — Heart (filled/outline), comment (with count),
  share, bookmark buttons. All icons from Ionicons.
- `src/components/friends/HeartBurst.tsx` — Double-tap heart animation using Reanimated
  (scale up from 0 → 1.2 → 1 → fade out, opacity 1 → 0). Centered on card.

**Store changes (useFriendsStore):**
- Add `bookmarks: string[]` (activity IDs) and `bookmarksLoading: boolean`
- Add `toggleBookmark(activityId, userId)` — optimistic update
- Add `fetchBookmarks(userId)` — load on mount
- Add `isBookmarked(activityId)` helper selector

**DB changes:**
- **New table: `bookmarks`**
  ```sql
  CREATE TABLE public.bookmarks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id uuid NOT NULL REFERENCES public.activity_feed(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (user_id, activity_id)
  );
  -- RLS: users can only read/write their own bookmarks
  ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users manage own bookmarks" ON public.bookmarks
    FOR ALL USING (auth.uid() = user_id);
  ```

**Library changes (friendsDatabase.ts):**
- `addBookmark(userId, activityId)` / `removeBookmark(userId, activityId)`
- `getBookmarks(userId)` → string[] of activity IDs
- `getLikeCount(activityId)` — count ❤️ reactions (can derive from existing reaction data)

**Animation details (HeartBurst):**
- Reanimated shared values: scale (0 → 1.3 → 1), opacity (0 → 1 → 0)
- withSequence(withSpring(1.3, {damping: 6}), withTiming(0, {duration: 600}))
- Positioned absolutely centered on card
- Triggered by double-tap GestureHandler (minPointers: 1, numberOfTaps: 2)

---

### Feature 3: Comments System
**Priority: Third — key social interaction**

**What:**
Tap comment icon → bottom sheet with comment list (FlashList), text input at bottom,
keyboard-aware. Threaded replies (parent_id). Show top 2 comments preview on feed card
with "View all X comments" link.

**Files to create:**
- `src/components/friends/CommentsSheet.tsx` — BottomSheet wrapper, FlashList of comments,
  text input at bottom with send button, keyboard-aware using KeyboardAvoidingView
- `src/components/friends/CommentRow.tsx` — Avatar + username + text + time + reply button.
  Indented for replies (parent_id !== null).
- `src/components/friends/CommentPreview.tsx` — Shows top 2 comments inline on feed card,
  "View all X comments" text link

**Files to modify:**
- `src/components/friends/FeedCard.tsx` — Add CommentPreview between action row and ReactionBar
- `src/components/friends/ActivityFeed.tsx` — Manage CommentsSheet visibility state
  (selectedActivityForComments)

**Store changes (useFriendsStore):**
- Add `comments: Record<string, CommentItem[]>` — keyed by activity_id
- Add `commentsLoading: boolean`
- Add `commentCounts: Record<string, number>` — for badge display
- Add `fetchComments(activityId)` → loads into comments[activityId]
- Add `addComment(activityId, userId, text, parentId?)` — optimistic update
- Add `deleteComment(commentId, activityId)` — optimistic update
- Add `fetchCommentCounts(activityIds: string[])` — batch count fetch for feed items

**DB changes:**
- **New table: `comments`**
  ```sql
  CREATE TABLE public.comments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES public.activity_feed(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
    text text NOT NULL CHECK (char_length(text) <= 500),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
  );
  ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
  -- Read: anyone can read comments on feed items they can see
  CREATE POLICY "Anyone can read comments" ON public.comments FOR SELECT USING (true);
  -- Write: authenticated users can insert their own
  CREATE POLICY "Users create own comments" ON public.comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  -- Delete: users can delete their own comments
  CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE
    USING (auth.uid() = user_id);
  ```
- **Add `comment_count` to activity_feed** (denormalized for feed performance):
  ```sql
  ALTER TABLE public.activity_feed ADD COLUMN comment_count integer NOT NULL DEFAULT 0;
  ```
  Updated via trigger or app-side increment on comment insert.

**Library changes (friendsDatabase.ts):**
- `CommentItem` type: `{ id, activity_id, user_id, parent_id, text, created_at, profile: {username, email} }`
- `getComments(activityId, limit, offset)` → CommentItem[] with profiles
- `addComment(activityId, userId, text, parentId?)` → CommentItem
- `deleteComment(commentId)`
- `getCommentCounts(activityIds: string[])` → Record<string, number>

---

### Feature 4: Infinite Scroll + Skeleton Loaders
**Priority: Fourth — polish the scroll experience**

**What:**
Cursor-based pagination (replace offset-based), skeleton placeholders while loading,
smoother end-of-list behavior.

**Files to create:**
- `src/components/friends/FeedCardSkeleton.tsx` — Placeholder card matching FeedCard dimensions.
  Animated shimmer using Reanimated (translateX loop on a gradient overlay).

**Files to modify:**
- `src/components/friends/ActivityFeed.tsx` — Add ListFooterComponent with skeleton loaders
  when loading more. Switch from offset pagination to cursor (created_at < last item's created_at).
- `src/stores/useFriendsStore.ts` — Change feedPage/offset to cursor-based: store `feedCursor: string | null`
  (ISO date of last item). `fetchFeed(userId, reset, force)` passes cursor instead of offset.
- `src/lib/friendsDatabase.ts` — `getGlobalFeed` accepts cursor (`.lt('created_at', cursor)`)
  instead of `.range()`.

**Store changes:**
- Replace `feedPage: number` with `feedCursor: string | null`
- Pagination logic: `reset` → cursor = null; append → cursor = last item's created_at

**DB changes:** None.

---

### Feature 5: Real-Time Feed Updates
**Priority: Fifth — live experience**

**What:**
New posts from friends appear at top via Supabase Realtime postgres_changes subscription.
"X new posts" pill at top of feed — tap to scroll to top and show new items.

**Files to create:**
- `src/components/friends/NewPostsPill.tsx` — Floating pill above feed: "3 new posts" with
  Reanimated slide-down animation. Tap → scroll FlashList to top, merge pending items into feed.

**Files to modify:**
- `src/components/friends/ActivityFeed.tsx` — Subscribe to `postgres_changes` on `activity_feed`
  table (INSERT events). Store pending new items in local state. Show NewPostsPill when
  pendingCount > 0. On pill tap: prepend pending to feed, scroll to 0.
- `src/stores/useFriendsStore.ts` — Add `pendingFeedItems: ActivityFeedItem[]` and
  `addPendingFeedItem(item)` / `flushPendingFeed()` actions.

**Store changes:**
- `pendingFeedItems: ActivityFeedItem[]`
- `addPendingFeedItem(item: ActivityFeedItem)`
- `flushPendingFeed()` — prepends pending to feed, clears pending

**DB changes:** None (Supabase Realtime already supports postgres_changes).

**Realtime subscription pattern:**
```typescript
supabase.channel('feed-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'activity_feed',
  }, (payload) => {
    // Enrich with profile data, add to pending
  })
  .subscribe();
```

---

### Feature 6: Long-Press Emoji Reactions
**Priority: Sixth — enhanced reactions**

**What:**
Long-press the heart/like button → floating emoji picker (❤️🔥💪👏🤯).
Selecting one stores it in the existing `reactions` table.
Reuses and extends the existing EmojiPicker.tsx component.

**Files to modify:**
- `src/components/friends/FeedActionRow.tsx` — Add long-press handler on heart button.
  Show EmojiPicker positioned above the button. On select → call onToggleReaction.
- `src/components/friends/EmojiPicker.tsx` — Add 🤯 to the list. Adjust positioning
  to work when anchored to the action row heart button.

**Store changes:** None (uses existing addReaction/removeReaction).

**DB changes:** None.

---

### Feature 7: Real-Time Comments via Supabase
**Priority: Seventh — polish**

**What:**
When CommentsSheet is open, subscribe to new comments on that activity via
`postgres_changes` INSERT on `comments` table filtered by `activity_id`.

**Files to modify:**
- `src/components/friends/CommentsSheet.tsx` — Subscribe on mount, unsubscribe on unmount.
  New comments from other users appear at the bottom in real-time.

**Store changes:** None (direct local state in CommentsSheet).

**DB changes:** None.

---

## New Files Summary

| File | Type | Description |
|---|---|---|
| `src/components/friends/FriendAvatarBar.tsx` | Component | Horizontal friend avatar strip |
| `src/components/friends/FeedActionRow.tsx` | Component | Heart/comment/share/bookmark row |
| `src/components/friends/HeartBurst.tsx` | Component | Double-tap heart animation |
| `src/components/friends/CommentsSheet.tsx` | Component | Bottom sheet comments list |
| `src/components/friends/CommentRow.tsx` | Component | Single comment display |
| `src/components/friends/CommentPreview.tsx` | Component | Inline 2-comment preview on card |
| `src/components/friends/FeedCardSkeleton.tsx` | Component | Shimmer loading placeholder |
| `src/components/friends/NewPostsPill.tsx` | Component | "X new posts" floating pill |

## Modified Files Summary

| File | Changes |
|---|---|
| `FriendsTab.tsx` | Remove sidebar/drawer, add FriendAvatarBar above feed |
| `FeedCard.tsx` | Add FeedActionRow, CommentPreview, double-tap gesture |
| `ReactionBar.tsx` | Repositioned below action row (minor) |
| `ActivityFeed.tsx` | CommentsSheet state, Realtime subscription, skeleton footer, cursor pagination |
| `EmojiPicker.tsx` | Add 🤯, adjust positioning |
| `useFriendsStore.ts` | bookmarks, comments, comment counts, cursor pagination, pending feed items |
| `friendsDatabase.ts` | bookmark CRUD, comment CRUD, cursor-based feed query, comment count |

## New DB Tables

1. **`bookmarks`** — user_id + activity_id, unique constraint, RLS
2. **`comments`** — activity_id, user_id, parent_id (threaded), text (max 500), RLS

## New DB Columns

1. **`activity_feed.comment_count`** — integer, default 0 (denormalized)

## Constraints Checklist

- [x] FlashList for feed + comments (never FlatList/ScrollView for lists)
- [x] Reanimated only for all animations (heart burst, skeleton shimmer, pill slide, sheet)
- [x] useColors() for every color — no hardcoded hex
- [x] fontFamily with Inter variants — never fontWeight
- [x] sw(), ms() for all sizing
- [x] Optimistic updates with rollback (likes, bookmarks, comments)
- [x] Supabase client from src/lib/supabase.ts only
- [x] No new screens needed (all within existing Community tab)
- [x] DO NOT touch: NutritionHero, HomeScreen, Header.tsx, NutritionCard, DateNavigator
