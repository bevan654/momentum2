# Momentum 2.0 — Codex Context

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
| Navigation | React Navigation 7 — `native-stack`, `material-top-tabs` (used as bottom bar with custom UI) |
| State | Zustand 5 (23 stores) |
| Animations | Reanimated 4.1 + react-native-worklets — UI-thread only. Never RN `Animated`. |
| Graphics | @shopify/react-native-skia 2.2 for performance-critical visuals; react-native-svg 15.12 still used in legacy components |
| Gestures | React Native Gesture Handler 2.28 |
| Lists | @shopify/flash-list 2.0 |
| Backend | Supabase (Postgres + Auth + Realtime + Storage). No custom server, no GraphQL. |
| Auth | Supabase Auth + expo-secure-store for token persistence |
| Realtime | Supabase Realtime (`postgres_changes` only — presence is not used) |
| Push | expo-notifications + push token stored on `profiles` |
| Analytics | None wired up |
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
├── docs/                      # Plans, audits, security review
├── scripts/                   # Dev/ops scripts (build stamping, imports, seeding, notifications)
│
└── src/
    ├── screens/               # Top-level routes (22 screens)
    ├── components/
    │   ├── auth/              # SocialAuthButtons (Google / Apple OAuth)
    │   ├── body/              # Muscle body map (heatmap, mini map)
    │   ├── BodyHighlighter/   # Vendored male/female SVG body highlighter (no npm dependency)
    │   ├── dev/               # Story/Workout share overlays, story crop
    │   ├── food/              # Nutrition modals, meal sections, hero gauge, water/supplements
    │   ├── friends/           # Feed, leaderboard, notifications, nudges, comments, search
    │   ├── home/              # Home dashboard cards, feed and modals
    │   ├── lab/               # Recovery/analytics: timers, charts, body metrics, muscle radar
        │   ├── profile/           # Settings sub-views, goal editors
    │   ├── share/             # Share modal
        │   ├── workout-sheet/     # Active workout: bottom sheet, sets, rest timer, confetti, finish flow
    │   ├── workouts/          # Workout history cards, exercise rows, rank/routine cards
    │   └── SheetWrapper.tsx   # Shared modal-sheet chrome
    ├── stores/                # 23 Zustand stores (see State Management)
    ├── navigation/            # AuthNavigator, TabNavigator, WorkoutsNavigator, navigationRef
    ├── services/              # liveActivityManager, notificationService, workoutFinishFeedback
    ├── lib/                   # supabase, friendsDatabase, navigationBridge
    ├── theme/                 # useColors.ts, responsive.ts, typography.ts
    ├── utils/                 # barcodeApi, displayName, muscleVolume, streakCalculator, strengthScore, uploadWorkoutPhoto, workoutStorage
    ├── hooks/                 # useAppUpdates (EAS OTA), useForceUpdate (force-update gate)
    └── constants/             # buildInfo, changelog, muscles

supabase/
├── functions/                 # Edge functions: ai-coach, ai-workout-summary, ai-workout-notifications,
│                              #   gemini-food-scan, gemini-food-search, push-notification, delete-account, discord-*
├── migrations/                # Dated SQL migrations (YYYYMMDD_description.sql)
└── seed/                      # Exercise catalog seed data (exercises_catalog.csv / _full.sql)
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
- Skia for rings, arcs, gradients, glows. Prefer Skia over react-native-svg for new visuals; some legacy components still use SVG.

### State / Stores
- Naming: `use[Domain]Store`.
- Optimistic updates with rollback for critical writes (food, supplements).
- Fire-and-forget for non-critical (activity feed, streak persist).
- Debounced persistence: theme 100ms.
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

## State Management — 23 Zustand Stores

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
| `useThemeStore` | AsyncStorage (100ms debounce) | Accent + dark/light mode |
| `useProfileSettingsStore` | AsyncStorage | Local UI prefs |
| `useChangelogStore` | AsyncStorage | Last-seen changelog version |
| `useLabTimeRangeStore` | In-memory | Lab tab time-range filter |

---

## Services

| Service | Status | Notes |
|---|---|---|
| `notificationService` | Active — initialized in `TabNavigator` via `initNotifications(userId)` | Realtime channel `notif:${userId}` for `notifications` table. One persistent websocket per session. |
| `liveActivityManager` | iOS Live Activities for active workouts |

---

## Realtime / Connection Footprint

Per active session, expect roughly:
- **1 websocket** for `notificationService` (always-on while authenticated).
- **~2 PostgREST pool workers** on the `authenticator` role (kept warm).
- **1** transient auth/refresh connection.

Total resting ~4 connections per app instance. Pool ceiling on default Supabase compute is ~60 → realistic ceiling is ~12–15 concurrent users before hitting limits. Plan for: lazy Realtime subscribe-on-focus, channel merging, or compute upgrade when scaling.

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

**Tables referenced in code but missing from `database-schema.md`:** `user_ranks` (used by `useRankStore`), `programs` / program-related tables (used by `useProgramStore`).

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

### 3. Build on a branch
Then implement it, following the Git & GitHub Practices below.

---

## Git & GitHub Practices

Keep the repo clean and the history readable.

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

- `npx tsc --noEmit` introduces no new errors. (There is a pre-existing baseline of type errors, partly because `supabase/functions` Deno code is included in the app tsconfig.)
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
