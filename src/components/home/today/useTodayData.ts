import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useNutritionStore } from '../../../stores/useNutritionStore';
import { useSupplementStore } from '../../../stores/useSupplementStore';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';
import { useToday } from '../../../hooks/useToday';
import { toLocalDateString } from '../../../utils/localDate';

/** Intake numbers shown in the Today rings. */
export function useTodayIntake() {
  const nutrition = useNutritionStore(
    useShallow((s) => ({
      calories: s.calories, calorieGoal: s.calorieGoal, protein: s.protein, proteinGoal: s.proteinGoal,
      carbs: s.carbs, carbsGoal: s.carbsGoal, fat: s.fat, fatGoal: s.fatGoal,
    })),
  );
  const { water, waterGoal } = useSupplementStore(useShallow((s) => ({ water: s.water, waterGoal: s.waterGoal })));
  return { nutrition, water, waterGoal };
}

/** Last seven local days of workout history for the streak and workout action. */
export function useWorkoutWeek() {
  const workouts = useWorkoutStore((s) => s.workouts);
  const today = useToday();

  // Last 7 days (oldest first): whether a workout was logged and how many sets, plus today's workout if any.
  const { week, todayWorkout } = useMemo(() => {
    // Sets logged per local day.
    const setsByDay = new Map<string, number>();
    for (const w of workouts) {
      const k = toLocalDateString(new Date(w.created_at));
      const workingSets = w.exercises.reduce(
        (sum, ex) => sum + ex.sets.filter((set) => set.completed && set.set_type !== 'warmup').length,
        0,
      );
      setsByDay.set(k, (setsByDay.get(k) ?? 0) + workingSets);
    }
    const now = new Date(`${today}T12:00:00`);
    const todayKey = today;
    const list = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const key = toLocalDateString(d);
      return { key, day: d.getDay(), trained: setsByDay.has(key), sets: setsByDay.get(key) ?? 0, isToday: key === todayKey };
    });
    const tw = workouts.find((w) => toLocalDateString(new Date(w.created_at)) === todayKey) ?? null;
    return { week: list, todayWorkout: tw };
  }, [workouts, today]);

  return { week, todayWorkout };
}

export type NutritionTotals = ReturnType<typeof useTodayIntake>['nutrition'];
