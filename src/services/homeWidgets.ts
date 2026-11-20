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
import { groupEntriesByMeal, OTHER_SLOT } from '../components/food/groupEntriesByMeal';
import { RECOVERY_HOURS } from '../constants/muscles';
import { useAuthStore } from '../stores/useAuthStore';
import { useFoodLogStore, type FoodEntry } from '../stores/useFoodLogStore';
import { lastTrainedByGroup } from '../stores/useMuscleAnalysisStore';
import { useNutritionStore, type TodayFoodRow } from '../stores/useNutritionStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useWorkoutStore, type WorkoutWithDetails } from '../stores/useWorkoutStore';
import { ownBodyweightKg } from '../utils/muscleLoad';

const WRITE_DELAY_MS = 1000;

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
}

let _started = false;
let _timer: ReturnType<typeof setTimeout> | null = null;
let _lastJson: string | null = null;
/** What the widgets showed when the app started; its sections stand in until ours load. */
let _previous: Snapshot | null = null;
/** Today's totals, captured when a fetch succeeds (a failed one also zeroes the store). */
let _totals: { userId: string; day: string; kcal: number; protein: number; carbs: number; fat: number; rows: TodayFoodRow[] } | null = null;
/** The user whose meal sections were requested (they're only fetched when the diary opens otherwise). */
let _mealsFetchedFor: string | null = null;

function _captureTotals(n: ReturnType<typeof useNutritionStore.getState>): void {
  if (!n.totalsFor) return;
  _totals = { ...n.totalsFor, kcal: n.calories, protein: n.protein, carbs: n.carbs, fat: n.fat, rows: n.todayEntries };
}

/** Protein per meal, in the diary's meals and order (planned food left out, as in the diary). */
function _meals(rows: TodayFoodRow[]): { name: string; protein: number }[] {
  const buckets = groupEntriesByMeal(rows as unknown as FoodEntry[], useFoodLogStore.getState().mealConfigs);
  return buckets
    .filter((b) => b.slot !== OTHER_SLOT || b.totals.protein > 0)
    .map((b) => ({ name: b.label, protein: Math.round(b.totals.protein) }));
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
  return {
    date: _totals.day,
    kcal: _totals.kcal,
    protein: _totals.protein,
    carbs: _totals.carbs,
    fat: _totals.fat,
    ...goals,
    meals: _meals(_totals.rows),
  };
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

const _cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the app would call this workout: program day, routine, program, else its main muscles. */
function _title(w: WorkoutWithDetails): string {
  const routine = w.routineId ? useRoutineStore.getState().routines.find((r) => r.id === w.routineId)?.name : undefined;
  const muscles = w.muscleGroups.slice(0, 2).map(_cap).join(' & ');
  return w.programDayLabel || routine || w.programName || muscles || 'Workout';
}

/**
 * The earlier session of the same workout: same routine, or same program day; a workout from
 * neither compares with the earlier one sharing the most exercises. Null = first time.
 */
function _sameBefore(latest: WorkoutWithDetails, older: WorkoutWithDetails[]): WorkoutWithDetails | null {
  if (latest.routineId) return older.find((w) => w.routineId === latest.routineId) ?? null;
  if (latest.programDayLabel) {
    return older.find((w) => w.programDayLabel === latest.programDayLabel && w.programName === latest.programName) ?? null;
  }
  const names = new Set(latest.exercises.map((e) => e.name.toLowerCase()));
  let best: WorkoutWithDetails | null = null;
  let bestShared = 0;
  for (const w of older) {
    const shared = new Set(w.exercises.map((e) => e.name.toLowerCase()).filter((n) => names.has(n))).size;
    if (shared > bestShared) { best = w; bestShared = shared; }
  }
  return best;
}

function _lastWorkout(userId: string): unknown {
  const { workouts, historyUserId } = useWorkoutStore.getState();
  if (historyUserId !== userId) return _previousSection(userId, 'lastWorkout');
  const [latest, ...older] = workouts;
  if (!latest) return { latest: null };
  const previous = _sameBefore(latest, older);
  return {
    latest: {
      id: latest.id,
      title: _title(latest),
      at: Date.parse(latest.created_at),
      volume: latest.totalVolume,
      prs: latest.prCount,
      previous: previous ? { at: Date.parse(previous.created_at), volume: previous.totalVolume, prs: previous.prCount } : null,
    },
  };
}

function _previousSection(userId: string, key: 'nutrition' | 'streak' | 'recovery' | 'lastWorkout'): unknown {
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
  });
}

async function _write(): Promise<void> {
  _timer = null;
  const userId = useAuthStore.getState().user?.id;
  if (userId && _mealsFetchedFor !== userId) {
    _mealsFetchedFor = userId;
    useFoodLogStore.getState().fetchMealConfigs(userId).catch(() => {});
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
  useFoodLogStore.subscribe((s, prev) => { if (s.mealConfigs !== prev.mealConfigs) _schedule(); });
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
