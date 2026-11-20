/**
 * Home screen widgets (iOS, 1.0.38+): keeps the data they show in the shared App Group.
 *
 * Widgets can't run the app's code, so this writes one JSON snapshot (shape: HomeWidgetData in
 * targets/workout-activity/HomeWidgetData.swift) whenever something they show changes: today's
 * nutrition and goals, the streak, recent workouts (recovery), the accent, sign-in. Writes are
 * debounced and skipped when nothing changed; native redraws the widgets only on a real change.
 * What changes with time alone (a new day, the streak counting up, recovery) the widgets work out
 * from the dates in the snapshot.
 *
 * Each section is written only from data that really loaded for the signed-in user (a store's
 * starting values, or a failed fetch offline, would show 0 kcal / a 0-day streak / fully
 * recovered). Until a section has loaded this run, the one already on the widgets is kept (read
 * back at start, when it belongs to the same user). Plain module, no React state.
 */

import { Platform } from 'react-native';
import { getHomeWidgetData, setHomeWidgetData } from '../../modules/workout-live-activity';
import { sumMacros, sumMicros } from '../components/food/dayTotals';
import { supabase } from '../lib/supabase';
import { groupEntriesByMeal, OTHER_SLOT } from '../components/food/groupEntriesByMeal';
import { RECOVERY_HOURS } from '../constants/muscles';
import { useAuthStore } from '../stores/useAuthStore';
import { useFoodLogStore, type FoodEntry } from '../stores/useFoodLogStore';
import { lastTrainedByGroup } from '../stores/useMuscleAnalysisStore';
import { useNutrientGoalStore } from '../stores/useNutrientGoalStore';
import { useNutritionStore, type TodayFoodRow } from '../stores/useNutritionStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useWorkoutStore, type WorkoutWithDetails } from '../stores/useWorkoutStore';
import { parseLocalDate, toLocalDateString } from '../utils/localDate';
import { ownBodyweightKg } from '../utils/muscleLoad';

const WRITE_DELAY_MS = 1000;
/** fetchWorkoutHistory's limit; fewer loaded means the user's whole history is here. */
const HISTORY_LIMIT = 30;
/** Older workouts a PR count needs behind it to be trusted (see _lastWorkout). */
const PR_LOOKBACK = 10;

const GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves'] as const;
const GROUP_HOURS = RECOVERY_HOURS as Record<(typeof GROUPS)[number], number>;
const groupName = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);

