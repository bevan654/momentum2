# Codebase cleanup (branch `tv/chore/codebase-cleanup`)

Goal: remove unused code, fix known bugs, split oversized files and fix measured performance problems, without changing what users see (except the bug fixes).
Delete this file once the branch is merged.

## Phases
| # | Phase | Status |
|---|---|---|
| 0 | Baseline + phone smoke checklist | done |
| 2 | Fix known bugs | done (needs phone test) |
| 1 | Remove unused code (Knip + ignored props) | done (needs phone test) |
| 3 | Split oversized files (no behaviour change) | in progress: `WorkoutSummaryModal` done (2659 → 691 + 8 files in `workout-sheet/summary/`) |
| 4 | Performance audit, fix top findings (judge on a release build) | todo |
| 5 | Turn on `noUnusedLocals` / `noUnusedParameters` | todo |

## Baseline (main @ `5b879bc`, 2026-11-14)
- `npx tsc --noEmit`: **24 errors in 11 files** (same list as `CODEBASE_MAP.md`).
- `npm run knip`: 1 unused file, 2 unused dependencies, 2 unused devDependencies, 10 unused exports, 14 unused exported types.
- iOS dev bundle: builds (index.ts, ~16.4 MB unminified).
- Source: 179 files / ~60k lines under `src/`. Largest: `WorkoutSummaryModal.tsx` 2661, `WorkoutHistoryScreen.tsx` 1791, `useActiveWorkoutStore.ts` 1612, `MacroLensModal.tsx` 1488, `Feed.tsx` 1238.

## Phase 2: bugs fixed
1. **Push notifications never registered for users with no friends.** The token was only registered from the Community tab's live-updates setup, which is skipped with 0 friends and torn down on blur. Now `initPushToken` runs once per session from `TabNavigator` (and refreshes on foreground); `stopPushToken` on sign-out / delete. The Realtime channel stays lazy (Community focus only). Side effect: the iOS "Allow notifications?" prompt now appears shortly after login instead of on first Community visit.
2. **Meal-group cards in Nutrition were unstyled** (5 missing style keys in `MealSection.tsx`: emoji, kcal pill, spacer, edit button). Added them.
3. **AiHeroCard "tap" text used `Fonts.semibold`** (undefined → system font). Fixed to `semiBold`.
4. **Fake demo notes** for dumbbell row / face pull shipped as the default note history in `useWorkoutStore`, shown until the real fetch finished (or forever offline). Removed.
5. **`freezeOnBlur` on the tab navigator was invalid** (material-top-tabs doesn't support it, so it was silently ignored). Removed the dead option, no behaviour change. Real fix is in Phase 4 below.

Type errors: 24 → 17.

Not bugs after checking: `WorkoutSummaryModal` `saving` prop (the edit footer already disables while saving) → Phase 1 dead prop.

## Phase 1: removed
- `WorkoutsTab.mockup.jsx`, `ramda`, `@types/ramda`.
- `export` dropped from 10 helpers + 14 types used only in their own file.
- Dead props: `HistoricalPage.saving`, `EntryCard.onEdit` (+ `onEditEntry` chain to `FoodLoggerScreen`), `Header.activeTab` (+ the `activeTab` state and `BottomTabBar.onTabChange` effect in `TabNavigator`), workout-sheet `ExerciseCard.totalExercises`, `RoutinePreviewOverlay.catalogMap`, `WeightHistoryModal` `SwipeableRow.colors`.
- Kept: `react-native-svg` (removal needs a store build: do it with the next native release), `@expo/prebuild-config` (installed by expo anyway; no gain).
- Knip after: only those two remain.
- Still pending: `ExerciseRow` move up/down props (waiting on the reorder decision).
- Noticed: `WeightHistoryModal.tsx` and `ExerciseRow.tsx` hardcode `#fff` on the swipe-delete icon/text (theme rule).

## Open questions / for bevan
- Routine + program-day editors pass move up/down to `ExerciseRow`, but the buttons were removed in `cae9aae` (March redesign). Restore reorder or delete the props? (ask tv)
- `CLAUDE.md` says `initNotifications` runs in `TabNavigator`; it actually runs from `FriendsScreen` on focus. bevan's file: tell him.

## Phase 3 notes
- Split order (largest/lowest risk first, `useActiveWorkoutStore` last): `WorkoutSummaryModal` ✅, `WorkoutHistoryScreen` ✅ (1789 → 387 + 5 files in `workouts/history/`, 61 dead styles dropped), `MacroLensModal`, `Feed`, `friendsDatabase`, `CreateMealModal`, `FoodDetailModal`, `ExercisePicker`, `AddFoodModal`, `ProfileSettingsView`, then the 650–950 line files, `useActiveWorkoutStore` last.
- Found in `WorkoutHistoryScreen` (left as is): history list is a plain ScrollView + map (not virtualised, unbounded); `calDotSelected` hardcodes `#3B82F6`; the muscle-matching loop is copy-pasted 3 times; both sheets duplicate the swipe-dismiss code.
- Found in `WorkoutSummaryModal` (left as is): the historical "crossfade" animates two shared values nothing reads, so closing just waits ~350 ms; `workoutName` state never set; `totalVolume` ternary returns the same value both ways.

## Phase 4 candidates (found along the way)
- All 5 tabs stay mounted and re-render in the background (no freeze). Option: `react-freeze` on tabs more than one away from the current one (neighbours must stay live for swipe).
- `TabNavigator.tsx` imports RN `Animated` (convention says Reanimated only).

## Phone smoke checklist (iPhone 14, dev build)
Run after every phase. Android, iPad and other screen sizes can't be tested here: ask bevan to check them before merging.
1. Cold start: app opens, Home loads, no red screen.
2. Tabs: swipe/tap through Recovery, Workouts, Home, Nutrition, Community.
3. Workout: start an empty workout, add an exercise, log 2 sets, run the rest timer, finish, check it in history, open its detail.
4. Nutrition: add a food (search), edit its quantity, delete it; add water.
5. Community: feed scrolls, open a friend's workout, notifications list opens.
6. Profile: long-press Home, open settings, change accent, close.
7. Recovery: body map shows heat, tap a muscle.
