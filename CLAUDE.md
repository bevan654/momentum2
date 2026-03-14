# Momentum 2.0 — Claude Code / Claude Flow Context

A React Native fitness super-app for iOS + Android. Dark mode default, portrait-only, tablet-supported.
Target users: intermediate-to-advanced lifters who care about progressive overload, macros, and training data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | React Native 0.81.5 + Expo SDK 54, New Architecture (Fabric + TurboModules), Hermes |
| Language | TypeScript 5.9 (strict mode) |
| Navigation | React Navigation 7 (native-stack, bottom-tabs, material-top-tabs) |
| State | Zustand 5 (17 stores) |
| Animations | React Native Reanimated 4.1 (UI-thread worklets only — never RN Animated) |
| Graphics | @shopify/react-native-skia 2.2 (rings, arcs, gradients, glows) |
| Gestures | React Native Gesture Handler 2.28 |
| Lists | @shopify/flash-list 2.0 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) — no custom server, no GraphQL |
| Auth | Supabase Auth + expo-secure-store for token persistence |
| Realtime | Supabase Realtime (Presence channel + postgres_changes) |
| Push | expo-notifications + Supabase push token storage |
| Barcode | Open Food Facts (primary) → USDA FoodData Central (fallback) |
| Fonts | Inter (400–800 weights via @expo-google-fonts) |
| Build | EAS Build (dev/preview/production profiles) |

---

## Project Structure

```
/
├── App.tsx                    # Root: font loading, auth gate, nav setup
├── app.config.ts              # Expo config (bundle IDs, plugins, EAS)
├── database-schema.md         # Full Postgres schema reference
├── exercises_catalog.csv/sql  # 10K+ exercise seed data
│
└── src/
    ├── screens/               # 14 screen-level components
    ├── components/
    │   ├── body/              # Muscle body map SVG
    │   ├── BodyHighlighter/   # Male/female SVG wrapper
    │   ├── food/              # Nutrition modals, meal sections, macro cards
    │   ├── friends/           # Feed, leaderboard, notifications, nudges
    │   ├── home/              # Dashboard widgets: nutrition ring, water, creatine, calendar
    │   ├── lab/               # Analytics: recovery timers, volume charts, muscle analysis
    │   ├── plus-menu/         # FAB action sheet
    │   ├── profile/           # Settings, accent color, meal config, import
    │   ├── widget-grid/       # Draggable/resizable home widget system
    │   ├── workouts/          # Workout history cards, exercise rows, rank badges
    │   └── workout-sheet/     # Active workout: bottom sheet, sets, rest timer, confetti
    ├── stores/                # 17 Zustand stores (see State Management section)
    ├── navigation/            # AuthNavigator, TabNavigator, WorkoutsNavigator
    ├── services/              # importService, notificationService, liveActivityManager, presenceManager
    ├── lib/                   # supabase.ts, friendsDatabase.ts
    ├── theme/                 # colors.ts, useColors.ts, responsive.ts, typography.ts
    ├── utils/                 # barcodeApi, muscleVolume, streakCalculator, strengthScore, workoutStorage
    ├── hooks/                 # useAppUpdates.ts (EAS OTA)
    ├── constants/             # buildInfo, changelog, muscleGroups
    └── types/                 # widget.ts type definitions
```

---

## Coding Patterns & Conventions

### Responsive Sizing (MANDATORY)
- Use `sw()` (width-scale), `ms()` (moderate-scale), `sh()` (height-scale) from `src/theme/responsive.ts`
- Base device: iPhone 14 Pro (393×852)
- Never hardcode pixel dimensions for layout
- All UI must work on small phones, large phones, and tablets

### Typography
- Always use `fontFamily` (Inter weight variants) — **never** use `fontWeight`
- Inter weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold)

### Colors & Theming
- Always use `useColors()` hook inside components to get theme-aware colors
- For pure functions: use `getThemeColors(mode, accent)` (has module-level cache)
- 12 accent colors available; never hardcode hex values — always reference theme tokens

### Component Structure
- Feature-based folders under `components/`
- Wrap components in `React.memo`
- Styles via `useMemo` inside the component (not StyleSheet.create at module level unless static)
- Extract heavy sub-components to their own files

### Animations
- **Always** use Reanimated: `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`
- **Never** use React Native's built-in `Animated` API — use Reanimated only
- All animations must run on the UI thread via worklets

### Graphics
- Use Skia (`@shopify/react-native-skia`) for rings, arcs, gradients, glows
- Prefer Skia over react-native-svg for performance-critical visuals

### State / Store Patterns
- Store naming: `use[Domain]Store`
- Optimistic updates with rollback for critical operations (food, supplements, widgets)
- Fire-and-forget for non-critical writes (activity feed, streak persist)
- Debounced persistence: widgets (300ms), theme (100ms)
- TTL caching: friends (4h), exercise catalog (24h)
- Cross-store sync where needed (food goals ↔ nutrition store)

### Supabase Query Pattern
```typescript
// Read
const { data } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Write
await supabase.from('table_name').insert({ ...payload });

// Realtime
supabase.channel('channel-name')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, handler)
  .subscribe();
```

### Error Handling
- Services: silent `try/catch` — swallow errors internally
- Only surface errors to the user when they directly affect UX
- Log errors to console in dev; no crash reporting configured yet

### File Naming
- Components: `PascalCase.tsx`
- Stores, utils, services, hooks: `camelCase.ts`
- Store files: `use[Domain]Store.ts`

