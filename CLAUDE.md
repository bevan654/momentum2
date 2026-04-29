# Momentum 2.0 — Claude Code Context

A React Native fitness super-app for iOS + Android. Dark mode default, portrait-only, tablet-supported.
Target users: intermediate-to-advanced lifters who care about progressive overload, macros, and training data.

Current build: see `src/constants/buildInfo.ts` (auto-stamped).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | React Native 0.81.5 + Expo SDK 54 (New Architecture: Fabric + TurboModules), Hermes |
| Language | TypeScript 5.9 (strict) |
| React | 19.1 |
| Navigation | React Navigation 7 — `native-stack`, `material-top-tabs` (used as bottom bar with custom UI), `stack` |
| State | Zustand 5 (26 stores) |
| Animations | Reanimated 4.1 + react-native-worklets — UI-thread only. Never RN `Animated`. |
| Graphics | @shopify/react-native-skia 2.2 for performance-critical visuals; react-native-svg 15.12 still used in legacy components |
| 3D | three + @react-three/fiber + @react-three/drei + expo-gl (used sparingly, e.g. AvatarViewer) |
| Gestures | React Native Gesture Handler 2.28 |
| Lists | @shopify/flash-list 2.0 |
| Backend | Supabase (Postgres + Auth + Realtime + Storage). No custom server, no GraphQL. |
| Auth | Supabase Auth + expo-secure-store for token persistence |
| Realtime | Supabase Realtime (`postgres_changes` only — presence is not used) |
| Push | expo-notifications + push token stored on `profiles` |
| Analytics | posthog-react-native |
| Barcode | Open Food Facts (primary) → USDA FoodData Central (fallback, DEMO_KEY) |
| Fonts | Inter (400/500/600/700/800) via @expo-google-fonts |
| Updates | expo-updates (EAS OTA) |
| Build | EAS Build |

---

## Project Structure

```
/
├── App.tsx                    # Font load, auth gate, theme bootstrap, nav root
├── app.config.ts              # Expo config (bundle IDs, plugins, EAS)
├── database-schema.md         # Postgres schema reference (some tables missing — see below)
├── exercises_catalog.csv/sql  # Exercise seed data
├── patches/fix-body-highlighter.js  # Postinstall patch for react-native-body-highlighter
│
└── src/
    ├── screens/               # Top-level routes (21 screens)
    ├── components/
    │   ├── body/              # Muscle body map (heatmap, mini map)
    │   ├── BodyHighlighter/   # Male/female SVG wrapper
    │   ├── chat/              # 1:1 messaging UI (see "Chat module" caveat below)
    │   ├── dev/               # AvatarViewer (3D), Story/Workout overlays — debug-ish
    │   ├── food/              # Nutrition modals, meal sections, hero gauge, water/supplements
    │   ├── friends/           # Feed, leaderboard, notifications, nudges, comments, search
    │   ├── home/              # Dashboard widgets and modals
    │   ├── lab/               # Recovery/analytics: timers, charts, body metrics, muscle radar
    │   ├── plus-menu/         # FAB action sheet
    │   ├── profile/           # Settings sub-views, importer, goal editors
    │   ├── share/             # Share hub + share modal
    │   ├── widget-grid/       # Draggable/resizable home widget system
    │   ├── workout-sheet/     # Active workout: bottom sheet, sets, rest timer, confetti, finish flow
    │   ├── workouts/          # Workout history cards, exercise rows, rank/routine cards
    │   └── SheetWrapper.tsx   # Shared modal-sheet chrome
    ├── stores/                # 26 Zustand stores (see State Management)
    ├── navigation/            # AuthNavigator, TabNavigator, WorkoutsNavigator, CommunityNavigator, navigationRef, navigationBridge
    ├── services/              # chatService, importService, liveActivityManager, notificationService
    ├── lib/                   # supabase, friendsDatabase, chatDatabase, navigationBridge
    ├── theme/                 # colors.ts, useColors.ts, responsive.ts, typography.ts
    ├── utils/                 # barcodeApi, beepSound, displayName, muscleVolume, streakCalculator, strengthScore, workoutStorage
    ├── hooks/                 # useAppUpdates.ts (EAS OTA)
    ├── constants/             # buildInfo, changelog, muscles
    └── types/                 # widget.ts
```

---

## Navigation Topology

- **Root (`App.tsx`)** decides between:
  - `AuthNavigator` (Login / SignUp / ForgotPassword) when no session
  - `WelcomeSplashScreen` for first-load flash
  - `OnboardingScreen` if profile is incomplete (height/age/gender/starting_weight)
  - `TabNavigator` once authenticated and onboarded
