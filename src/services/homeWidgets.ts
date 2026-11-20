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
import { RECOVERY_HOURS } from '../constants/muscles';
import { useAuthStore } from '../stores/useAuthStore';
import { lastTrainedByGroup } from '../stores/useMuscleAnalysisStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
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
}

let _started = false;
let _timer: ReturnType<typeof setTimeout> | null = null;
let _lastJson: string | null = null;
/** What the widgets showed when the app started; its sections stand in until ours load. */
let _previous: Snapshot | null = null;
/** Today's totals, captured when a fetch succeeds (a failed one also zeroes the store). */
let _totals: { userId: string; day: string; kcal: number; protein: number; carbs: number; fat: number } | null = null;

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
  };
}

function _streak(userId: string): unknown {
  const s = useStreakStore.getState();
  if (s.computedFor !== userId) return _previousSection(userId, 'streak');
  return { chainStart: s.chainStart, lastWorkout: s.lastWorkout, recentDates: s.recentDates };
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

function _previousSection(userId: string, key: 'nutrition' | 'streak' | 'recovery'): unknown {
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
  });
}

async function _write(): Promise<void> {
  _timer = null;
  const json = _buildJson();
  if (json == null || json === _lastJson) return;
  if (await setHomeWidgetData(json)) _lastJson = json;
}

function _schedule(): void {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => { _write().catch(() => {}); }, WRITE_DELAY_MS);
}

function _subscribe(): void {
  useNutritionStore.subscribe((s, prev) => {
    // A new totalsFor means a fetch succeeded: these totals are real for that user and day.
    if (s.totalsFor && s.totalsFor !== prev.totalsFor) {
      _totals = { ...s.totalsFor, kcal: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat };
    }
    _schedule();
  });
  useAuthStore.subscribe((s, prev) => {
    if (s.initialized !== prev.initialized || s.user !== prev.user || s.profile !== prev.profile) _schedule();
  });
  useStreakStore.subscribe(_schedule);
  useWorkoutStore.subscribe((s, prev) => {
    if (s.workouts !== prev.workouts || s.catalogMap !== prev.catalogMap || s.historyUserId !== prev.historyUserId) _schedule();
  });
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
