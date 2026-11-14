# Codebase Map

**Last verified:** 2026-11-14, against the code at commit `5b879bc`.

An index of where things live and how they connect. Rules and conventions are in `CLAUDE.md`; database tables are in `database-schema.md`. If `CLAUDE.md`'s Project Structure tree disagrees with this map, this map is current.

## Overview
Momentum is a React Native fitness app (iOS + Android): workouts, nutrition, body metrics, recovery and a social feed.
Stack: Expo SDK 54, React Native 0.81 (New Architecture, Hermes), TypeScript (strict), Zustand stores, Reanimated + Skia, Supabase backend (Postgres, Auth, Realtime, Storage, Deno edge functions). Built and updated (OTA) with EAS.
Nearly all app code is TypeScript in `src/`. There is no path alias: imports are relative (`../../`).

## Directory map
| Path | What it holds |
|---|---|
| `index.ts`, `App.tsx` | App entry and root component (see Entry points) |
| `app.config.ts`, `eas.json` | Expo config (bundle ids, plugins, runtime version) and EAS build/update profiles |
| `src/screens/` | 20 route-level screens |
| `src/navigation/` | `AuthNavigator`, `TabNavigator` (the 5 tabs), `WorkoutsNavigator` (Workouts tab stack), `navigationRef` |
| `src/components/<feature>/` | UI per feature (table below) |
| `src/stores/` | 24 Zustand stores, `use[Domain]Store.ts`: app state and most Supabase reads/writes |
| `src/lib/` | Supabase client (`supabase.ts`), social DB calls (`friendsDatabase.ts`), catalog DB (`catalogDatabase.ts`), `navigationBridge.ts` |
| `src/services/` | Side-effect services: `notificationService` (Realtime), `liveActivityManager` (Lock Screen), `workoutFinishFeedback` |
| `src/utils/` | Helpers, mostly pure (dates, volume, strength score, payloads). Exceptions with side effects: `barcodeApi`, `uploadWorkoutPhoto`, `workoutStorage` (I/O), `confirmReplaceWorkout` (alerts + store writes) |
| `src/hooks/` | Shared hooks (OTA updates, force-update gate, muscle load, region weights) |
| `src/theme/` | `useColors.ts` (theme tokens), `responsive.ts` (`sw`/`ms`/`sh`), `typography.ts` (`Fonts`) |
| `src/constants/` | Static data: `muscles`, `muscleMap`, `muscleMapLabels`, `changelog`, `buildInfo` (auto-stamped, don't move) |
| `modules/workout-live-activity/` | Local native Expo module (Swift/Kotlin + `index.ts`): Live Activity / ongoing notification. Native: changes need a store build |
| `targets/workout-activity/` | iOS Live Activity widget (SwiftUI). Native: changes need a store build |
| `supabase/migrations/` | Dated SQL migrations. Database changes go through bevan |
| `supabase/functions/` | Deno edge functions (AI coach/summaries, Gemini food scan/search, push, Discord, delete-account) + `_shared/` |
| `scripts/` | Dev/ops scripts: `stamp-build.js` + `update.bat` (OTA release), `catalog/` (exercise catalog + region-target tooling), `check-codebase-map.js` (`npm run check:map`), one-off admin scripts |
| `.claude/` | Shared Claude Code setup: `agents/codebase-scout.md`, `rules/navigation.md`, `settings.json` (turns on the TypeScript LSP plugin). Everything else in it is personal and git-ignored. Anything added to `agents/` or `rules/` is shared with the whole team, so keep personal agents and rules in `~/.claude/` instead |
| `docs/` | Past plans, audits and the security review. Historical: may describe code that has since changed |
| `assets/` | `logo.png` (app icon, splash, share cards) |
| `database-schema.md` | Every public table and column (generated from the live schema) |

### `src/components/` folders
| Folder | Feature | Notes |
|---|---|---|
| `auth/` | Login/sign-up social buttons | |
| `body/` | Body map wrappers around `momentum-muscle-map` | `useBodyMap.ts` exports `useBodies`, `useMuscleMapColors` and other helpers, but no `useBodyMap` |
| `dev/` | **Production share UI**, not dev tools | `WorkoutOverlay` = share card, `StoryCropModal`; used by `share/` and the workout summary |
| `food/` | Nutrition tab: meals, add-food, barcode, AI scan, food detail | |
| `friends/` | Community tab: leaderboard, search, notifications, profiles, reports | `AvatarCircle`, `ReportSheet` are also used by other features |
| `home/` | Home tab cards (activity, nutrition, water, supplements) | Also holds app-wide pieces: `Header` (global header), `ChangelogModal`, `BetaWelcomeModal`, the Community `Feed` and `NutritionStories`, and weight modals used by `lab/WeightCard` |
| `lab/` | **Recovery tab** (screen is `LaboratoryScreen`): body metrics, charts, AI card | |
| `profile/` | Profile sheet sub-views and goal editors | |
| `share/` | `ShareModal` | |
| `ui/` | Shared primitives: `Sheet`, `Overlay`, `Portal` | `SheetWrapper.tsx` sits at `components/` root |
| `workout-sheet/` | Active workout sheet, sets, rest timer, finish flow | Also `WorkoutSummaryModal` (post-workout/history summary; its pieces live in `summary/`), `ExercisePicker` (used by routines too), `GhostFinishScreen` (a component, not a route) |
| `workouts/` | Workouts tab: recovery body map, routines, today's plan | `ExerciseRow.tsx` exports a component named `ExerciseCard`. |

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

  It also mounts the global `Header`, `ActiveWorkoutSheet`, `FloatingWorkoutBanner`, `WorkoutSummaryModal`, `GhostFinishScreen`, `FriendProfileModal`, and `ProfileScreen` inside a `Sheet`.
- `src/navigation/WorkoutsNavigator.tsx`: the base layer is `WorkoutHistoryScreen` (recovery body map + today's plan), shown or hidden through `navigationBridge`. The route `StartWorkout` renders nothing but is load-bearing: on mount it registers the workouts nav ref, and on each focus it shows the recovery overlay. Don't delete it. The plans screen is the route **`Plans`** → `StartWorkoutScreen`. Other routes: `CreateRoutine`, `RoutineSummary`, `CreateProgram`, `ProgramSummary`, `ProgramDayEditor`, `ProgramProgress`, `WorkoutDetail`.

## How the pieces connect
- **Usual flow:** screen → feature components → Zustand store (`src/stores/`) → `supabase` client (`src/lib/supabase.ts`) → Postgres (with RLS). Social data mostly goes store → `src/lib/friendsDatabase.ts` → Supabase; `friends/FriendProfileModal` and `friends/NotificationList` call `friendsDatabase` directly, and the finished-workout feed post (`activity_feed`) is written by `useActiveWorkoutStore` and the `WorkoutSummaryModal` edit-save.
- **Exceptions:** some screens, components and hooks call Supabase, edge functions or external APIs directly: `hooks/useForceUpdate` (`app_config`), `screens/OnboardingScreen`, `screens/SignUpScreen`, `food/MacroLensModal`, `food/AddFoodModal`, `food/CreateMealModal`, `lab/AiHeroCard`, `workout-sheet/CoachTakeCard`, `workout-sheet/ExercisePicker` (wger API), `workout-sheet/WorkoutSummaryModal` (edit-save), `workout-sheet/ExerciseHistoryModal`.
- **Active workout:** `components/workout-sheet/*` → `useActiveWorkoutStore` (AsyncStorage while active) → on finish, `utils/workoutPayload.ts` builds the payload → one `upsert_workout` RPC. It also drives `services/liveActivityManager.ts` → `modules/workout-live-activity`. History is read through `useWorkoutStore`.
- **Notifications:** `services/notificationService.ts` opens a Realtime channel on the `notifications` table. It is started by `screens/FriendsScreen.tsx` when the Community tab is focused (only if the user has friends) and closed again on blur, so it isn't always on. It is also cleaned up on sign-out (`useAuthStore`). Push-token registration only happens while it is started, and the 5-minute fallback poll only runs while it is started and the Realtime channel is down (`CLAUDE.md`'s Services and Connection Footprint sections are out of date here). Push tokens are stored on `profiles`.
- **Navigation from outside navigators:** `src/lib/navigationBridge.ts` (open profile sheet, recovery overlay, workouts nav ref).
- **Theme:** components call `useColors()`, `sw()/ms()/sh()` and `Fonts`; pure code uses `getThemeColors()`.

## Load-bearing / shared code
Changes here ripple widely, so check all references (LSP) before editing.

| Module | Imported by |
|---|---|
| `src/theme/useColors.ts`, `src/theme/responsive.ts` | ~106 files each |
| `src/theme/typography.ts` | ~100 files |
| `src/stores/useAuthStore.ts` | ~53 files |
| `src/stores/useWorkoutStore.ts` | ~31 files |
| `src/lib/supabase.ts` | ~27 files |
| `src/stores/useActiveWorkoutStore.ts` | ~26 files; saves workouts, 1.6k lines. Older app builds write workouts differently, so see the Compatibility rule in `CLAUDE.md` |
| `src/lib/friendsDatabase.ts` | ~13 files; most social reads/writes |
| `src/utils/localDate.ts` | ~13 files; day boundaries |
| `src/constants/muscles.ts` | ~9 files; legacy muscle names that every app build understands |

## Where to find X
| Task | Look in |
|---|---|
| Add or change a screen | `src/screens/` + wire it into `src/navigation/` |
| Change a tab or what a tab shows | `src/navigation/TabNavigator.tsx` |
| Workouts tab plans, routines, programs | `navigation/WorkoutsNavigator.tsx`, `screens/StartWorkoutScreen.tsx` (route `Plans`), `screens/*Routine*`, `screens/*Program*` |
| Active workout UI / logic | `components/workout-sheet/`, `stores/useActiveWorkoutStore.ts` |
| Post-workout summary / editing a past workout | `components/workout-sheet/WorkoutSummaryModal.tsx` (pieces in `components/workout-sheet/summary/`) |
| Workout history | `stores/useWorkoutStore.ts`, `screens/WorkoutHistoryScreen.tsx`, `screens/WorkoutDetailScreen.tsx` |
| Exercise catalog / picker | `components/workout-sheet/ExercisePicker.tsx`, `lib/catalogDatabase.ts`, `utils/exerciseCatalog.ts` |
| Body map, muscle heat, recovery | `components/body/`, `utils/muscleVolume.ts`, `utils/muscleLoad.ts`, `constants/muscleMap.ts`, `stores/useRegionTargetsStore.ts` |
| Strength score, ranks | `utils/strengthScore.ts`, `stores/useRankStore.ts` |
| Food logging, macros, AI food scan | `components/food/`, `stores/useFoodLogStore.ts`, `stores/useNutritionStore.ts`, `stores/useNutrientGoalStore.ts` |
| Barcode lookup | `utils/barcodeApi.ts` |
| Water, creatine, supplements | `stores/useSupplementStore.ts`, `components/home/SupplementsCard.tsx`, `components/home/WaterCard.tsx` |
| Weight, body fat, measurements | `components/lab/`, `stores/useWeightStore.ts`, `stores/useBodyFatStore.ts`, `stores/useMeasurementStore.ts` |
| Feed, friends, leaderboard, comments | `components/friends/`, `components/home/Feed.tsx`, `stores/useFriendsStore.ts`, `lib/friendsDatabase.ts` |
| Global header | `components/home/Header.tsx` |
| Profile, settings | `screens/ProfileScreen.tsx`, `components/profile/`, `stores/useProfileSettingsStore.ts` |
| Share images | `components/share/ShareModal.tsx`, `components/dev/` |
| Theme colours, sizing, fonts | `src/theme/` |
| Changelog entry | `src/constants/changelog.ts` |
| Env vars | `.env` (not in git; `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), read in `src/lib/supabase.ts`, and also directly by `food/AddFoodModal`, `food/MacroLensModal` and `lab/AiHeroCard` for raw `fetch` calls to edge functions |
| App/native config | `app.config.ts` (native changes need a store build) |
| Database tables / columns | `database-schema.md` (changes go through bevan) |
| Edge functions | `supabase/functions/<name>/` (Deno; changes go through bevan) |
| Tests | None. Checks are `npx tsc --noEmit` (with `noUnusedLocals` on, so unused variables and imports are errors) plus testing on a phone |
| Unused code (files, exports, packages) | `npm run knip` (config in `knip.json`; runs Knip through `npx`, not installed in the project). It exits with code 1 whenever it finds something. Every feature and fix runs it before the PR (see "No new unused code" in `.claude/rules/navigation.md`); for clearing out older unused code, its results are candidates, not proof (see the cleanup rule there). `react-native-svg` is reported unused and is, but removing a native package needs a store build, not an OTA |

## Known baseline type errors
As of commit `bb3ded2`, `npx tsc --noEmit` reported **24 errors in these 11 files**. Run it before you start to see the current list (some may have been fixed since). Errors that were there before your change aren't caused by your edit. Don't fix them as part of other work: flag them and ask (see `CLAUDE.md`, Existing bugs).
`app.config.ts`, `src/components/food/MealSection.tsx`, `src/components/food/AddFoodModal.tsx`, `src/components/friends/FriendSearch.tsx`, `src/components/friends/NotificationList.tsx`, `src/components/lab/AiHeroCard.tsx`, `src/components/workout-sheet/SetRow.tsx`, `src/navigation/TabNavigator.tsx`, `src/screens/FoodLoggerScreen.tsx`, `src/screens/ProgramProgressScreen.tsx`, `src/stores/useRankStore.ts`.

## Ignore
Don't read or edit:
- `node_modules/`, `.expo/`, `ios/`, `android/`, `dist/` (dependencies and generated output)
- `package-lock.json` (only through `npm install`)
- `src/constants/buildInfo.ts` (written by `scripts/stamp-build.js`)

Treat with care:
- `supabase/functions/` is Deno code outside the app's `tsconfig`, so TypeScript/LSP errors there ("cannot find module", `Deno` undefined) are false.
- `docs/` is historical, so verify against the code before trusting it.

## Maintenance
Update this file in the same change whenever folders or modules are added, moved, renamed or deleted, a tab or route changes, or anything else described here stops being true. Then run `npm run check:map` (checks every path here still exists) and update the **Last verified** line at the top to today's date and the commit on `main` you checked against (`git rev-parse --short origin/main` after syncing). Use a `main` commit, not a branch commit, because branch commits can disappear when a PR is squash-merged.