- **`TabNavigator`** uses `MaterialTopTabNavigator` rendered with a **custom bottom tab bar** (animated indicator, central elevated Home button, Community badge). Tabs: **Recovery, Workouts, Home, Nutrition, Community**. Options: `lazy: true`, `freezeOnBlur: true`, `lazyPreloadDistance: 1`.
- **`WorkoutsNavigator`** (native stack) hosts: `StartWorkout`, plan editors (`CreateRoutine`, `RoutineSummary`, `CreateProgram`, `ProgramSummary`, `ProgramDayEditor`, `ProgramProgress`), and `WorkoutDetail`. Re-pressing the Workouts tab triggers `showRecoveryOverlay()` via `navigationBridge`.
- **`CommunityNavigator`** (native stack) hosts: `CommunityHome` (FriendsScreen), `ChatList`, `Chat`.
- **`navigationBridge`** exposes imperative entry points (open profile sheet, share hub, recovery overlay, workouts nav ref) to non-navigator components.
- **`ProfileScreen`** is mounted as a 92%-height bottom sheet, opened by long-pressing the Home tab or tapping the avatar.

---

## Coding Patterns & Conventions

### Responsive Sizing (mandatory)
- Use `sw()` (width-scale), `ms()` (moderate-scale), `sh()` (height-scale) from `src/theme/responsive.ts`. Base device: iPhone 14 Pro (393×852). Never hardcode pixel dimensions.

### Typography
- Always use `fontFamily` (Inter weight variants) — never `fontWeight`. Weights: 400/500/600/700/800.

### Colors & Theming
- Inside components: `useColors()` hook.
- Pure functions: `getThemeColors(mode, accent)` (module-level cache).
- 12 accent colors. Never hardcode hex — always reference theme tokens.

### Component Structure
- Feature-based folders under `components/`.
- Wrap with `React.memo`. Styles via `useMemo` in-component (not module-level `StyleSheet.create` unless static).
- Extract heavy sub-components.

### Animations
- Always Reanimated: `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`. Never RN's `Animated`. UI-thread only.

### Graphics
- Skia for rings, arcs, gradients, glows. Prefer Skia over react-native-svg for new visuals; some legacy components still use SVG.

### State / Stores
- Naming: `use[Domain]Store`.
- Optimistic updates with rollback for critical writes (food, supplements, widgets).
- Fire-and-forget for non-critical (activity feed, streak persist).
- Debounced persistence: widgets 300ms, theme 100ms.
- TTL caches: friends 4h, exercise catalog 24h.
- Cross-store sync where needed (food goals ↔ nutrition store).

### Supabase Pattern
```typescript
// Read
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Write
await supabase.from('table_name').insert({ ...payload });

// Realtime (postgres_changes only — no presence used)
supabase
  .channel('channel-name')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, handler)
  .subscribe();
```

### Error Handling
- Services and stores: silent `try/catch` — swallow internally. Only surface to user when UX-blocking. Console-log in dev. No crash reporter wired up.

### File Naming
- Components: `PascalCase.tsx`. Stores/utils/services/hooks/lib: `camelCase.ts`. Stores: `use[Domain]Store.ts`.

### Performance
- Never block JS thread. Use `freezeOnBlur` on tab screens. Test in release (Hermes + New Arch) only. FlashList for any list >~20 items.

### Library-First
Prefer Reanimated → Gesture Handler → FlashList → Skia → Zustand. No custom solutions unless a measured bottleneck exists.

---

## State Management — 26 Zustand Stores

| Store | Persistence | Responsibility |
|---|---|---|
| `useAuthStore` | Supabase Auth + SecureStore | Session, profile CRUD, email verification, beta-welcome flag |
| `useActiveWorkoutStore` | AsyncStorage + Supabase | Active workout state, sets, rest timer, finish → DB write (largest store, ~1.2k LOC) |
| `useWorkoutStore` | Supabase + AsyncStorage (24h) | History, exercise catalog cache, previous-set lookups |
| `useRoutineStore` | Supabase | Saved routines + exercises |
| `useProgramStore` | Supabase | Multi-week training programs and progress |
| `useFoodLogStore` | Supabase | Food entries CRUD, meal configs, goals, catalog search |
| `useNutritionStore` | Supabase | Daily nutrition aggregation (synced with food store) |
| `useNutrientGoalStore` | Supabase | Macro + micronutrient targets |
| `useSavedMealsStore` | Supabase | User-saved meal templates |
| `useFavouritesStore` | Supabase | Favourited foods |
| `useProteinPowderStore` | Supabase | Powder catalog + serving log |
| `useSupplementStore` | Supabase | Water + creatine entries/goals (optimistic) |
| `useWeightStore` | Supabase | Weight entries + EMA trend |
| `useBodyFatStore` | Supabase | Body-fat % entries |
| `useMeasurementStore` | Supabase | Tape measurements (chest/arms/etc.) |
| `useRankStore` | Supabase (cached) | Strength scoring, e1RM, per-muscle/overall rank |
| `useStreakStore` | Computed + fire-and-forget | Streak from workout dates |
| `useMuscleAnalysisStore` | Pure compute | Weekly muscle volume |
| `useFriendsStore` | Supabase (4h cache) | Friends, feed, leaderboard, notifications, paginated |
| `useChatStore` | Supabase | Conversations + messages (see Chat caveat) |
| `useImportStore` | Supabase (bulk) | Multi-phase CSV/TSV workout import |
| `useWidgetStore` | AsyncStorage (300ms debounce) | Widget grid layout/sizes |
| `useThemeStore` | AsyncStorage (100ms debounce) | Accent + dark/light mode |
| `useProfileSettingsStore` | AsyncStorage | Local UI prefs |
| `useChangelogStore` | AsyncStorage | Last-seen changelog version |
| `useLabTimeRangeStore` | In-memory | Lab tab time-range filter |

