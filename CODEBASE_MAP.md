# Codebase Map

**Last verified:** 2026-11-18, against the code at commit `65d2a51` (tv/feature/create-meal-barcode-quick-add).

An index of where things live and how they connect. Rules and conventions are in `CLAUDE.md`; database tables are in `database-schema.md`. This map is the only description of the project structure; `CLAUDE.md` points here instead of keeping its own tree.

## Overview
Momentum is a React Native fitness app (iOS + Android): workouts, nutrition, body metrics, recovery and a social feed.
Stack: Expo SDK 54, React Native 0.81 (New Architecture, Hermes), TypeScript (strict), Zustand stores, Reanimated + Skia, Supabase backend (Postgres, Auth, Realtime, Storage, Deno edge functions). Built and updated (OTA) with EAS.
Nearly all app code is TypeScript in `src/`. There is no path alias: imports are relative (`../../`).

## Directory map
| Path | What it holds |
|---|---|
| `index.ts`, `App.tsx` | App entry and root component (see Entry points) |
| `app.config.ts`, `eas.json` | Expo config (bundle ids, plugins, runtime version) and EAS build/update profiles |
| `src/screens/` | 19 route-level screens |
| `src/navigation/` | `AuthNavigator`, `TabNavigator` (the 5 tabs), `WorkoutsNavigator` (Workouts tab stack), `navigationRef`, `freezeFarTabs` (stops tabs more than one away from the current tab re-rendering) |
| `src/components/<feature>/` | UI per feature (table below) |
| `src/stores/` | 24 Zustand stores, `use[Domain]Store.ts`: app state and most Supabase reads/writes. Helpers split out of a large store live in a folder named after it (`activeWorkout/`, `foodLog/dayCache.ts`: the diary's per-day cache; `foodLog/foodHistory.ts`: every food logged on this phone, so Recent and "Your foods" keep foods whose diary entries were deleted) |
| `src/lib/` | Supabase client (`supabase.ts`), social DB calls (`friendsDatabase.ts`, which re-exports the topic files in `lib/friends/`), catalog DB (`catalogDatabase.ts`), `navigationBridge.ts`, `userScopedStorage.ts` (AsyncStorage keys per account), `currentUser.ts` (signed-in id for stores that can't import `useAuthStore`) |
| `src/services/` | Side-effect services: `notificationService` (Realtime), `liveActivityManager` (Lock Screen), `workoutFinishFeedback` |
| `src/utils/` | Helpers, mostly pure (dates, volume, strength score, payloads). Exceptions with side effects: `barcodeApi`, `uploadWorkoutPhoto`, `workoutStorage` (I/O), `confirmReplaceWorkout` (alerts + store writes) |
| `src/hooks/` | Shared hooks (OTA updates, force-update gate, muscle load, region weights, today's date, linger-mount for exit animations, debounced value, username/email availability check for sign-up and onboarding) |
| `src/theme/` | `useColors.ts` (theme tokens), `responsive.ts` (`sw`/`ms`/`sh`), `typography.ts` (`Fonts`) |
| `src/constants/` | Static data: `muscles`, `muscleMap`, `muscleMapLabels`, `dateNames`, `changelog`, `buildInfo` (auto-stamped, don't move) |
| `modules/workout-live-activity/` | Local native Expo module (Swift/Kotlin + `index.ts`): Live Activity / ongoing notification. Native: changes need a store build |
| `targets/workout-activity/` | iOS Live Activity widget (SwiftUI), built by `@bacons/apple-targets` (survives `prebuild --clean`). Native: changes need a store build |
| `supabase/migrations/` | Dated SQL migrations. Database changes go through bevan |
| `supabase/functions/` | Deno edge functions (AI coach/summaries, Gemini food scan/search, push, Discord, delete-account) + `_shared/` |
| `scripts/` | Dev/ops scripts: `stamp-build.js` + `update.bat` (OTA release), `catalog/` (exercise catalog + region-target tooling), `check-codebase-map.js` (`npm run check:map`), `check-hidden-links.js` (`npm run check:links`), one-off admin scripts |
| `.claude/` | Shared Claude Code setup: `agents/codebase-scout.md`, `rules/navigation.md`, `settings.json` (turns on the TypeScript LSP plugin). Everything else in it is personal and git-ignored. Anything added to `agents/` or `rules/` is shared with the whole team, so keep personal agents and rules in `~/.claude/` instead |
| `docs/` | Past plans, audits and the security review. Historical: may describe code that has since changed |
| `assets/` | `logo.png` (app icon, splash, share cards) |
| `database-schema.md` | Every public table and column (generated from the live schema) |

### `src/components/` folders
| Folder | Feature | Notes |
|---|---|---|
| `auth/` | Login, Sign Up and Forgot Password pieces: `AuthLayout` (keyboard container + entrance animation), `AuthBrand`, `AuthInput` (icon field with status icon, eye toggle, hint), `FieldStatusIcon`, shared `authStyles`, Google/Apple `SocialAuthButtons` | `FieldStatusIcon` is also used by onboarding |
| `body/` | Body map wrappers around `momentum-muscle-map` | `useBodyMap.ts` exports `useBodies`, `useMuscleMapColors` and other helpers, but no `useBodyMap` |
| `food/` | Nutrition tab: day summary (`NutritionHero`: calorie ring, macro bars), water/supplement strip, meal cards, add-food, barcode, AI scan, food detail | Meal cards: `MealList` → `MealCard`; entries are grouped by `groupEntriesByMeal.ts`, which matches `meal_type` to the user's `meal_config` by slot, then by name (many accounts use `meal_1`… labelled Breakfast…). Popups are built from the shared kit in `food/ui/` (`FoodSheetHeader`, `FoodSearchBar`, `FoodRow`, `FoodSegmentChips`, `FoodEmptyState`, `FavouriteButton`, `useKeyboardInset`); reuse it for new food screens. `macro-lens/` holds the pieces of `MacroLensModal` (AI photo scan). `create-meal/` holds the pieces of `CreateMealModal` (Make a meal: search, scan or quick add foods into a meal, log it as one meal group or save it on the phone): `MealFoodPicker` (search and default lists), `food/create-meal/mealItems.ts` (item ↔ entry conversion, `food_entries` rows) and `useLogMeal` (the batch insert). Quick add inside a meal is `QuickAddModal` with `onSubmitItem`. |
| `friends/` | Community tab: leaderboard, search, notifications, reports, the friend stories row (`FriendStories`) | `AvatarCircle`, `ReportSheet` are also used by other features. `feed-workout/` holds the pieces of `FeedWorkoutModal` (starting a workout from a post: `useStartFeedWorkout`; saving one as a routine: `useSaveFeedRoutine`) |
| `home/` | Home tab cards (activity, nutrition, water, supplements) | Also holds app-wide pieces: `Header` (global header), `ChangelogModal`, `BetaWelcomeModal`, the Community `Feed` (its rows and pieces live in `home/feed/`); `activity/` holds the year view and calendar helpers of `ActivityCard`. The Nutrition, Water and Supplements cards' detail popups share `CardDetailSheet` (chrome, hero row, bar, quick-add buttons, Undo/Done footer); the Nutrition and Supplements popup contents live in `NutritionDetailModal` / `SupplementDetailModal` |
| `lab/` | **Recovery tab** (screen is `LaboratoryScreen`): body metrics, charts, AI card | The Weight, Body Fat and Measurements cards (paged by `BodyMetricsPager`) are thin wrappers over `lab/trend/`: `TrendCard` (header, range selector), `TrendChart` (bars + EMA line + legend), `useTrendRange` (range synced to `useLabTimeRangeStore`, fetch + fade), `useTrendLayout`, `EntryHistorySheet` (swipe-to-delete history) and `NumberLogModal` (log dialog). `AiHeroCard` is the AI coach preview; the chat itself is `AiCoachChatModal` with its state, history load and edge-function call in `useAiCoachChat` |
| `onboarding/` | `OnboardingScreen` steps: `DetailsStep`, `GoalsStep`, `UnitInput` | `onboardingPlan.ts`: step copy, activity levels, calorie/macro recommendation |
| `profile/` | Profile sheet sub-views and goal editors | `settings/` holds the sections of `ProfileSettingsView` |
| `share/` | Workout sharing: `ShareModal`, the share card `WorkoutOverlay`, `StoryCropModal` | `WorkoutOverlay` is also rendered by the workout summary |
| `ui/` | Shared primitives: `Sheet`, `Overlay`, `Portal` | `SheetWrapper.tsx` sits at `components/` root |
| `workout-sheet/` | Active workout sheet, sets, rest timer, finish flow | Also `WorkoutSummaryModal` (post-workout/history summary; its pieces live in `summary/`), `ExercisePicker` (used by routines too; pieces in `exercise-picker/`), `GhostFinishScreen` (a component, not a route); `SetRow` (swipe shell; inputs and styles in `workout-sheet/set-row/`), `ExerciseHistoryModal` (pieces in `workout-sheet/exercise-history/`); set-type badge letters and colours in `setTypeStyle.ts` |
| `workouts/` | Workouts tab: recovery body map, routines, today's plan | `ExerciseRow.tsx` exports a component named `ExerciseCard`. `history/` holds the pieces of `WorkoutHistoryScreen` (history sheet, routine preview, recovery chips, training calendar); `create-program/` and `program-day-editor/` hold pieces of those two screens. |

## Entry points
- `package.json` `main` → `index.ts` → `App.tsx`.
- `App.tsx`: loads fonts and theme. If a force update is required, it shows only `ForceUpdateScreen` (checked before auth, so it blocks login too). Otherwise it mounts `PortalHost` and gates on auth: `AuthNavigator` (no session) → `WelcomeSplashScreen` → `OnboardingScreen` (profile incomplete) → `TabNavigator`. `ChangelogModal`, `BetaWelcomeModal` and `WorkoutFinishFeedbackPrompt` are mounted next to `TabNavigator` only.
- `src/navigation/TabNavigator.tsx`: the five tabs, with names that differ from their screens:

  | Tab | Screen / component |
  |---|---|
  | Recovery | `screens/LaboratoryScreen.tsx` (+ `components/lab/`) |
  | Workouts | `navigation/WorkoutsNavigator.tsx` |
  | Home | `screens/HomeScreen.tsx` (+ `components/home/`) |
  | Nutrition | `screens/FoodLoggerScreen.tsx` (+ `components/food/`) |
  | Community | `screens/FriendsScreen.tsx` (+ `components/friends/`, `home/Feed.tsx`) |

  It also mounts the global `Header`, `ActiveWorkoutSheet`, `FloatingWorkoutBanner`, `WorkoutSummaryModal`, `GhostFinishScreen` and `ProfileScreen` inside a `Sheet`.
- `src/navigation/WorkoutsNavigator.tsx`: the base layer is `WorkoutHistoryScreen` (recovery body map + today's plan), shown or hidden through `navigationBridge`. The route `StartWorkout` renders nothing but is load-bearing: on mount it registers the workouts nav ref, and on each focus it shows the recovery overlay. Don't delete it. The plans screen is the route **`Plans`** → `PlansScreen`. Other routes: `CreateRoutine`, `RoutineSummary`, `CreateProgram`, `ProgramSummary`, `ProgramDayEditor`, `ProgramProgress`.

## How the pieces connect
- **Usual flow:** screen → feature components → Zustand store (`src/stores/`) → `supabase` client (`src/lib/supabase.ts`) → Postgres (with RLS). Social data mostly goes store → `src/lib/friendsDatabase.ts` → Supabase; `friends/NotificationList` calls `friendsDatabase` directly, and the finished-workout feed post (`activity_feed`) is written by `useActiveWorkoutStore` and the workout-summary edit-save (`workout-sheet/summary/useSummaryEdit`).
- **Exceptions:** some screens, components and hooks call Supabase, edge functions or external APIs directly: `hooks/useForceUpdate` (`app_config`), `hooks/useUsernameAvailability` (`username_or_email_taken`, for Sign Up and Onboarding), `food/MacroLensModal`, `food/AddFoodModal` (feature flag) and `food/useAiFoodSearch` (AI cache, Deep Search), `food/create-meal/useLogMeal`, `lab/useAiCoachChat` (AI coach chat), `workout-sheet/CoachTakeCard`, `workout-sheet/exercise-picker/useWgerSearch` (wger API), `workout-sheet/summary/useSummaryEdit` (edit-save), `workout-sheet/exercise-history/useExerciseHistory`.
- **Active workout:** `components/workout-sheet/*` → `useActiveWorkoutStore` (AsyncStorage while active) → on finish, `utils/workoutPayload.ts` builds the payload → one `upsert_workout` RPC. It also drives `services/liveActivityManager.ts` → `modules/workout-live-activity`. History is read through `useWorkoutStore`.
- **Notifications:** `services/notificationService.ts` opens a Realtime channel on the `notifications` table. It is started by `screens/FriendsScreen.tsx` when the Community tab is focused (only if the user has friends) and closed again on blur, so it isn't always on. It is also cleaned up on sign-out (`useAuthStore`). The 5-minute fallback poll only runs while it is started and the Realtime channel is down. Push-token registration is separate and runs for the whole session: `initPushToken` from `TabNavigator` (asks for permission once per session, re-checks on foreground), `stopPushToken` and `clearPushTokenForSignOut` from `useAuthStore` on sign-out. Push tokens are stored on `profiles`.
- **Navigation from outside navigators:** `src/lib/navigationBridge.ts` (open profile sheet, recovery overlay, workouts nav ref).
- **Theme:** components call `useColors()`, `sw()/ms()/sh()` and `Fonts`; pure code uses `getThemeColors()`.

## Load-bearing / shared code
Changes here ripple widely, so check all references (LSP) before editing.

| Module | Imported by |
|---|---|
| `src/theme/useColors.ts`, `src/theme/responsive.ts` | ~165 files each |
| `src/theme/typography.ts` | ~145 files |
| `src/stores/useAuthStore.ts` | ~60 files |
| `src/stores/useWorkoutStore.ts` | ~40 files |
| `src/lib/supabase.ts` | ~35 files |
| `src/stores/useActiveWorkoutStore.ts` | ~35 files; saves workouts, ~700 lines (types, constants, exercise actions and finish helpers in `stores/activeWorkout/`; import them through the store file). Older app builds write workouts differently, so see the Compatibility rule in `CLAUDE.md` |
| `src/lib/friendsDatabase.ts` (code in `src/lib/friends/`) | ~19 files; most social reads/writes. Import from `friendsDatabase`, not from `lib/friends/*` directly |
| `src/utils/localDate.ts` | ~14 files; day boundaries |
| `src/constants/muscles.ts` | ~12 files; legacy muscle names that every app build understands |

### Hidden links (LSP can't see these)
Connections through strings, `getState()`, SQL or the database itself. Changing one side compiles fine and fails silently, so when you touch either side, check the other by text search. `npm run check:links` checks the ones that can be checked mechanically, and `npm run check:links -- --touched` lists the rows a branch touches (used for the PR-time map refresh in `.claude/rules/navigation.md`).

| Link | Both ends | Breaks if only one side changes |
|---|---|---|
| Food goals → nutrition store | `stores/useFoodLogStore.ts` writes goal fields into `useNutritionStore` via `setState` | Renamed field is ignored (no type error); Home goals go stale |
| Cross-store calls and sign-out reset | `stores/useActiveWorkoutStore.ts`, `stores/activeWorkout/finishHelpers.ts`, `stores/activeWorkout/exerciseActions.ts`, `stores/useRankStore.ts`, `stores/useFoodLogStore.ts` call other stores' `getState()`; `stores/useAuthStore.ts` calls `useWorkoutStore.clearCaches`, `useActiveWorkoutStore.resetForSignOut` and (through `resetFoodStores`) the `resetForSignOut` of the food, nutrition, saved-meal, favourite, nutrient-goal, supplement and protein powder stores on sign-out, account switch and account deletion; per-account local data uses `lib/userScopedStorage.ts` | A new store with per-user data needs its own reset called there, or it leaks into the next account |
| Workout save payload ↔ `upsert_workout` | `utils/workoutPayload.ts` (keys), callers in `stores/useActiveWorkoutStore.ts` and `components/workout-sheet/summary/useSummaryEdit.ts`; SQL `supabase/migrations/20261119_upsert_workout_rpc.sql` reads `p->>'key'` | Renamed key is saved as null with no error; a new mode or cast must change on both sides |
| Old vs new workout shapes | Old builds insert `workouts` → `exercises` → `sets` directly; readers in `stores/useWorkoutStore.ts` and `lib/friends/feed.ts` | A reader that assumes new nullable columns (`started_at`, `completed_at`, …) are set breaks on old-build workouts; see Compatibility rule in `CLAUDE.md` |
| `exercises_link_identity` trigger | `supabase/migrations/20261114_workout_tracking_fields.sql` (wrapped in `exception when others`) | Removing the guard can make old builds' workout inserts fail; renames need an `exercise_aliases` row |
| Webhooks on `profiles` / `notifications` | Triggers exist only in production (dashboard-made, **not** in `supabase/migrations`); `supabase/functions/send-push-notification/`, `supabase/functions/_shared/webhookAuth.ts`; client writes in `lib/friends/notifications.ts` (`notifications` insert) and `services/notificationService.ts` (`profiles.push_token` updates); cron inserts from `supabase/functions/ai-workout-notifications/` | Renaming a function, column or the webhook secret breaks pushes/Discord silently; every `notifications` insert sends a push |
| `navigationBridge` registrations | Set in `navigation/TabNavigator.tsx`, `navigation/WorkoutsNavigator.tsx`; called from `home/Header.tsx`, `workouts/TodayScheduled.tsx`, `screens/WorkoutHistoryScreen.tsx` | Callbacks are null until the owner mounts and callers use `?.`, so a missing registration does nothing |
| Route and tab name strings | Registered in `src/navigation/`; used in `navigate('…')` calls, `navigation/navigationRef.ts` (`globalNavigate`), `constants/changelog.ts` (CTA targets), and `TabNavigator`'s `TAB_ICONS` / `route.name === …` checks | A renamed route or tab breaks navigation, icons, long-press or badge with no type error |
| Main-lift names | `utils/strengthScore.ts` (`MAIN_LIFT_ASSIGNMENTS`), `workout-sheet/exercise-picker/pickerData.ts` (`LEADERBOARD_LIFTS`), latest `get_community_leaderboard` in `supabase/migrations/20261120_leaderboard_plausible_bodyweight.sql` (name lists) | Renaming a main lift drops users off the Big Three boards unless the old name stays in every list |
| `user_ranks` → leaderboard triggers | `stores/useRankStore.ts` upserts `best_sets`; triggers in `supabase/migrations/20260719_leaderboard_overtake_notifications.sql` | Changing the `best_sets` shape breaks leaderboards and overtake notifications; errors are swallowed |
| Body-map id ↔ region rows | `MUSCLE_MAP_ID` in `constants/muscleMap.ts`; `lib/catalogDatabase.ts`, `stores/useRegionTargetsStore.ts`; `exercise_region_targets.map_id` rows | Bumping the map library without matching rows (or vice versa) gives an empty heat map |
| RPC names and storage keys | Client `.rpc('…')` calls in `lib/friends/` and `hooks/useUsernameAvailability.ts`; `username_or_email_taken` and `get_global_feed` exist only in production (no migration). AsyncStorage keys in about a dozen files, e.g. `utils/workoutStorage.ts` (in-progress workout), `stores/useThemeStore.ts`, `stores/useRegionTargetsStore.ts` (search for `AsyncStorage` before renaming a key) | Changed RPC params return an error the client swallows; a renamed storage key loses users' saved data (e.g. an in-progress workout) |

## Where to find X
| Task | Look in |
|---|---|
| Add or change a screen | `src/screens/` + wire it into `src/navigation/` |
| Change a tab or what a tab shows | `src/navigation/TabNavigator.tsx` |
| Workouts tab plans, routines, programs | `navigation/WorkoutsNavigator.tsx`, `screens/PlansScreen.tsx` (route `Plans`), `screens/*Routine*`, `screens/*Program*` |
| Active workout UI / logic | `components/workout-sheet/`, `stores/useActiveWorkoutStore.ts` |
| Post-workout summary / editing a past workout | `components/workout-sheet/WorkoutSummaryModal.tsx` (pieces in `components/workout-sheet/summary/`) |
| Workout history | `stores/useWorkoutStore.ts`, `screens/WorkoutHistoryScreen.tsx` (+ `components/workouts/history/`); a past workout opens in `workout-sheet/WorkoutSummaryModal` |
| Exercise catalog / picker | `components/workout-sheet/ExercisePicker.tsx`, `lib/catalogDatabase.ts`, `utils/exerciseCatalog.ts` |
| Body map, muscle heat, recovery | `components/body/`, `utils/muscleVolume.ts`, `utils/muscleLoad.ts`, `constants/muscleMap.ts`, `stores/useRegionTargetsStore.ts` |
| Strength score, ranks | `utils/strengthScore.ts`, `stores/useRankStore.ts` |
| Food logging, macros, AI food scan | `components/food/`, `stores/useFoodLogStore.ts`, `stores/useNutritionStore.ts`, `stores/useNutrientGoalStore.ts` |
| Barcode lookup | `utils/barcodeApi.ts` |
| Shared formatting and compare helpers | `src/utils/` (`formatDuration`, `formatVolume`, `dateLabels`, `ghostCompare`, `ema`, `smoothPath`, `planExercise`, `feedExerciseDetails`); local copies of `formatDuration` and `compareGhostSet` also exist, so use LSP, not grep |
| Water, creatine, supplements | `stores/useSupplementStore.ts`, `components/home/SupplementsCard.tsx` (+ `components/home/SupplementDetailModal.tsx`), `components/home/WaterCard.tsx`; protein powder (`PROTEIN_POWDER_KEY` supplement): `stores/useProteinPowderStore.ts`, `components/home/ProteinPowderModal.tsx` (picker, also opened from the diary's `food/HydrationStrip.tsx`), `components/profile/settings/ProteinPowderManager.tsx` |
| Weight, body fat, measurements | `components/lab/` (shared chart, history and log pieces in `components/lab/trend/`), `stores/useWeightStore.ts`, `stores/useBodyFatStore.ts`, `stores/useMeasurementStore.ts` |
| Feed, friends, leaderboard, reactions | `components/friends/`, `components/home/Feed.tsx`, `stores/useFriendsStore.ts`, `lib/friendsDatabase.ts` |
| Global header | `components/home/Header.tsx` |
| Profile, settings | `screens/ProfileScreen.tsx`, `components/profile/`, `stores/useProfileSettingsStore.ts` |
| Share images | `components/share/` |
| Theme colours, sizing, fonts | `src/theme/` |
| Changelog entry | `src/constants/changelog.ts` |
| Env vars | `.env` (not in git; `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), read in `src/lib/supabase.ts`, and also directly by `food/useAiFoodSearch` (Deep Search), `food/MacroLensModal` and `lab/useAiCoachChat` for raw `fetch` calls to edge functions |
| App/native config | `app.config.ts` (native changes need a store build) |
| Database tables / columns | `database-schema.md` (changes go through bevan) |
| Edge functions | `supabase/functions/<name>/` (Deno; changes go through bevan) |
| Tests | None. Checks are `npx tsc --noEmit` (with `noUnusedLocals` on, so unused variables and imports are errors) plus testing on a phone |
| Unused code (files, exports, packages) | `npm run knip` (config in `knip.json`; runs Knip through `npx`, not installed in the project). It exits with code 1 whenever it finds something. Every feature and fix runs it before the PR (see "No new unused code" in `.claude/rules/navigation.md`); for clearing out older unused code, its results are candidates, not proof (see the cleanup rule there). `react-native-svg` is reported unused and is, but removing a native package needs a store build, not an OTA |

## Known baseline type errors
After the 2026-11 codebase cleanup, `npx tsc --noEmit` reports **1 error in this 1 file** (it was 24 in 11 before; the Nutrition tab redesign fixed the food ones). Run it before you start to see the current list. Errors that were there before your change aren't caused by your edit. Don't fix them as part of other work: flag them and ask (see `CLAUDE.md`, Existing bugs). `noUnusedLocals` and `noUnusedParameters` are on, so unused variables and parameters are errors (prefix a deliberately unused parameter with `_`).
`app.config.ts` (`android.minSdkVersion` isn't an Expo config key, so it's ignored: fixing it properly needs `expo-build-properties` and a native build).

## Ignore
Don't read or edit:
- `node_modules/`, `.expo/`, `ios/`, `android/`, `dist/` (dependencies and generated output)
- `package-lock.json` (only through `npm install`)
- `src/constants/buildInfo.ts` (written by `scripts/stamp-build.js`)

Treat with care:
- `supabase/functions/` is Deno code outside the app's `tsconfig`, so TypeScript/LSP errors there ("cannot find module", `Deno` undefined) are false.
- `docs/` is historical, so verify against the code before trusting it.

## Maintenance
Update this file in the same change whenever folders or modules are added, moved, renamed or deleted, a tab or route changes, or anything else described here stops being true. Then run `npm run check:map` (checks every path here still exists, and that the screen/store/table counts here and in `CLAUDE.md`/`AGENTS.md` match the code). If a Hidden links row changed, also run `npm run check:links`. Then update the **Last verified** line at the top to today's date and the commit on `main` you checked against (`git rev-parse --short origin/main` after syncing). Use a `main` commit, not a branch commit, because branch commits can disappear when a PR is squash-merged.
