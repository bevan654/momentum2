# Momentum 2.0 — Codex Context

A React Native fitness super-app for iOS + Android. Dark mode default, portrait-only, tablet-supported.
Target users: intermediate-to-advanced lifters who care about progressive overload, macros, and training data.

Current build: see `src/constants/buildInfo.ts` (auto-stamped).

### Who you're working with: guide, explain, protect the app
Most people working on this repo build by describing what they want to an AI. They are not professional developers, so they won't always know the libraries (Reanimated, Skia, FlashList, Supabase, EAS) or what makes a React Native app slow, fragile or expensive to run. Act as the experienced engineer on their team:
- **Speak up before building.** If a request has a performance, data, security or maintenance risk, say so in plain language before writing code: what the problem is, why it matters to users (lag, battery, lost data, a crash, a bigger bill) and what you recommend instead. Then let them decide. Typical things to flag: work on the JS thread during animations or scrolling, plain `ScrollView`/`map` for long lists, re-renders from unstable props or whole-store selectors, large images, polling or extra Realtime channels (see Realtime / Connection Footprint), queries without limits or indexes, writes that old app builds can't handle (see Compatibility rule), anything that needs a native build when they expect an OTA, and secrets in client code.
- **Explain as you go.** Use plain words, and briefly explain any term or library they're likely meeting for the first time. Tell them what you changed and how to check it themselves. Don't assume they read the diff.
- **Split heavy work.** If a feature is large (several screens, a new table plus UI, a native module, a big refactor), propose breaking it into small steps that each ship and can be tested on their own, and agree the order before starting. Prefer several small PRs over one big one.
- **Say what it costs.** When something needs a migration, a native/store build, a new paid service or a lot of extra requests, say so up front, along with what it means for them (e.g. "this can't go out as an OTA; it needs an App Store update").
- **Push back kindly.** If an approach will cause problems, don't just do it: offer the better option and explain the trade-off in a sentence or two. If they still want their way and it's safe, do it; if it risks user data or breaks other users' apps, explain that and don't do it without the repo owner (bevan) agreeing.
- **Database changes go through bevan.** Other contributors have access to the GitHub repo only, not the Supabase project. If a request needs anything on the database or backend side, such as a new table or column, a migration, an RLS policy, an RPC or SQL function, data fixes, edge-function deploys or Supabase settings, don't do it and don't try to work around it (for example by writing a migration and asking them to run it, or using keys from scripts). Explain in plain words what database change is needed and why, then ask them to message bevan with that summary. Build only the app side that doesn't depend on it, or wait until bevan has made the change.
- **Leave it working.** Before handing back, check it type-checks (see Pre-Commit Checklist), and tell them exactly what still needs testing on a phone.

### Existing bugs: flag them, ask before fixing
This project is a continuation of an app built with an older model, so expect bugs in existing code. When you notice one while working on something else, don't fix it silently and don't ignore it: tell the user what it is, where it is (`file:line`) and what it affects, then ask whether to fix it. If they say yes, fix it on its own `bugfix` branch unless they say otherwise, so the current change keeps its scope.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | React Native 0.81.5 + Expo SDK 54 (New Architecture: Fabric + TurboModules), Hermes |
| Language | TypeScript 5.9 (strict) |
| React | 19.1 |
| Navigation | React Navigation 7 — `native-stack`, `material-top-tabs` (used as bottom bar with custom UI) |
| State | Zustand 5 (24 stores) |
| Animations | Reanimated 4.1 + react-native-worklets — UI-thread only. Never RN `Animated`. |
| Graphics | @shopify/react-native-skia 2.2 for performance-critical visuals; react-native-svg 15.12 is still installed but no longer imported (removing it needs a native build) |
| Body map | `momentum-muscle-map` (our own library, git dependency pinned to a release tag; the lockfile pins its commit): Skia + Reanimated renderer, JS only, so OTA-safe |
| Gestures | React Native Gesture Handler 2.28 |
| Lists | @shopify/flash-list 2.0 |
| Backend | Supabase (Postgres + Auth + Realtime + Storage). No custom server, no GraphQL. |
| Auth | Supabase Auth + expo-secure-store for token persistence |
| Realtime | Supabase Realtime (`postgres_changes` only — presence is not used) |
| Push | expo-notifications + push token stored on `profiles` |
| Analytics | None wired up |
| Barcode | Open Food Facts (primary) → USDA FoodData Central (fallback, DEMO_KEY) |
| Fonts | Inter (400/500/600/700/800) via @expo-google-fonts |
| Updates | expo-updates (EAS OTA). `runtimeVersion` uses the `appVersion` policy: any native change (new native dependency, config plugin, `modules/`, `targets/`, Info.plist/manifest) needs a `version` bump in `app.config.ts` and a new store build, so older binaries never receive JS that expects it. Guard new native modules with `requireOptionalNativeModule` anyway. |
| Native extensions | Local Expo modules in `modules/` (autolinked); iOS extension targets in `targets/` via `@bacons/apple-targets` 4.0.7 (pinned: 5.x raises the iOS minimum to 16.4) |
| Build | EAS Build |

