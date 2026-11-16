import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';
import { sw, SCREEN_WIDTH } from '../../../theme/responsive';
import { CHART_H, Y_LABEL_W } from './historyStyles';

export interface HistoryEntry {
  workoutId: string;
  date: string;
  sets: { kg: number; reps: number; completed: boolean; set_type: string | null }[];
  maxWeight: number;
  totalVolume: number;
  totalReps: number;
}

export interface PRData {
  heaviestKg: number;
  heaviestReps: number;
  mostReps: number;
  mostRepsKg: number;
  bestVolume: number;
}

export type ChartMode = 'weight' | 'volume';
export type ChartPoint = { x: number; y: number; value: number; date: Date };
export type YScale = { yMin: number; yMax: number; yRange: number };

/** Loads the user's last 100 sessions of an exercise while the page is visible, and derives
 *  the PRs, average weight, next target and chart points from them. */
export function useExerciseHistory(exerciseName: string | null, visible: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chartMode, setChartMode] = useState<ChartMode>('weight');

  /** Back to the closed state (the page calls it when it closes). */
  const reset = useCallback(() => {
    setHistory([]);
    setLoading(true);
    setChartMode('weight');
  }, []);

  /* ─── Data fetching ──────────────────────────────────── */

  useEffect(() => {
    if (!visible || !exerciseName || !userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('exercises')
          .select('id, workout_id, exercise_type, sets(set_number, kg, reps, completed, set_type), workouts!inner(id, created_at, user_id)')
          .eq('name', exerciseName)
          .eq('workouts.user_id', userId)
          .order('created_at', { referencedTable: 'workouts', ascending: false })
          .limit(100);

        if (cancelled) return;
        if (error) {
          if (__DEV__) console.error('[ExerciseHistory] query error:', error);
          setLoading(false);
          return;
        }

        const entries: HistoryEntry[] = (data || []).map((ex: any) => {
          const workout = ex.workouts;
          const sets = (ex.sets || [])
            .sort((a: any, b: any) => a.set_number - b.set_number)
            .map((s: any) => ({
              kg: Number(s.kg) || 0,
              reps: Number(s.reps) || 0,
              completed: !!s.completed,
              set_type: s.set_type || null,
            }));

          const completedSets = sets.filter((s: any) => s.completed);
          const maxWeight = completedSets.reduce((max: number, s: any) => Math.max(max, s.kg), 0);
          const totalVolume = completedSets.reduce((sum: number, s: any) => sum + s.kg * s.reps, 0);
          const totalReps = completedSets.reduce((sum: number, s: any) => sum + s.reps, 0);

          return {
            workoutId: workout?.id || ex.workout_id,
            date: workout?.created_at || '',
            sets,
            maxWeight,
            totalVolume,
            totalReps,
          };
        });

        entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(entries);

        // Default to volume chart for bodyweight exercises
        const catEntry = catalogMap[exerciseName];
        if (catEntry?.exercise_type === 'bodyweight') {
          setChartMode('volume');
        }
      } catch (err) {
        if (__DEV__) console.error('[ExerciseHistory] fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, exerciseName, userId]);

  /* ─── Derived data ───────────────────────────────────── */

  const prs = useMemo<PRData>(() => {
    let heaviestKg = 0, heaviestReps = 0;
    let mostReps = 0, mostRepsKg = 0;
    let bestVolume = 0;

    for (const entry of history) {
      if (entry.totalVolume > bestVolume) bestVolume = entry.totalVolume;
      for (const s of entry.sets) {
        if (!s.completed) continue;
        if (s.kg > heaviestKg || (s.kg === heaviestKg && s.reps > heaviestReps)) {
          heaviestKg = s.kg;
          heaviestReps = s.reps;
        }
        if (s.reps > mostReps || (s.reps === mostReps && s.kg > mostRepsKg)) {
          mostReps = s.reps;
          mostRepsKg = s.kg;
        }
      }
    }

    return { heaviestKg, heaviestReps, mostReps, mostRepsKg, bestVolume };
  }, [history]);

  const avgWeight = useMemo(() => {
    let total = 0, count = 0;
    for (const entry of history) {
      for (const s of entry.sets) {
        if (s.completed && s.kg > 0) { total += s.kg; count++; }
      }
    }
    return count > 0 ? Math.round(total / count * 10) / 10 : 0;
  }, [history]);

  const lastEntry = history[0] || null;

  const suggestedNext = useMemo(() => {
    if (!lastEntry) return null;
    const completed = lastEntry.sets.filter((s) => s.completed);
    if (completed.length === 0) return null;
    const maxKg = Math.max(...completed.map((s) => s.kg));
    const maxReps = Math.max(...completed.filter((s) => s.kg === maxKg).map((s) => s.reps));
    return { kg: maxKg, reps: maxReps + 1 };
  }, [lastEntry]);

  const exerciseType = exerciseName ? catalogMap[exerciseName]?.exercise_type : null;
  const isBodyweight = exerciseType === 'bodyweight';

  /* ─── Chart data ─────────────────────────────────────── */

  const chartWidth = SCREEN_WIDTH - sw(32) - Y_LABEL_W;

  const { chartPoints, yScale } = useMemo<{ chartPoints: ChartPoint[]; yScale: YScale }>(() => {
    if (history.length < 2) return { chartPoints: [], yScale: { yMin: 0, yMax: 100, yRange: 100 } };

    const sorted = [...history].reverse(); // oldest first
    const points = sorted.map((entry) => ({
      value: chartMode === 'weight' ? entry.maxWeight : entry.totalVolume,
      date: new Date(entry.date),
    }));

    const values = points.map((p) => p.value).filter((v) => v > 0);
    if (values.length < 2) return { chartPoints: [], yScale: { yMin: 0, yMax: 100, yRange: 100 } };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.15, chartMode === 'weight' ? 2.5 : 50);
    const yMin = min - pad;
    const yMax = max + pad;
    const yRange = yMax - yMin;

    const slotW = chartWidth / (points.length - 1 || 1);
    const chartPts = points.map((p, i) => ({
      x: Y_LABEL_W + i * slotW,
      y: CHART_H * (1 - (p.value - yMin) / yRange),
      value: p.value,
      date: p.date,
    }));

    return { chartPoints: chartPts, yScale: { yMin, yMax, yRange } };
  }, [history, chartMode, chartWidth]);

  return {
    loading, history, chartMode, setChartMode, reset,
    prs, avgWeight, lastEntry, suggestedNext, isBodyweight, chartPoints, yScale,
  };
}