---

## Services

| Service | Status | Notes |
|---|---|---|
| `notificationService` | Active — initialized in `TabNavigator` via `initNotifications(userId)` | Realtime channel `notif:${userId}` for `notifications` table. One persistent websocket per session. |
| `chatService` | **Code present but never initialized** | `initChatService()` exists but is not called anywhere. Chat UI screens are wired into `CommunityNavigator`, but the realtime singleton is dormant. Treat chat as in-progress / not-shipped. |
| `importService` | On-demand | CSV/TSV → workouts bulk import |
| `liveActivityManager` | iOS Live Activities for active workouts |

---

## Realtime / Connection Footprint

Per active session, expect roughly:
- **1 websocket** for `notificationService` (always-on while authenticated).
- **1 websocket** for `ActivityFeed` (`feed-realtime` channel) while the Friends/Community tab is mounted.
- **~2 PostgREST pool workers** on the `authenticator` role (kept warm).
- **1** transient auth/refresh connection.

Total resting ~5 connections per app instance. Pool ceiling on default Supabase compute is ~60 → realistic ceiling is ~10–12 concurrent users before hitting limits. Plan for: lazy Realtime subscribe-on-focus, channel merging, or compute upgrade when scaling.

---

## Database — see `database-schema.md`

28 documented tables. Categories:

**Workout:** `workouts`, `exercises`, `sets`, `exercises_catalog`, `user_exercises`, `routines`, `routine_exercises`, `user_streaks`

**Nutrition:** `food_entries`, `food_catalog`, `user_created_foods`, `barcode_foods`, `nutrition_goals`, `meal_config`, `supplement_goals`, `supplement_entries`, `protein_powders`, `protein_powder_log`

**Body:** `weight_entries`, `body_fat_entries`, `measurement_entries`

**Social:** `friendships`, `activity_feed`, `reactions`, `leaderboard_entries`, `nudges`, `notifications`

**Profile:** `profiles`

Key columns:
- `food_entries`: macros + 14 micronutrients, `meal_type`, `quantity`, `is_planned`
- `sets`: `kg`, `reps`, `set_type` (working/warmup/drop/failure), `parent` (drop-set link)
- `profiles`: `username`, `height`, `age`, `gender`, `push_token`, privacy flags, beta flags
- `exercises_catalog`: `primary_muscles`, `secondary_muscles`, `other_muscles`, `equipment`, `difficulty`, `slug`

**Tables referenced in code but missing from `database-schema.md`:** `user_ranks` (used by `useRankStore`), `programs` / program-related tables (used by `useProgramStore`), `messages` / `conversations` (used by chat code, dormant).

---

## External APIs

```
# Barcode (primary)
GET https://world.openfoodfacts.org/api/v2/product/{barcode}

# USDA fallback (rate-limited DEMO_KEY)
GET https://api.nal.usda.gov/fdc/v1/foods/search
```

---

## Pre-Commit Checklist

Before committing, ask the user whether to add an entry to `src/constants/changelog.ts`. If yes: prepend a new entry with the next version, today's date, and a user-facing summary. Skip purely internal changes (refactors, tooling) unless requested.

---

## What NOT to Do

- Don't use `React.Animated` — Reanimated only.
- Don't use `react-native-svg` for new graphics — Skia.
- Don't hardcode hex colors — `useColors()`.
- Don't use `fontWeight` — `fontFamily` with the right Inter variant.
- Don't build list components from scratch — FlashList.
- Don't write raw fetch to Supabase — use the `supabase` client from `src/lib/supabase.ts`.
- Don't add screens without wiring them into a navigator under `src/navigation/`.
- Don't initialize `chatService` without explicit user direction — chat is intentionally dormant.
