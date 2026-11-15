import { useCallback, useState } from 'react';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { makeUuid } from '../../utils/uuid';
import type { PlanExercise } from '../../utils/planExercise';

/* ─── Types ──────────────────────────────────────────── */

interface LocalSet {
  goal_reps: number;
  goal_weight: number;
}

/** An exercise being edited in the routine or program-day editor. */
export interface LocalExercise {
  /** Local-only React key (never saved): keeps a card's typed text and swipe state when exercises are moved. */
  uid: string;
  name: string;
  sets: LocalSet[];
  rest_seconds: number;
  category: string | null;
  exercise_type: string;
  prevSets: { kg: number; reps: number }[];
}

/* ─── Helpers ────────────────────────────────────────── */

/** A newly added exercise: 3 sets of 10, weights from last time, 90 s rest. */
export function newLocalExercise(name: string, exerciseType: string, category: string | null): LocalExercise {
  const prevSets = useWorkoutStore.getState().prevMap[name] || [];
  const sets: LocalSet[] = Array.from({ length: 3 }, (_, i) => ({
    goal_reps: 10,
    goal_weight: prevSets[i]?.kg ?? 0,
  }));
  return { uid: makeUuid(), name, sets, rest_seconds: 90, category, exercise_type: exerciseType, prevSets };
}

/** The edited list as saved: order from the list, defaults from the first set. */
export function toPlanExercises(exercises: LocalExercise[]): PlanExercise[] {
  return exercises.map((e, i) => ({
    name: e.name,
    exercise_order: i + 1,
    default_sets: e.sets.length,
    default_reps: e.sets[0]?.goal_reps ?? 10,
    default_rest_seconds: e.rest_seconds,
    set_reps: e.sets.map((s) => s.goal_reps),
    set_weights: e.sets.map((s) => s.goal_weight),
    exercise_type: e.exercise_type || 'weighted',
  }));
}

/* ─── Hook ───────────────────────────────────────────── */

/**
 * The exercise list both plan editors edit, with the handlers their exercise cards call. Every handler
 * takes the card's index and is stable, so unchanged cards keep their React.memo.
 */
export function useExerciseListEditor(initial: () => LocalExercise[]) {
  const [exercises, setExercises] = useState<LocalExercise[]>(initial);

  /** Replace one exercise (by index) with `update(exercise)`; returning the same object leaves the list untouched. */
  const updateAt = useCallback((index: number, update: (ex: LocalExercise) => LocalExercise) => {
    setExercises((prev) => {
      const nextEx = update(prev[index]);
      if (nextEx === prev[index]) return prev;
      const next = [...prev];
      next[index] = nextEx;
      return next;
    });
  }, []);

  const handleAddSet = useCallback((index: number) => {
    updateAt(index, (ex) => {
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { goal_reps: last?.goal_reps ?? 10, goal_weight: last?.goal_weight ?? 0 }] };
    });
  }, [updateAt]);

  const handleRemoveSet = useCallback((index: number, setIndex: number) => {
    updateAt(index, (ex) => (ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) }));
  }, [updateAt]);

  const handleSetRepsChange = useCallback((index: number, setIndex: number, reps: number) => {
    updateAt(index, (ex) => ({ ...ex, sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, goal_reps: reps } : s)) }));
  }, [updateAt]);

  const handleSetWeightChange = useCallback((index: number, setIndex: number, weight: number) => {
    updateAt(index, (ex) => ({ ...ex, sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, goal_weight: weight } : s)) }));
  }, [updateAt]);

  const handleRestChange = useCallback((index: number, seconds: number) => {
    updateAt(index, (ex) => ({ ...ex, rest_seconds: seconds }));
  }, [updateAt]);

  const handleRemove = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setExercises((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  return {
    exercises,
    setExercises,
    handleAddSet,
    handleRemoveSet,
    handleSetRepsChange,
    handleSetWeightChange,
    handleRestChange,
    handleRemove,
    handleMoveUp,
    handleMoveDown,
  };
}
