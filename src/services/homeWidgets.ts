/**
 * Home screen widgets (iOS, 1.0.38+): keeps the data they show in the shared App Group.
 *
 * Widgets can't run the app's code, so this writes one JSON snapshot (shape: HomeWidgetData in
 * targets/workout-activity/HomeWidgetData.swift) whenever something they show changes: today's
 * nutrition and goals, the streak, the accent, sign-in. Writes are
 * debounced and skipped when nothing changed; native redraws the widgets only on a real change.
 * What changes with time alone (a new day, the streak counting up) the widgets work out from the
 * dates in the snapshot.
 *
 * Each section is written only from data that really loaded for the signed-in user (a store's
 * starting values, or a failed fetch offline, would show 0 kcal / a 0-day streak). Until a section has loaded this run, the one already on the
 * widgets is kept (read back at start, when it belongs to the same user). Plain module, no React state.
 */

import { Platform } from 'react-native';
import { getHomeWidgetData, setHomeWidgetData, supportsHomeWidgets } from '../../modules/workout-live-activity';
import { sumMacros, sumMicros } from '../components/food/dayTotals';
import { groupEntriesByMeal, OTHER_SLOT } from '../components/food/groupEntriesByMeal';
import { useAuthStore } from '../stores/useAuthStore';
import { useFoodLogStore, type FoodEntry } from '../stores/useFoodLogStore';
import { useNutrientGoalStore } from '../stores/useNutrientGoalStore';
import { useNutritionStore, type TodayFoodRow } from '../stores/useNutritionStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { PROTEIN_POWDER_KEY } from '../stores/useProteinPowderStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useThemeStore } from '../stores/useThemeStore';
import { toLocalDateString } from '../utils/localDate';

const WRITE_DELAY_MS = 1000;
/**
 * Which widgets show each part of the snapshot (their `kind` in targets/workout-activity, checked
 * by check:links), so a write redraws only the widgets whose part changed. Any other part changing
 * (sign-in, user, accent) redraws them all.
 */
const WIDGET_KINDS: Record<string, string[]> = {
  nutrition: ['MomentumMacros'],
  nutritionExtras: ['MomentumMacros'],
  streak: ['MomentumStreak'],
  supplements: ['MomentumSupplements'],
};

/** The widgets to redraw going from `before` to `after`; null = all of them. */
function _changedKinds(before: string | null, after: string): string[] | null {
  let a: Record<string, unknown>;
  let b: Record<string, unknown>;
  try {
    a = before ? JSON.parse(before) : null;
    b = JSON.parse(after);
  } catch {
    return null;
  }
  if (!a || !b) return null;
  const kinds = new Set<string>();
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    const widgets = WIDGET_KINDS[key];
    if (!widgets) return null;
    widgets.forEach((k) => kinds.add(k));
  }
  return [...kinds];
}

/** The widgets' snapshot (the subset this module reads back; Swift ignores `userId`). */
interface Snapshot {
  userId?: string;
  nutrition?: unknown;
  streak?: unknown;
  nutritionExtras?: unknown;
  supplements?: unknown;
}

let _started = false;
let _timer: ReturnType<typeof setTimeout> | null = null;
let _lastJson: string | null = null;
/** What the widgets showed when the app started; its sections stand in until ours load. */
let _previous: Snapshot | null = null;
/** Today's food rows, captured when a fetch succeeds (a failed one also zeroes the store). */
let _totals: { userId: string; day: string; rows: TodayFoodRow[] } | null = null;
/** The user whose meal sections were requested (they're only fetched when the diary opens otherwise). */
let _mealsFetchedFor: string | null = null;
function _captureTotals(n: ReturnType<typeof useNutritionStore.getState>): void {
  if (!n.totalsFor) return;
  _totals = { ...n.totalsFor, rows: n.todayEntries };
}

/**
 * Calories and macros per meal, in the diary's meals and order (planned food left out, as in the diary); the
 * meals on the widgets until this user's meal sections have loaded.
 */
function _meals(userId: string, day: string, rows: TodayFoodRow[]): unknown {
  const { mealConfigs, mealConfigsFor } = useFoodLogStore.getState();
  if (mealConfigsFor !== userId) {
    const previous = _previousSection(userId, 'nutrition') as { date?: string; meals?: { name: string; protein: number }[] } | null;
    const meals = previous?.meals ?? null;
    // Another day's columns: keep the meal names, not what was eaten then.
    return meals && previous?.date !== day ? meals.map((m) => ({ name: m.name, protein: 0 })) : meals;
  }
  const buckets = groupEntriesByMeal(rows as unknown as FoodEntry[], mealConfigs);
  return buckets
    .filter((b) => b.slot !== OTHER_SLOT || b.totals.calories > 0 || b.totals.protein > 0)
    .map((b) => ({
      name: b.label,
      protein: Math.round(b.totals.protein),
      kcal: Math.round(b.totals.calories),
      carbs: Math.round(b.totals.carbs),
      fat: Math.round(b.totals.fat),
    }));
}