---

## Project Structure

```
/
├── App.tsx                    # Font load, auth gate, theme bootstrap, nav root
├── app.config.ts              # Expo config (bundle IDs, plugins, EAS)
├── database-schema.md         # Postgres schema reference (all public tables, generated from the live schema)
├── docs/                      # Plans, audits, security review
├── modules/                   # Local Expo modules (autolinked native code)
│   └── workout-live-activity/ # Active-workout Live Activity (iOS ActivityKit) + ongoing notification (Android); JS API in index.ts
├── targets/                   # iOS extension targets built by @bacons/apple-targets (survive `prebuild --clean`)
│   └── workout-activity/      # SwiftUI Live Activity: Lock Screen + Dynamic Island (iOS 16.2+)
├── scripts/                   # Dev/ops scripts (build stamping, imports, seeding, notifications; catalog/ = RepDB exercise import, muscle-map region targets)
│
└── src/
    ├── screens/               # Top-level routes (22 screens)
    ├── components/
    │   ├── auth/              # SocialAuthButtons (Google / Apple OAuth)
    │   ├── body/              # Body map wrappers around momentum-muscle-map: map pair, workout mini maps, exercise thumb, level toggle, region chip, workout heatmap
    │   ├── dev/               # Story/Workout share overlays, story crop
    │   ├── food/              # Nutrition modals, meal sections, hero gauge, water/supplements
    │   ├── friends/           # Feed, leaderboard, notifications, nudges, comments, search
    │   ├── home/              # Home dashboard cards, feed and modals
    │   ├── lab/               # Recovery/analytics: timers, charts, body metrics, muscle radar
        │   ├── profile/           # Settings sub-views, goal editors
    │   ├── share/             # Share modal
    │   ├── ui/                # Shared primitives: Sheet (animated bottom sheet), Portal/PortalHost
        │   ├── workout-sheet/     # Active workout: bottom sheet, sets, rest timer, confetti, finish flow
    │   ├── workouts/          # Workout history cards, exercise rows, rank/routine cards
    │   └── SheetWrapper.tsx   # Shared modal-sheet chrome
    ├── stores/                # 24 Zustand stores (see State Management)
    ├── navigation/            # AuthNavigator, TabNavigator, WorkoutsNavigator, navigationRef
    ├── services/              # liveActivityManager, notificationService, workoutFinishFeedback
    ├── lib/                   # supabase, friendsDatabase, catalogDatabase, navigationBridge
    ├── theme/                 # useColors.ts, responsive.ts, typography.ts
    ├── utils/                 # barcodeApi, displayName, exerciseCatalog, exerciseProgress, localDate (local YYYY-MM-DD), muscleLoad (effective load for heat/recovery), muscleVolume, smoothPath, streakCalculator, strengthScore, uploadWorkoutPhoto, uuid, workoutPayload (active workout → upsert_workout payload), workoutStorage
    ├── hooks/                 # useAppUpdates (EAS OTA), useForceUpdate (force-update gate), useLingerMount, useMuscleLoad (bodyweight + types for effective load), useRegionWeightLookup (body-map weights)
    └── constants/             # buildInfo, changelog, muscles, muscleMap (body-map config + heat/recovery reference values, bodyweight fractions), muscleMapLabels

supabase/
├── functions/                 # Edge functions: ai-coach, ai-workout-summary, ai-workout-notifications,
│                              #   gemini-food-scan, gemini-food-search, push-notification, delete-account, discord-*
└── migrations/                # Dated SQL migrations (YYYYMMDD_description.sql)
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
- **Community tab** renders `FriendsScreen` directly (no nested navigator). Chat was removed.
- **`navigationBridge`** exposes imperative entry points (open profile sheet, recovery overlay, workouts nav ref) to non-navigator components.
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
- Skia for rings, arcs, gradients, glows. Use Skia, not react-native-svg, for new visuals.

### Body map (momentum-muscle-map)
- Render through `src/components/body/` (`MuscleMapPair`, `WorkoutMiniMaps`, `ExerciseMuscleThumb`); bodies follow `profile.gender` and load lazily (`useBodies`), colours come from the theme's `muscleMap` tokens (`useMuscleMapColors`).
- Heat data: `src/utils/muscleVolume.ts` (region weights per exercise → weighted volume → 0..1). Volume there is effective load × reps (`src/utils/muscleLoad.ts`, context from `useMuscleLoad`): bodyweight exercises count bodyweight × a fraction from `BODYWEIGHT_FRACTIONS` + added kg, assisted ones subtract the assistance. Only heat, Training Balance and recovery use it; workout/feed totals, leaderboards, PRs and strength score stay kg × reps. Send linear values at the finest level you have; the map rolls them up and applies its own colour curve. Keep `values` and `colors` referentially stable.
- Weights come from `exercise_region_targets` (`useRegionTargetsStore`) with a fallback from legacy muscle names (`src/constants/muscleMap.ts`); reference volumes, the secondary-only heat cap and recovery thresholds live there too.
- Pass `onRegionPress` to make a `MuscleMap` tappable; no `pointerEvents` workaround is needed (0.1.0's canvas swallowed taps; 0.1.1 fixed it).
- `MiniMuscleMap` (group level, static) for lists and share images; never pre-render maps to images.

### State / Stores
- Naming: `use[Domain]Store`.
- Optimistic updates with rollback for critical writes (food, supplements).
- Fire-and-forget for non-critical (activity feed, streak persist).
- Debounced persistence: theme 100ms.
- TTL caches: friends 4h, exercise catalog 24h, exercise region targets 24h.
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

## State Management — 24 Zustand Stores

| Store | Persistence | Responsibility |
|---|---|---|
| `useAuthStore` | Supabase Auth + SecureStore | Session, profile CRUD, email verification, beta-welcome flag |
| `useActiveWorkoutStore` | AsyncStorage + Supabase | Active workout state, sets, rest timer, finish → one `upsert_workout` RPC keyed by the workout's client-generated id (payload built in `utils/workoutPayload.ts`), Undo reopens under the same id (largest store, ~1.4k LOC) |
| `useWorkoutStore` | Supabase + AsyncStorage (24h) | History, exercise catalog cache, previous-set lookups |
| `useRegionTargetsStore` | Supabase + AsyncStorage (24h) | Body-map region weights per catalog exercise (`exercise_region_targets`); empty while the table isn't deployed |
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
| `useThemeStore` | AsyncStorage (100ms debounce) | Accent + dark/light mode |
| `useProfileSettingsStore` | AsyncStorage | Local UI prefs (incl. body-map detail level) |
| `useChangelogStore` | AsyncStorage | Last-seen changelog version |
| `useLabTimeRangeStore` | In-memory | Lab tab time-range filter |

---

## Services

| Service | Status | Notes |
|---|---|---|
| `notificationService` | Active — initialized in `TabNavigator` via `initNotifications(userId)` | Realtime channel `notif:${userId}` for `notifications` table. One persistent websocket per session. |
| `liveActivityManager` | Active — started/updated/stopped by `useActiveWorkoutStore` | Active workout on the Lock Screen / status bar. On binaries with `modules/workout-live-activity` (1.0.37+): iOS 16.2+ ActivityKit Live Activity (Lock Screen + Dynamic Island, UI in `targets/workout-activity`) and an Android ongoing notification (channel `workout_live`, native chronometer, exact alarm flips it back to elapsed when a rest ends). Timers tick natively; JS sends a snapshot only when the shown content changes. Older binaries / iOS < 16.2 / Live Activities off: legacy iOS sticky expo-notification with a JS ticker. The scheduled `rest-timer` notification stays the audible rest-complete cue. |

---

## Realtime / Connection Footprint

Per active session, expect roughly:
- **1 websocket** for `notificationService` (always-on while authenticated).
- **~2 PostgREST pool workers** on the `authenticator` role (kept warm).
- **1** transient auth/refresh connection.

Total resting ~4 connections per app instance. Pool ceiling on default Supabase compute is ~60 → realistic ceiling is ~12–15 concurrent users before hitting limits. Plan for: lazy Realtime subscribe-on-focus, channel merging, or compute upgrade when scaling.

---

## Database — see `database-schema.md`

49 tables, all documented (regenerated from the live schema). Categories:

**Workout:** `workouts`, `exercises`, `sets`, `exercises_catalog`, `exercise_aliases`, `muscles`, `exercise_muscle_targets`, `muscle_map_regions`, `exercise_region_targets`, `user_exercises`, `routines`, `routine_exercises`, `programs`, `program_days`, `program_day_exercises`, `user_ranks`, `user_streaks`

**Nutrition:** `food_entries`, `food_catalog`, `barcode_foods`, `ai_food_cache`, `nutrition_goals`, `meal_config`, `supplement_goals`, `user_supplements`, `supplement_entries`, `protein_powders`, `protein_powder_log`

**Body:** `weight_entries`, `body_fat_entries`, `measurement_entries`

**Social:** `friendships`, `activity_feed`, `reactions`, `comments`, `content_reports`, `leaderboard_entries`, `leaderboard_rank_snapshots`, `nudges`, `notifications`

**Profile:** `profiles`

**AI:** `ai_coach_messages`, `ai_notification_log`, `ai_usage` (rate limits via `reserve_ai_usage` / `release_ai_usage`)

**App / ops:** `app_config` (force-update minimum versions), `feature_flags`, `waitlist`, `workout_finish_feedback`, `data_change_log`

Key columns:
- `food_entries`: macros + 14 micronutrients, `meal_type`, `quantity`, `is_planned`
- `sets`: `kg`, `reps`, `set_type` (working/warmup/drop/failure), `parent_set_number` (drop-set link); optional `rir`, `completed_at`, `rest_seconds`, `target_kg`/`target_reps`/`target_source`, `side` (left/right, one row per side), `duration_seconds`, `distance_m`
- `workouts`: `duration` (seconds; 0 = unknown), `program_id`/`program_week`; optional `started_at`/`ended_at`, `timezone`/`utc_offset_min`, `program_day_of_week`/`program_day_label`, `routine_id`, `bodyweight_kg`, `source`
- Saving: the app writes a workout through `upsert_workout(p jsonb)` (one transaction, idempotent by the client-generated `workouts.id`; modes `create` / `replace` after Undo / `edit` from history, which keeps fields the editor doesn't show via each row's `orig_id`). Older builds still insert `workouts` → `exercises` → `sets` directly, so readers must handle both.
- `exercises`: `name` is the stored identity; `catalog_id` / `user_exercise_id` are filled by the `exercises_link_identity` trigger (also for inserts from old app builds)
- `profiles`: `username`, `height`, `age`, `gender`, `push_token`, privacy flags, beta flags
- `exercises_catalog`: `id` is text; names are stored lowercase and equipment-first ("barbell bench press"). `primary_muscles`, `secondary_muscles`, `other_muscles` (legacy muscle names, see below), `equipment`, `difficulty`, `slug`, `is_main_lift`, `ranking_weight`; `is_hidden` (not offered in the picker, still resolves for history), `exercise_type` (NULL = derive from the bodyweight flags), `repdb_id`, `description`, `instructions`, `tips`, `is_unilateral`, `body_part`
- `data_change_log`: old/new value of every column changed by a data clean-up (service role only); use it to revert

**Exercise catalog (RepDB):** most rows come from the RepDB dataset, imported by `scripts/catalog/import_repdb.py` (decisions for our own rows in `scripts/catalog/decisions.json`; undo with `scripts/catalog/revert_import.sql`). Its licence allows in-app use with the "Exercise data by RepDB (repdb.co)" credit in Profile, but not redistribution, and this repo is public: never commit RepDB content (the dataset, generated SQL, names or text), only RepDB ids. Renamed exercises keep their old name as an `exercise_aliases` row, so old app builds and imported names still resolve. `primary_muscles` / `secondary_muscles` stay in the legacy vocabulary every app build understands (`MUSCLE_ALIASES` in `src/constants/muscles.ts`); anatomical detail is in `exercise_muscle_targets` (→ `muscles`), and `muscle_map_regions` maps muscles to the regions of each body-map renderer (`map_id`), so a new body map only adds its own rows. Main-lift slots in `src/utils/strengthScore.ts` and the leaderboard RPCs match lifts by name: keep the previous name listed when renaming one.

**Region targets (deep muscle map):** `exercise_region_targets` says which regions of the `momentum-muscle-map` body each catalog exercise works and how hard, per `map_id`, which names the map's region-id set rather than its full version: `momentum-muscle-map@0.<minor>` before 1.0 (a 0.x minor may rename regions), `@<major>` from 1.0, so a patch release never needs new rows. Region ids are that library's public API, so a `map_id` that changes them gets new rows; the app reads the rows of `MUSCLE_MAP_ID` (`src/constants/muscleMap.ts`). `region` is an unsided slug from the map's `src/data/hierarchy.ts` (always part level as generated; the app mirrors or sides unilateral work), and `weight` is above 0 and at most 1, with the strongest region of each exercise at exactly 1 (prime movers 0.9–1, major synergists 0.4–0.7, minor/stabilisers 0.15–0.3). `source` is `hand` (every exercise logged so far, from `scripts/catalog/region_overrides.json`) or `rule` (RepDB muscle lists spread over map parts, plus name keyword rules). Generate with `scripts/catalog/region_targets.py`, which also validates against the map and writes the seed block of a migration; `scripts/catalog/check_region_targets.py` checks the rows in a database. Both scripts derive the `map_id` from the `--map` checkout's `package.json`, so point them at the map version the app pins. The overrides use only our own names (from `decisions.json`), never RepDB names.

**Compatibility rule:** older app builds stay installed (builds before the force-update gate can't be blocked), and they write directly to `workouts` → `exercises` → `sets`. Schema changes must be additive: new nullable columns, no renames, type changes, new NOT NULL columns or drops, and no trigger that can fail an insert.

**Applying migrations — never run `supabase db push`.** 15 early migrations (20260218–20260709) were applied by hand and are not in production's migration history, so `db push` would re-run them against live data. Apply a new migration file on its own, then record it: `insert into supabase_migrations.schema_migrations (version, name) values ('<version>', '<name>')`. The repo's migrations also can't rebuild the database from scratch (there's no baseline); for a local copy, restore a dump of production instead.

**Edge functions:** `supabase/functions/` was re-synced from what is deployed on 2026-11-14 (several functions had been deployed from local copies that were never committed, including the AI rate-limit guard in `_shared/aiGuard.ts`; downloaded sources come back without TypeScript types). Before deploying a function, download the deployed version (`npx supabase functions download <name>` into a scratch copy) and diff it against the repo, so a deploy never rolls back someone else's change. Commit what you deploy.

**Webhooks:** `profiles` (insert/update) and `notifications` (insert) have triggers that call production edge functions (Discord, push). Never apply data changes to those tables casually, and strip those triggers from any local copy.

### Cross-user reads
The `profiles` SELECT policy is owner-only. For cross-user lookups, use:
- `public_profiles` view (id, username, gender, leaderboard_opt_in, created_at) — for `.from(...)` queries
- `list_public_profiles(p_ids uuid[])` RPC — security-definer, batch lookup with privacy flags
- `search_public_profiles(p_query text, p_current_user uuid)` RPC — username search

Never query `from('profiles')` to read another user's row — RLS will return empty.

---

## External APIs

```
# Barcode (primary)
GET https://world.openfoodfacts.org/api/v2/product/{barcode}