/** The widgets' snapshot (the subset this module reads back; Swift ignores `userId`). */
interface Snapshot {
  userId?: string;
  nutrition?: unknown;
  streak?: unknown;
  recovery?: unknown;
  lastWorkout?: unknown;
  nutritionExtras?: unknown;
  proteinWeek?: unknown;
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
/** Protein eaten on each of the 6 days before today, for one user and day; refetched the next day. */
let _week: { userId: string; day: string; days: { date: string; protein: number }[] } | null = null;
let _weekLoading = false;

function _captureTotals(n: ReturnType<typeof useNutritionStore.getState>): void {
  if (!n.totalsFor) return;
  _totals = { ...n.totalsFor, rows: n.todayEntries };
}

/**
 * Protein per meal, in the diary's meals and order (planned food left out, as in the diary); the
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

/**
 * Protein on the 6 days before today, plus today's (so after midnight the widget still has
 * yesterday's; it shows today's from the live nutrition section).
 */
function _proteinWeek(userId: string): unknown {
  const stored = (_previousSection(userId, 'proteinWeek') ?? []) as { date: string; protein: number }[];
  // A week fetched on an earlier day misses the days since: fill them from what the widgets show.
  const fetched = _week?.userId === userId ? _week.days : [];
  const oldest = parseLocalDate(toLocalDateString());
  oldest.setDate(oldest.getDate() - 7);
  const cutoff = toLocalDateString(oldest);
  // Only the days the chart can show, so the list doesn't grow day after day.
  const earlier = [...fetched, ...stored.filter((d) => !fetched.some((f) => f.date === d.date))]
    .filter((d) => d.date >= cutoff);
  if (!_totals || _totals.userId !== userId) return earlier;
  const today = {
    date: _totals.day,
    protein: Math.round(sumMacros(_totals.rows as unknown as FoodEntry[]).protein),
  };
  const days = Array.isArray(earlier) ? (earlier as { date: string }[]).filter((d) => d.date !== today.date) : [];
  return [...days, today];
}

/** Loads _week for this user and day (one small request a day), then writes again. */
function _loadProteinWeek(userId: string): void {
  const today = toLocalDateString();
  if (_weekLoading || (_week?.userId === userId && _week.day === today)) return;
  _weekLoading = true;
  const start = parseLocalDate(today);
  start.setDate(start.getDate() - 6);
  const end = parseLocalDate(today);
  supabase
    .from('food_entries')
    .select('protein, is_planned, created_at')
    .eq('user_id', userId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .limit(2000)
    .then(({ data, error }) => {
      if (error || !data || useAuthStore.getState().user?.id !== userId) return;
      const byDay = new Map<string, number>();
      for (const row of data) {
        if (row.is_planned) continue;
        const key = toLocalDateString(new Date(row.created_at));
        byDay.set(key, (byDay.get(key) ?? 0) + (Number(row.protein) || 0));
      }
      _week = { userId, day: today, days: [...byDay].map(([date, protein]) => ({ date, protein: Math.round(protein) })) };
      _schedule();
    })
    .then(() => { _weekLoading = false; }, () => { _weekLoading = false; });
}

function _streak(userId: string): unknown {
  const s = useStreakStore.getState();
  if (s.computedFor !== userId) return _previousSection(userId, 'streak');
  return { chainStart: s.chainStart, lastWorkout: s.lastWorkout, recentDates: s.recentDates, best: s.longestStreak };
}

function _recovery(userId: string, gender: string | null | undefined, startingWeight: number | null | undefined): unknown {
  const { workouts, catalogMap, historyUserId } = useWorkoutStore.getState();
  if (historyUserId !== userId) return _previousSection(userId, 'recovery');
  const bodyweightKg = ownBodyweightKg(useWeightStore.getState().current, startingWeight);
  const trained = lastTrainedByGroup(workouts, catalogMap, bodyweightKg, new Date());
  return {
    groups: GROUPS.map((g) => ({ name: groupName(g), trainedAt: trained[g] ?? null, hours: GROUP_HOURS[g] })),
    body: gender === 'female' ? 'female' : 'male',
  };
}

/** What the app would call this workout: program day, routine, program, else its main muscles. */
function _title(w: WorkoutWithDetails): string {
  const routine = w.routineId ? useRoutineStore.getState().routines.find((r) => r.id === w.routineId)?.name : undefined;
  const muscles = w.muscleGroups.slice(0, 2).map(groupName).join(' & ');
  return w.programDayLabel || routine || w.programName || muscles || 'Workout';
}

/**
 * The earlier session of the same workout: same routine, or same program day; a workout from
 * neither compares with the earlier one sharing the most exercises, at least half of its own.
 * Null = not in the loaded history.
 */
function _sameBefore(latest: WorkoutWithDetails, older: WorkoutWithDetails[]): WorkoutWithDetails | null {
  if (latest.routineId) return older.find((w) => w.routineId === latest.routineId) ?? null;
  if (latest.programDayLabel) {
    return older.find((w) => w.programDayLabel === latest.programDayLabel && w.programName === latest.programName) ?? null;
  }
  const names = new Set(latest.exercises.map((e) => e.name.toLowerCase()));
  let best: WorkoutWithDetails | null = null;
  let bestShared = Math.max(1, Math.ceil(names.size / 2)) - 1;
  for (const w of older) {
    const shared = new Set(w.exercises.map((e) => e.name.toLowerCase()).filter((n) => names.has(n))).size;
    if (shared > bestShared) { best = w; bestShared = shared; }
  }
  return best;
}

/** Assisted machine or band exercises (the same test as utils/muscleLoad.ts isAssisted). */
const ASSISTED = /\bassist(ed|ance)?\b/i;

/** The heaviest completed working set (most reps at that weight); null when there's none. */
function _heaviestSet(sets: WorkoutWithDetails['exercises'][number]['sets']): { kg: number; reps: number } | null {
  let best: { kg: number; reps: number } | null = null;
  for (const s of sets) {
    if (!s.completed || s.set_type === 'warmup' || !(s.reps > 0)) continue;
    const kg = Number(s.kg) || 0;
    if (!best || kg > best.kg || (kg === best.kg && s.reps > best.reps)) best = { kg, reps: s.reps };
  }
  return best;
}

/** Each exercise's heaviest set, and the same exercise's in the earlier session (null = not done then). */
function _exerciseBests(latest: WorkoutWithDetails, previous: WorkoutWithDetails | null) {
  const before = new Map<string, { kg: number; reps: number } | null>();
  for (const e of previous?.exercises ?? []) before.set(e.name.toLowerCase(), _heaviestSet(e.sets));
  const rows: { name: string; kind: string; kg: number; reps: number; previousKg: number | null; previousReps: number | null }[] = [];
  for (const e of latest.exercises) {
    // Assisted exercises' kg is the assistance (utils/muscleLoad.ts), so "heaviest" would be the
    // easiest set: left out rather than shown the wrong way round.
    if (ASSISTED.test(e.name)) continue;
    const best = _heaviestSet(e.sets);
    if (!best || best.kg < 0) continue;
    const last = before.get(e.name.toLowerCase()) ?? null;
    // Duration exercises keep seconds in reps; the widget shows them as time.
    rows.push({ name: e.name, kind: e.exercise_type, kg: best.kg, reps: best.reps, previousKg: last?.kg ?? null, previousReps: last?.reps ?? null });
  }
  return rows;
}

function _lastWorkout(userId: string): unknown {
  const { workouts, historyUserId } = useWorkoutStore.getState();
  if (historyUserId !== userId) return _previousSection(userId, 'lastWorkout');
  const [latest, ...older] = workouts;
  if (!latest) return { latest: null };
  const at = Date.parse(latest.created_at);
  if (!Number.isFinite(at)) return _previousSection(userId, 'lastWorkout');
  const previous = _sameBefore(latest, older);
  const previousAt = previous ? Date.parse(previous.created_at) : NaN;
  // prCount only looks back through the loaded history, so for a workout near its oldest end it
  // counts lifts as PRs that weren't: leave that one out.
  const previousIndex = previous ? workouts.indexOf(previous) : -1;
  // (With fewer than HISTORY_LIMIT loaded, that's the whole history and every count is exact.)
  const previousPrsReliable = previousIndex >= 0
    && (workouts.length < HISTORY_LIMIT || workouts.length - previousIndex > PR_LOOKBACK);
  return {
    latest: {
      id: latest.id,
      title: _title(latest),
      at,
      volume: latest.totalVolume,
      prs: latest.prCount,
      previous: previous && Number.isFinite(previousAt)
        ? { at: previousAt, volume: previous.totalVolume, prs: previousPrsReliable ? previous.prCount : null }
        : null,
      // No earlier session in the whole loaded history: really the first time only if that's all of it.
      firstTime: !previous && workouts.length < HISTORY_LIMIT,
      exercises: _exerciseBests(latest, previous && Number.isFinite(previousAt) ? previous : null),
    },
  };
}

function _previousSection(
  userId: string,
  key: 'nutrition' | 'streak' | 'recovery' | 'lastWorkout' | 'nutritionExtras' | 'proteinWeek',
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
    recovery: _recovery(userId, auth.profile?.gender, auth.profile?.starting_weight),
    lastWorkout: _lastWorkout(userId),
    nutritionExtras: _nutritionExtras(userId),
    proteinWeek: _proteinWeek(userId),
  });
}

