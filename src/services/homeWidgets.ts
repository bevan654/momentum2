/**
 * Home screen widgets (iOS, 1.0.38+): keeps the data they show in the shared App Group.
 *
 * Widgets can't run the app's code, so this writes one JSON snapshot (shape: HomeWidgetData in
 * targets/workout-activity/HomeWidgetData.swift) whenever something they show changes: today's
 * nutrition and goals, the streak, recent workouts (recovery), the accent, sign-in. Writes are
 * debounced and skipped when nothing changed; native redraws the widgets only on a real change.
 * What changes with time alone (a new day, the streak counting up, recovery) the widgets work out
 * from the dates in the snapshot. Plain module, no React state.
 */

import { Platform } from 'react-native';
import { setHomeWidgetData } from '../../modules/workout-live-activity';
import { RECOVERY_HOURS } from '../constants/muscles';
import { useAuthStore } from '../stores/useAuthStore';
import { lastTrainedByGroup } from '../stores/useMuscleAnalysisStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { toLocalDateString } from '../utils/localDate';
import { ownBodyweightKg } from '../utils/muscleLoad';

const WRITE_DELAY_MS = 1000;

const GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves'] as const;
const GROUP_HOURS = RECOVERY_HOURS as Record<(typeof GROUPS)[number], number>;
const groupName = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);

let _started = false;
let _timer: ReturnType<typeof setTimeout> | null = null;
let _lastJson: string | null | undefined;
/** The local day useNutritionStore's totals were last set on: they're "today" only until midnight. */
let _nutritionDay: string | null = null;

function _buildJson(): string {
  const auth = useAuthStore.getState();
  if (!auth.user) return JSON.stringify({ signedIn: false });

  const n = useNutritionStore.getState();
  const streak = useStreakStore.getState();
  const { workouts, catalogMap } = useWorkoutStore.getState();
  const bodyweightKg = ownBodyweightKg(useWeightStore.getState().current, auth.profile?.starting_weight);
  const trained = lastTrainedByGroup(workouts, catalogMap, bodyweightKg, new Date());

  return JSON.stringify({
    signedIn: true,
    accentHex: useThemeStore.getState().accent ?? null,
    nutrition: _nutritionDay
      ? {
          date: _nutritionDay,
          kcal: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          fat: n.fat,
          goalKcal: n.calorieGoal,
          goalProtein: n.proteinGoal,
          goalCarbs: n.carbsGoal,
          goalFat: n.fatGoal,
        }
      : null,
    streak: streak.loaded
      ? { chainStart: streak.chainStart, lastWorkout: streak.lastWorkout, recentDates: streak.recentDates }
      : null,
    recovery: {
      groups: GROUPS.map((g) => ({ name: groupName(g), trainedAt: trained[g] ?? null, hours: GROUP_HOURS[g] })),
      body: auth.profile?.gender === 'female' ? 'female' : 'male',
    },
  });
}

async function _write(): Promise<void> {
  _timer = null;
  const json = _buildJson();
  if (json === _lastJson) return;
  if (await setHomeWidgetData(json)) _lastJson = json;
}

function _schedule(): void {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => { _write().catch(() => {}); }, WRITE_DELAY_MS);
}

/** Starts keeping the widgets current. Call once at app start; does nothing off iOS. */
export function startHomeWidgets(): void {
  if (_started || Platform.OS !== 'ios') return;
  _started = true;
  useNutritionStore.subscribe(() => {
    _nutritionDay = toLocalDateString();
    _schedule();
  });
  // Each store notifies on any change; a write that produces the same JSON is skipped.
  useAuthStore.subscribe((s, prev) => {
    if (s.user?.id !== prev.user?.id) _nutritionDay = null; // another account's totals aren't these
    if (s.user !== prev.user || s.profile !== prev.profile) _schedule();
  });
  useStreakStore.subscribe(_schedule);
  useWorkoutStore.subscribe((s, prev) => {
    if (s.workouts !== prev.workouts || s.catalogMap !== prev.catalogMap) _schedule();
  });
  useWeightStore.subscribe((s, prev) => { if (s.current !== prev.current) _schedule(); });
  useThemeStore.subscribe((s, prev) => { if (s.accent !== prev.accent) _schedule(); });
  _schedule();
}
