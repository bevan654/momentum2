# Community Module Audit

## Current Component Tree

```
TabNavigator.tsx
  └─ FriendsScreen.tsx (thin wrapper)
       └─ FriendsTab.tsx (root layout)
            ├─ Header: "Community" title + search/notification buttons
            ├─ Body (baseRow):
            │   ├─ Sidebar Rail (collapsed): expand btn + avatar circles (ScrollView)
            │   └─ Feed Area:
            │        └─ ActivityFeed.tsx
            │             └─ FlashList<ActivityFeedItem>
            │                  └─ FeedCard.tsx (per item)
            │                       ├─ AvatarCircle + name + streak badge + chevron
            │                       ├─ Stats strip (duration, volume, exercises)
            │                       ├─ MiniBodyMap (front + back)
            │                       └─ ReactionBar.tsx (💪🔥👏 pills)
            ├─ Scrim + Expanded Drawer:
            │   └─ FriendList.tsx
            │        └─ FlashList<FriendProfile>
            │             └─ FriendRow.tsx (avatar + name + nudge btn)
            ├─ Search Overlay:
            │   └─ FriendSearch.tsx
            │        └─ FlashList<SearchResult>
            │             └─ SearchResultRow.tsx
            ├─ Notification Overlay:
            │   └─ NotificationList.tsx
            │        └─ FlashList<NotificationItem>
            │             └─ NotificationRow.tsx
            └─ NudgeModal.tsx (modal)

FeedCard onPress → FeedWorkoutModal.tsx (RN Modal, detailed exercise view)
FriendRow onPress → FriendProfileModal.tsx (BottomSheet, stats + remove friend)
Leaderboard.tsx + LeaderboardRow.tsx (exist but NOT mounted anywhere currently)
EmojiPicker.tsx (exists but NOT used — standalone emoji selection component)
```

## Existing Data (What Already Exists)

### Database Tables (from database-schema.md)
| Table | Key Columns | Notes |
|---|---|---|
| `activity_feed` | id, user_id, workout_id, duration, total_volume, exercise_names[], total_exercises, total_sets, created_at | Feed items — already used |
| `reactions` | id, activity_id, user_id, type (emoji), created_at | Already used for 💪🔥👏 |
| `friendships` | id, user_id, friend_id, status (pending/accepted/blocked), created_at | Already used |
| `notifications` | id, user_id, type, title, body, data (jsonb), read, created_at | Already used |
| `nudges` | id, sender_id, receiver_id, message, read, created_at | Already used |
| `profiles` | id, email, username, push_token, privacy flags... | Already used |
| `user_streaks` | user_id, current_streak, longest_streak, last_workout_date | Already used in feed |
| `leaderboard_entries` | id, user_id, type, value, week_start | Used by Leaderboard (unmounted) |

### Store: useFriendsStore.ts
- **friends** / friendIds — cached (4h TTL)
- **feed** — paginated (15 per page), offset-based, deduplicated
- **leaderboard** — volume/streak, friends/global scope
- **notifications** — paginated, mark read/all read/delete all
- **search** — debounced profile search
- **reactions** — addReaction / removeReaction with optimistic updates
- **profileSheet** — friend profile bottom sheet state

### Library: friendsDatabase.ts
- `getFriendsList(userId)` → FriendProfile[]
- `getGlobalFeed(userId, limit, offset)` → ActivityFeedItem[] (with profiles, reactions, exercise details, streaks)
- `addReaction(activityId, userId, emoji)` / `removeReaction(...)`
- `sendNudge(senderId, receiverId, message)` — 24h cooldown
- `getLeaderboard(type, scope, friendIds, userId)`
- `getNotifications(userId, limit, offset)`
- `searchProfiles(query, currentUserId)`
- `getFriendStats(userId)` — workout count, total volume, streak

## What Does NOT Exist Yet (Needs New DB + Code)

| Feature | Missing | Required |
|---|---|---|
| Comments | No `comments` table | New table: `comments(id, activity_id, user_id, parent_id, text, created_at)` |
| Bookmarks/Saves | No `bookmarks` table | New table: `bookmarks(id, user_id, activity_id, created_at)` |
| Like count display | Reactions exist but no dedicated "like" semantic | Can use existing `reactions` with ❤️ as the "like" emoji |
| Comment count on feed | No count available | Need query or denormalized `comment_count` on activity_feed |
| Caption/description | `activity_feed` has no `caption` column | Optional: add `caption text` column to activity_feed |
| Share | No share mechanism | Deep link or in-app share (no DB needed) |

## FlashList Usage Patterns Already in Codebase

1. **ActivityFeed.tsx** — `FlashList<ActivityFeedItem>`, estimatedItemSize sw(280), pull-to-refresh, onEndReached pagination
2. **FriendList.tsx** — `FlashList<FriendProfile>`, estimatedItemSize sw(72), pull-to-refresh
3. **NotificationList.tsx** — `FlashList<NotificationItem>`, estimatedItemSize sw(80), pull-to-refresh, pagination
4. **Leaderboard.tsx** — `FlashList<LeaderboardEntry>`, estimatedItemSize sw(56)
5. **FriendSearch.tsx** — `FlashList<SearchResult>`, estimatedItemSize sw(60)

Pattern: all use `keyExtractor`, `showsVerticalScrollIndicator={false}`, `contentContainerStyle`, RefreshControl where applicable.

## Optimistic Update Pattern (from useSupplementStore)

```typescript
// 1. Optimistic update
set((s) => ({ water: s.water + ml }));
// 2. DB write
const { error } = await supabase.from('...').insert({...});
// 3. Rollback on error
if (error) set((s) => ({ water: s.water - ml }));
```

Same pattern used in useFriendsStore for reactions already.

## Reusable Components

- **AvatarCircle** — takes username, email, size, bgColor
- **EmojiPicker** — 6 emojis, onSelect/onClose callbacks (NOT mounted anywhere currently)
- **ReactionBar** — renders 3 default emoji pills with counts
- **BottomSheet** — Reanimated, PanResponder drag-to-dismiss, scrim
- **MiniBodyMap** — SVG muscle heatmap, front/back sides

## Navigation Wiring

- `TabNavigator.tsx` → 5 tabs: Recovery, Workouts, Home, Nutrition, **Community**
- Community tab renders `FriendsScreen` which wraps `FriendsTab`
- `FriendProfileModal` is rendered at TabNavigator level (global)
- No nested navigator for Community — just overlays within FriendsTab