### Performance Rules
- Never block the JS thread
- Use `freezeOnBlur` on tab screens where applicable
- Test performance in release builds only (Hermes + New Architecture)
- Use FlashList for any list with more than ~20 items

### Library-First Policy
Do NOT build custom solutions when a proven library exists. Prefer:
Reanimated → Gesture Handler → FlashList → Skia → Zustand
Custom implementations only when a proven performance bottleneck exists.

---

## State Management — 17 Zustand Stores

| Store | Persistence | Responsibility |
|---|---|---|
| `useAuthStore` | Supabase Auth | Login/signup/session, profile CRUD |
| `useActiveWorkoutStore` | AsyncStorage + Supabase | Active workout state, sets, rest timer, finish → DB write |
| `useWorkoutStore` | Supabase + AsyncStorage (24h) | Workout history, exercise catalog cache, previous set data |
| `useFoodLogStore` | Supabase | Food entries CRUD, meal configs, goals, catalog search |
| `useNutritionStore` | Supabase | Daily nutrition aggregation, goals (synced with food store) |
| `useSupplementStore` | Supabase | Water + creatine entries/goals (optimistic updates) |
| `useWeightStore` | Supabase | Weight entries, EMA trend calculation |
| `useRoutineStore` | Supabase | Saved routines with exercises |
| `useRankStore` | Supabase (cached) | Strength scoring, e1RM, per-muscle/overall ranks |
| `useStreakStore` | Computed + fire-and-forget | Streak calculation from workout dates |
| `useFriendsStore` | Supabase (4h cache) | Friends, feed, leaderboard, notifications (paginated) |
| `useMuscleAnalysisStore` | Pure computation | Weekly muscle volume from workout data |
| `useWidgetStore` | AsyncStorage | Widget grid layout, positions, sizes (debounced 300ms) |
| `useThemeStore` | AsyncStorage | Accent color + dark/light mode (debounced 100ms) |
| `useProfileSettingsStore` | AsyncStorage | Local UI preferences |
| `useChangelogStore` | AsyncStorage | Last-seen changelog version |
| `useImportStore` | Supabase (bulk) | Multi-phase workout import from CSV/TSV |

---

## Database — 21 Tables

### Workout
`workouts` · `exercises` · `sets` · `exercises_catalog` · `user_exercises` · `routines` · `routine_exercises` · `user_streaks`

### Nutrition
`food_entries` · `food_catalog` · `user_created_foods` · `barcode_foods` · `nutrition_goals` · `meal_config` · `supplement_goals` · `supplement_entries` · `weight_entries`

### Social
`friendships` · `activity_feed` · `reactions` · `leaderboard_entries` · `nudges` · `notifications`

Key columns to know:
- `food_entries`: includes `macros`, `14 micronutrients`, `meal_type`, `quantity`, `is_planned`
- `sets`: `kg`, `reps`, `set_type` (working/warmup/drop/failure), `parent` (for drop sets)
- `profiles`: `username`, `height`, `age`, `gender`, `push_token`, privacy flags
- `exercises_catalog`: `muscles`, `equipment`, `difficulty`, `slug`

---

## Current Work In Progress

The following are actively being modified — be careful not to regress these:

1. **NutritionHero.tsx** — New Skia semicircular calorie gauge (untracked, not yet wired up)
2. **HomeScreen** — Mid-refactor: new greeting layout, action cards, reorganized widgets
3. **Header.tsx** — Stripped down; greeting/avatar moved to HomeScreen
4. **NutritionCard.tsx** — Migrating from react-native-svg → Skia arcs with sweep gradients
5. **Food module** — AddFoodModal simplified, MealSection rebuilt with timeline/drag UX
6. **DateNavigator** — Rebuilt as week-based date carousel
7. **Theme/colors** — Extended palette with accent tinting system

---

## Known Technical Debt

| Issue | Priority | Notes |
|---|---|---|
| No automated tests | HIGH | Zero test files, no test runner configured |
| No CI/CD | MEDIUM | Manual EAS builds only |
| No offline support | MEDIUM | All fetches require network |
| USDA DEMO_KEY | LOW | Rate-limited; fine for now, needs real key for production |
| user_ranks table undocumented | LOW | Used in useRankStore but missing from database-schema.md |
| DevContentScreen in prod | LOW | Triple-tap on food logger title opens debug screen |

---

## External APIs

```
# Barcode lookup (primary)
GET https://world.openfoodfacts.org/api/v2/product/{barcode}

# USDA fallback (rate-limited DEMO_KEY — do not increase usage)
GET https://api.nal.usda.gov/fdc/v1/foods/search
```

---

## Pre-Commit Checklist

- Before committing, **always ask the user** if the changes should include a patch notes entry in `src/constants/changelog.ts`
- If the user confirms, add a new entry at the top of the `changelog` array with the next version number, today's date, and a summary of user-facing changes
- Do not add patch notes for purely internal changes (refactors, dev tooling) unless the user requests it

---

## What NOT to Do

- Do not use `React.Animated` — use Reanimated only
- Do not use `react-native-svg` for new graphics — use Skia
- Do not hardcode hex colors — use `useColors()` hook
- Do not use `fontWeight` — use `fontFamily` with correct Inter variant
- Do not build list components from scratch — use FlashList
- Do not write raw fetch calls to Supabase — use the `supabase` client from `src/lib/supabase.ts`
- Do not add new screens without wiring them into the appropriate navigator in `src/navigation/`