async function _write(): Promise<void> {
  _timer = null;
  const userId = useAuthStore.getState().user?.id;
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
    _loadProteinWeek(userId);
    const goals = useNutrientGoalStore.getState();
    if (!goals.loaded) goals.loadConfigs().catch(() => {});
  }
  const json = _buildJson();
  if (json == null || json === _lastJson) return;
  if (await setHomeWidgetData(json)) _lastJson = json;
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
    if (s.initialized !== prev.initialized || s.user !== prev.user || s.profile !== prev.profile) _schedule();
  });
  useStreakStore.subscribe(_schedule);
  useWorkoutStore.subscribe((s, prev) => {
    if (s.workouts !== prev.workouts || s.catalogMap !== prev.catalogMap || s.historyUserId !== prev.historyUserId) _schedule();
  });
  useFoodLogStore.subscribe((s, prev) => {
    if (s.mealConfigs !== prev.mealConfigs || s.mealConfigsFor !== prev.mealConfigsFor) _schedule();
  });
  useNutrientGoalStore.subscribe((s, prev) => { if (s.microGoals !== prev.microGoals || s.loaded !== prev.loaded) _schedule(); });
  useSupplementStore.subscribe((s, prev) => {
    if (s.water !== prev.water || s.waterGoal !== prev.waterGoal || s.supplementTotals !== prev.supplementTotals
      || s.supplementConfigs !== prev.supplementConfigs || s.todayFor !== prev.todayFor || s.goalsFor !== prev.goalsFor) _schedule();
  });
  useRoutineStore.subscribe((s, prev) => { if (s.routines !== prev.routines) _schedule(); });
  useWeightStore.subscribe((s, prev) => { if (s.current !== prev.current) _schedule(); });
  useThemeStore.subscribe((s, prev) => { if (s.accent !== prev.accent) _schedule(); });
  _schedule();
}

/** Starts keeping the widgets current. Call once at app start; does nothing off iOS or without widgets. */
export function startHomeWidgets(): void {
  if (_started || Platform.OS !== 'ios') return;
  _started = true;
  getHomeWidgetData()
    .then((json) => {
      // null also on binaries without widgets: then there's nothing to keep current.
      if (json == null) {
        return setHomeWidgetData(null).then((supported) => { if (supported) _subscribe(); });
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