function _nutrition(userId: string): unknown {
  const n = useNutritionStore.getState();
  if (!_totals || _totals.userId !== userId) return _previousSection(userId, 'nutrition');
  // Goals not loaded (yet): the ones on the widgets, else none (the store's are only defaults).
  const previous = _previousSection(userId, 'nutrition') as Record<string, unknown> | null;
  const goals = n.goalsFor === userId
    ? { goalKcal: n.calorieGoal, goalProtein: n.proteinGoal, goalCarbs: n.carbsGoal, goalFat: n.fatGoal }
    : {
        goalKcal: previous?.goalKcal ?? null,
        goalProtein: previous?.goalProtein ?? null,
        goalCarbs: previous?.goalCarbs ?? null,
        goalFat: previous?.goalFat ?? null,
      };
  // Eaten = the diary's sums (planned food left out), so the header matches the meal columns.
  const eaten = sumMacros(_totals.rows as unknown as FoodEntry[]);
  return {
    date: _totals.day,
    kcal: Math.round(eaten.calories),
    protein: Math.round(eaten.protein * 10) / 10,
    carbs: Math.round(eaten.carbs * 10) / 10,
    fat: Math.round(eaten.fat * 10) / 10,
    ...goals,
    meals: _meals(userId, _totals.day, _totals.rows),
  };
}

/**
 * The large Macros widget's extras: micronutrients with a goal (up to 4, eaten today, planned
 * food left out) and water / creatine. Each part only from data loaded for this user and day.
 */
function _nutritionExtras(userId: string): unknown {
  const day = toLocalDateString();
  // A part not loaded yet keeps what the widgets show, but another day's amounts count as 0 today.
  const stored = _previousSection(userId, 'nutritionExtras') as Record<string, any> | null;
  const zeroed = (list: any) => (Array.isArray(list) ? list.map((m) => ({ ...m, amount: 0 })) : list && { ...list, amount: 0 });
  const previous = stored && stored.date !== day
    ? { micros: zeroed(stored.micros), water: zeroed(stored.water), creatine: zeroed(stored.creatine) }
    : stored;
  const goals = useNutrientGoalStore.getState();
  const microList = goals.loaded && _totals?.userId === userId && _totals.day === day
    ? (() => {
        const tracked = goals.microGoals.slice(0, 4);
        const eaten = sumMicros(_totals.rows as unknown as FoodEntry[], tracked.map((g) => g.key));
        return tracked.map((g) => ({ name: g.name, unit: g.unit, amount: Math.round((eaten[g.key] ?? 0) * 10) / 10, goal: g.dailyGoal }));
      })()
    : previous?.micros ?? null;
  const sup = useSupplementStore.getState();
  const supplementsLoaded = sup.goalsFor === userId && sup.todayFor?.userId === userId && sup.todayFor.day === day;
  const creatine = sup.supplementConfigs.find((c) => c.key === 'creatine');
  return {
    date: day,
    micros: microList,
    water: supplementsLoaded ? { amount: sup.water, goal: sup.waterGoal } : previous?.water ?? null,
    creatine: supplementsLoaded
      ? (creatine ? { amount: sup.supplementTotals.creatine ?? 0, goal: creatine.dailyGoal } : null)
      : previous?.creatine ?? null,
  };
}

/** The supplements' Ionicons (useSupplementStore presets; custom ones are medical-outline) as SF Symbols. */
const SUPPLEMENT_SYMBOLS: Record<string, string> = {
  'flash-outline': 'bolt.fill',
  'sunny-outline': 'sun.max.fill',
  'fish-outline': 'fish.fill',
  'sparkles-outline': 'sparkles',
  'shield-outline': 'shield.fill',
  'cafe-outline': 'cup.and.saucer.fill',
  'leaf-outline': 'leaf.fill',
  'medical-outline': 'pills.fill',
};

/**
 * The Supplements widget's tiles: water first, then each tracked supplement in the app's order
 * (protein powder left out: adding it also logs a snack). `step` is what one tap adds (the first
 * quick amount); `color` null = the widget's water colour.
 */
function _supplements(userId: string): unknown {
  const day = toLocalDateString();
  const sup = useSupplementStore.getState();
  const loaded = sup.goalsFor === userId && sup.todayFor?.userId === userId && sup.todayFor.day === day;
  if (!loaded) {
    // Until loaded, what the widget shows; another day's amounts count as 0 today.
    const stored = _previousSection(userId, 'supplements') as { date?: string; tiles?: { amount: number }[] } | null;
    if (!stored || stored.date === day || !Array.isArray(stored.tiles)) return stored;
    return { ...stored, date: day, tiles: stored.tiles.map((tile) => ({ ...tile, amount: 0 })) };
  }
  // Every value as the widget decodes it (a phone-cached config can hold strings; NaN would be null).
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const water = {
    key: 'water', name: 'Water', unit: 'ml', amount: num(sup.water), goal: num(sup.waterGoal),
    step: num(sup.waterIncrements[0] ?? 250), icon: 'drop.fill', color: null,
  };
  const others = sup.supplementConfigs
    .filter((c) => c && c.key && c.key !== PROTEIN_POWDER_KEY)
    .map((c) => ({
      key: String(c.key),
      name: String(c.name ?? ''),
      unit: String(c.unit ?? ''),
      amount: num(sup.supplementTotals[c.key]),
      goal: num(c.dailyGoal),
      step: num(Array.isArray(c.increments) ? c.increments[0] ?? c.dailyGoal : c.dailyGoal),
      icon: SUPPLEMENT_SYMBOLS[c.icon] ?? 'pills.fill',
      color: typeof c.color === 'string' ? c.color : null,
    }));
  return { date: day, tiles: [water, ...others].filter((tile) => tile.step > 0) };
}