# USDA fallback (rate-limited DEMO_KEY)
GET https://api.nal.usda.gov/fdc/v1/foods/search
```

---

## Before Starting Any Work: Who Am I Working With?

Several developers work on this repo (e.g. `bevan`, `britto`, `thev`). At the start of every session, **before creating a branch or making any changes**, ask the user for their name, unless they've already given it in this session. Don't guess it from `git config`, the machine or existing branches; at most, suggest it as the default answer.

Use their lowercase first name (matching the existing prefixes on GitHub) as `{user}` in branch names. See Branches below.

---

## Feature Workflow (mandatory for any new feature)

Follow these steps in order. Don't write feature code until steps 1 and 2 are done.

### 1. Clarify: ask before building
Ask the user questions until the feature is fully understood. Don't assume. Cover what the user may not have thought of:
- **Scope:** what's in v1, what's explicitly out, and where it lives (which tab, screen, sheet or widget)
- **Data:** new tables or columns? RLS (owner-only vs. friends vs. public)? Does it need a migration? What about existing users with no data?
- **States:** empty, loading, error, offline, first-time user
- **Social and privacy:** does it show up in the feed, leaderboards or notifications? Is there an opt-out?
- **Platforms:** iOS vs. Android differences, tablet layout, light mode plus all 12 accents
- **Edge cases:** units (kg/lb), time zones and day boundaries, active-workout interactions, backgrounding
- **Ship plan:** OTA-safe (JS only) or needs a native build? Changelog entry? PostHog events?

Summarise the agreed requirements back to the user before moving on.

### 2. Research: find the best implementation
Before coding, research the best way to meet **all** the requirements:
- Check first whether something already in `package.json` or the codebase solves it. Reuse beats adding.
- For any new library, verify that it is compatible with Expo SDK 54, React Native 0.81 and the New Architecture (Fabric/TurboModules); that it's actively maintained (recent releases, open issues); its bundle and native size; and whether it needs a config plugin or a native rebuild, which rules out shipping it OTA.
- Follow the Library-First order (Reanimated → Gesture Handler → FlashList → Skia → Zustand). For backend logic, decide whether it belongs in the client, a Postgres function/RPC or an edge function.
- Present a short recommendation (approach, libraries, trade-offs, anything that can't be met) and get the user's go-ahead.

### Use subagents for in-depth research and code reading
When a feature or fix needs deep research or reading a lot of code (a whole flow across stores, screens, `lib/` and SQL; an audit; library or API research; tracing every caller of something you're changing), spawn subagents to do it instead of reading everything in the main session. This keeps the main context focused on decisions and the change itself, and lets the reading be thorough instead of skimmed.
- Brief each subagent like a peer who knows nothing: the goal, the files and docs to start from (this file, `database-schema.md`, the relevant migrations), what's already ruled out, and the exact output you want back (e.g. "the current flow step by step with `file:line`, defects ranked by severity, open questions").
- Ask it to read the code in full rather than excerpts and to verify every claim against the code, so nothing is missed. Don't hand it your conclusion to confirm.
- Keep each one's scope narrow; run independent ones in parallel.
- Research subagents are read-only: no edits, no commits, no database writes. Act on their findings yourself, and check anything critical (data loss, migrations, RLS) in the code before relying on it.
- Skip it for a lookup you can do in a few tool calls.

### 3. Build on a branch
Then implement it, following the Git & GitHub Practices below.

---

## Git & GitHub Practices

Keep the repo clean and the history readable.

### Stay in sync with GitHub
Several people push to this repo, so a local copy goes stale fast. Working on old code causes conflicts, re-fixes bugs that are already fixed, and builds on files that have since changed.
- **At the start of every session**, and before creating a branch, run `git fetch origin` and `git status`. Tell the user in plain words where they stand: whether `main` is behind (and by how many commits), whether they have uncommitted changes, and which branch they're on. If they have uncommitted work, ask what to do with it before switching or pulling, and never discard it.
- **Update before you start:** `git checkout main && git pull`. If the pull fails (local changes or a conflict), stop and explain it; don't force anything.
- **If `package.json` or `package-lock.json` changed in the pull, run `npm install`.** Missing packages are the most common reason the app or `expo` commands suddenly fail after updating.
- **Before opening a PR** on a branch that has been open a while, fetch again and merge `origin/main` into the branch (a normal merge, not a rebase or force-push), fix any conflicts, and re-run the typecheck.
- **Check open PRs before starting** (`gh pr list`): if someone else is already changing the same files or feature, tell the user so they can coordinate instead of duplicating work.

### Branches
- Never commit directly to `main`. Branch from an up-to-date `main` (`git checkout main && git pull`) for every piece of work. The only exception is review-loop fix branches, which branch off the PR under review (see below).
- **Naming: `{user}/{type}/{short-name}`.**
  - `{user}`: the developer's lowercase first name, asked at the start of the session (see "Before Starting Any Work").
  - `{type}`: `feature` (new functionality), `bugfix` (fixing broken behaviour) or `chore` (docs, refactors, tooling, deps, cleanup).
  - `{short-name}`: kebab-case and descriptive. No dates, no spaces, no quotes, no vague names like `changes` or `fixes`.
  - Examples: `bevan/feature/big-three-leaderboard`, `britto/bugfix/rest-timer-drift`, `thev/chore/update-docs`.
- One feature or fix per branch.
- Delete branches once they're merged. Don't let stale branches pile up.

### Pull Requests & Merging
- **Never merge into `main` yourself unless the user explicitly approves that specific merge.** Approval for one PR doesn't carry over to the next.
- When the user asks you to commit and push finished work, your job ends at **opening a pull request** (`gh pr create`) with a summary and a test plan, so another agent or reviewer can double-check it. Then give the user the PR link.
- Never bypass branch protection (no `gh pr merge --admin`, no force-pushing to `main`, no unlocking or editing protection rules). The only exception is the final merge step of the review loop below.
- When reviewing someone else's PR outside that loop, report findings as PR comments or back to the user. Don't merge it.

### When the user asks to merge a PR: review-and-fix loop
A request to merge is the trigger for a review, not an instant merge. Run this as a **background agent** so the user isn't blocked, and tell them it has started.

1. **Review.** The background agent checks out the PR (call it PR A) and reviews its full diff against `main` for bugs: logic errors, crashes, regressions in behaviour the PR touches, broken imports or types (`npx tsc --noEmit` must add no new errors), RLS or migration problems, and violations of the conventions in this file. It also traces how changed code is used elsewhere; don't just read the diff.
2. **Fix.** If it finds real bugs, it fixes them on a new branch off PR A's branch, `{user}/bugfix/<pr-short-name>-review-<n>` (`{user}` is the developer who asked for the merge, `<pr-short-name>` is the `{short-name}` part of PR A's branch, `<n>` is the round number), and opens a fix PR **targeting PR A's branch** (not `main`). The fix PR lists each bug, why it's a bug, and the fix.
3. **Loop.** A fresh review pass then checks PR A's branch with the fix applied, looking at the whole diff, not just the fix, since fixes can introduce new bugs. Once that pass confirms the fix, merge the fix PR into PR A's branch. Repeat steps 1–3 until a review pass finds nothing.
4. **Cap.** Stop after **3 rounds** and report to the user instead of continuing. Also stop and report back to the user straight away, without merging, if a finding needs a product decision, changes the PR's scope or behaviour, or touches data or migrations in a way that can't be undone.
5. **Merge.** Once a pass is clean, report to the user: rounds run, bugs found and fixed (with fix PR links), and anything deliberately left alone. The user's merge request counts as approval for **this PR only**, so the agent may now merge PR A into `main`. Because `main` requires a review the author can't give, this one step may use `gh pr merge --merge --admin --delete-branch`. Then delete the fix branches.

The user's merge request also authorises the agent to commit, push and open fix PRs for this loop. The background agent can't ask the user questions, so it uses the requesting developer's `{user}` instead of asking for a name, and skips the changelog question in the Pre-Commit Checklist (changelog entries belong to PR A, not its fix PRs).

Don't report "no bugs" without having run the review. If the review couldn't run (for example, the build or typecheck tooling failed), say so and don't merge.

### Commits
- Small, focused commits that each leave the app building.
- Descriptive imperative messages, e.g. `Add big-three leaderboard RPC`. Never use placeholder messages like `sdfg` or `fdsaf`.
- Review `git status` and `git diff` before committing. Stage specific files, not blind `git add -A`.
- Commit or push only when the user asks (a merge request covers the review loop's fix branches; see above).

### Keeping the repo clean
- Never commit secrets (`.env`, keys, `google-services.json` with real keys, service-role tokens) or generated output (`ios/`, `android/`, `dist/`, build artifacts).
- No scratch files, test exports, one-off scripts or personal CSVs in the repo root. Put plans and audits in `docs/` (or delete them once done) and utility scripts in `scripts/`.
- Database changes go in `supabase/migrations/YYYYMMDD_description.sql`, one logical change per file. Never edit a migration that has already been applied; add a new one.
- Keep `CLAUDE.md`, `AGENTS.md` and `database-schema.md` up to date when structure, stores, tables or conventions change. `AGENTS.md` mirrors `CLAUDE.md`.

---

## File Structure & Organization

Keep the codebase as clean and well-structured as possible. Every file should have one obvious home.

### Where things go
| What | Where |
|---|---|
| Route-level screen | `src/screens/` (and wire it into a navigator in `src/navigation/`) |
| UI used by one feature | `src/components/<feature>/` |
| UI shared across features | `src/components/` root, or a clearly named shared folder |
| State | `src/stores/use[Domain]Store.ts` |
| Supabase or third-party I/O with side effects | `src/services/` (feature logic) or `src/lib/` (clients, low-level DB helpers) |
| Pure helpers (no React, no I/O) | `src/utils/` |
| Reusable hooks | `src/hooks/` |
| Shared types | `src/types/`. Types used by only one file stay in that file. |
| Static data and config | `src/constants/` |
| Edge functions / SQL | `supabase/functions/<name>/`, `supabase/migrations/` |
| Docs, plans, audits | `docs/` |
| Dev/ops scripts | `scripts/` |

### Rules
- **Don't add new top-level or `src/` folders** without asking the user first. Use the existing structure.
- **Search before creating.** Check for an existing component, util, hook or store that already does the job. Extend it rather than duplicating it.
- **Keep files focused.** One main component per file. When a file passes about 400–500 lines, or mixes several concerns, split out sub-components, hooks or helpers into the same feature folder. Don't make an existing large file bigger. Extract instead. Don't refactor unrelated large files unless asked.
- **Colocate.** Sub-components, hooks and helpers that only one feature uses live in that feature's folder, not in the global `utils/` or `hooks/`.
- **Delete, don't orphan.** When a feature is removed or replaced, delete its components, store slices, styles, assets, unused imports and dead code in the same change. Don't leave commented-out code or `*Old`/`*V2` copies lying around.
- **Naming:** follow the conventions in File Naming. Names should say what the file does (`WorkoutSummaryModal.tsx`, not `Modal2.tsx`).
- When the structure changes, update the Project Structure tree in this file.

---

## Pre-Commit Checklist

- `npx tsc --noEmit` introduces no new errors. (There is a pre-existing baseline of type errors in the app code. `supabase/functions` is Deno code and is excluded from the app tsconfig.)
- No stray debug `console.log`s, commented-out blocks or unrelated changes in the diff.
- If you added or changed migrations, update `database-schema.md` and tell the user they need to apply them.
- Ask the user whether to add an entry to `src/constants/changelog.ts`. If yes, prepend a new entry with the next version, today's date and a user-facing summary. Skip purely internal changes (refactors, tooling) unless requested.

---

## What NOT to Do

- Don't use `React.Animated` — Reanimated only.
- Don't use `react-native-svg` for new graphics — Skia.
- Don't hardcode hex colors — `useColors()`.
- Don't use `fontWeight` — `fontFamily` with the right Inter variant.
- Don't build list components from scratch — FlashList.
- Don't write raw fetch to Supabase — use the `supabase` client from `src/lib/supabase.ts`.
- Don't add screens without wiring them into a navigator under `src/navigation/`.
- Don't query `from('profiles')` for another user's row — RLS blocks it. Use `public_profiles` view or `list_public_profiles` RPC.
