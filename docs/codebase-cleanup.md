# Codebase cleanup (branch `tv/chore/codebase-cleanup`)

Goal: remove unused code, fix known bugs, split oversized files and fix measured performance problems, without changing what users see (except the bug fixes).
Delete this file once the branch is merged.

## Phases
| # | Phase | Status |
|---|---|---|
| 0 | Baseline + phone smoke checklist | done |
| 2 | Fix known bugs | in progress |
| 1 | Remove unused code (Knip + ignored props) | todo |
| 3 | Split oversized files (no behaviour change) | todo |
| 4 | Performance audit, fix top findings (judge on a release build) | todo |
| 5 | Turn on `noUnusedLocals` / `noUnusedParameters` | todo |

## Baseline (main @ `5b879bc`, 2026-11-14)
- `npx tsc --noEmit`: **24 errors in 11 files** (same list as `CODEBASE_MAP.md`).
- `npm run knip`: 1 unused file, 2 unused dependencies, 2 unused devDependencies, 10 unused exports, 14 unused exported types.
- iOS dev bundle: builds (index.ts, ~16.4 MB unminified).
- Source: 179 files / ~60k lines under `src/`. Largest: `WorkoutSummaryModal.tsx` 2661, `WorkoutHistoryScreen.tsx` 1791, `useActiveWorkoutStore.ts` 1612, `MacroLensModal.tsx` 1488, `Feed.tsx` 1238.

## Phone smoke checklist (iPhone 14, dev build)
Run after every phase. Android, iPad and other screen sizes can't be tested here: ask bevan to check them before merging.
1. Cold start: app opens, Home loads, no red screen.
2. Tabs: swipe/tap through Recovery, Workouts, Home, Nutrition, Community.
3. Workout: start an empty workout, add an exercise, log 2 sets, run the rest timer, finish, check it in history, open its detail.
4. Nutrition: add a food (search), edit its quantity, delete it; add water.
5. Community: feed scrolls, open a friend's workout, notifications list opens.
6. Profile: long-press Home, open settings, change accent, close.
7. Recovery: body map shows heat, tap a muscle.