function _streak(userId: string): unknown {
  const s = useStreakStore.getState();
  if (s.computedFor !== userId) return _previousSection(userId, 'streak');
  return { chainStart: s.chainStart, lastWorkout: s.lastWorkout, recentDates: s.recentDates, best: s.longestStreak };
}

function _previousSection(
  userId: string,
  key: 'nutrition' | 'streak' | 'nutritionExtras' | 'supplements',
): unknown {
  return _previous?.userId === userId ? _previous[key] ?? null : null;
}

/** The snapshot to write, or null while sign-in is still being checked (write nothing yet). */
function _buildJson(): string | null {
  const auth = useAuthStore.getState();
  if (!auth.initialized) return null;
  const userId = auth.user?.id;
  if (!userId) return JSON.stringify({ signedIn: false });
  return JSON.stringify({
    signedIn: true,
    userId,
    accentHex: useThemeStore.getState().accent ?? null,
    nutrition: _nutrition(userId),
    streak: _streak(userId),
    nutritionExtras: _nutritionExtras(userId),
    supplements: _supplements(userId),
  });
}

async function _write(): Promise<void> {
  _timer = null;
  const userId = useAuthStore.getState().user?.id;
  // Signed out: the next sign-in (even the same account) loads its meal sections again, since
  // the sign-out reset put them back to the defaults.
  if (!userId) _mealsFetchedFor = null;
  if (userId && _mealsFetchedFor !== userId) {
    _mealsFetchedFor = userId;
    useFoodLogStore.getState().fetchMealConfigs(userId)
      .catch(() => {})
      .finally(() => {
        // Failed (offline): ask again on a later write.
        if (useFoodLogStore.getState().mealConfigsFor !== userId) _mealsFetchedFor = null;
      });
  }
  if (userId) {
    const goals = useNutrientGoalStore.getState();
    if (!goals.loaded) goals.loadConfigs().catch(() => {});
  }
  const json = _buildJson();
  if (json == null || json === _lastJson) return;
  if (await setHomeWidgetData(json, _changedKinds(_lastJson, json))) _lastJson = json;
}

function _schedule(): void {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => { _write().catch(() => {}); }, WRITE_DELAY_MS);
}

function _subscribe(): void {
  // Totals that loaded before this subscription existed.
  _captureTotals(useNutritionStore.getState());
  useNutritionStore.subscribe((s, prev) => {
    // A new totalsFor means a fetch succeeded: these totals are real for that user and day.
    if (s.totalsFor && s.totalsFor !== prev.totalsFor) _captureTotals(s);
    _schedule();
  });
  useAuthStore.subscribe((s, prev) => {
    if (s.initialized !== prev.initialized || s.user !== prev.user) _schedule();
  });
  useStreakStore.subscribe(_schedule);
  useFoodLogStore.subscribe((s, prev) => {
    if (s.mealConfigs !== prev.mealConfigs || s.mealConfigsFor !== prev.mealConfigsFor) _schedule();
  });
  useNutrientGoalStore.subscribe((s, prev) => { if (s.microGoals !== prev.microGoals || s.loaded !== prev.loaded) _schedule(); });
  useSupplementStore.subscribe((s, prev) => {
    if (s.water !== prev.water || s.waterGoal !== prev.waterGoal || s.supplementTotals !== prev.supplementTotals
      || s.supplementConfigs !== prev.supplementConfigs || s.todayFor !== prev.todayFor || s.goalsFor !== prev.goalsFor
      || s.waterIncrements !== prev.waterIncrements) _schedule();
  });
  useThemeStore.subscribe((s, prev) => { if (s.accent !== prev.accent) _schedule(); });
  _schedule();
}

/** Starts keeping the widgets current. Call once at app start; does nothing off iOS or without widgets. */
export function startHomeWidgets(): void {
  // Binaries without widgets (before 1.0.38): nothing to keep current.
  if (_started || Platform.OS !== 'ios' || !supportsHomeWidgets()) return;
  _started = true;
  getHomeWidgetData()
    .then((json) => {
      // Nothing written yet (or it couldn't be read): start from scratch, without clearing it.
      if (json == null) {
        _subscribe();
        return undefined;
      }
      try {
        _previous = JSON.parse(json) as Snapshot;
      } catch {
        _previous = null;
      }
      _lastJson = json;
      _subscribe();
      return undefined;
    })
    .catch(() => {});
}
