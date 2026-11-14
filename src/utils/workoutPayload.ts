/**
 * Turns the active workout into the rows `upsert_workout` saves (see
 * supabase/migrations/20261119_upsert_workout_rpc.sql). Pure: no stores, no I/O.
 */

import type { ActiveExercise } from '../stores/useActiveWorkoutStore';

/** Longer gaps between two ticked sets aren't counted as rest (the app was left open). */
const MAX_REST_SECONDS = 60 * 60;

export type WorkoutSource = 'empty' | 'routine' | 'program' | 'ghost';

export interface WorkoutPayloadContext {
  workoutId: string;
  /** 'create' when finishing; 'replace' when finishing again after Undo. */
  mode: 'create' | 'replace';
  startTime: number;
  endTime: number;
  /** Seconds, as shown and edited on the finish screen. */
  duration: number;
  ghostUserName: string | null;
  routineId: string | null;
  programId: string | null;
  programWeek: number | null;
  /** Program day (0 = Monday) and its label, when started from a program. */
  programDayOfWeek: number | null;
  programDayLabel: string | null;
  /** Latest weigh-in, if any. */
  bodyweightKg: number | null;
}

export interface SetRow {
  set_number: number;
  kg: number;
  reps: number;
  completed: boolean;
  set_type: string;
  parent_set_number: number | null;
  completed_at: string | null;
  rest_seconds: number | null;
  target_kg: number | null;
  target_reps: number | null;
  target_source: 'previous' | 'progression' | null;
}

export interface ExerciseRow {
  name: string;
  exercise_type: string;
  notes: string | null;
  note_color: string | null;
  superset_group: number | null;
  sets: SetRow[];
}

export interface WorkoutPayload {
  id: string;
  mode: 'create' | 'replace';
  duration: number;
  total_exercises: number;
  total_sets: number;
  ghost_username: string | null;
  routine_id: string | null;
  program_id: string | null;
  program_week: number | null;
  program_day_of_week: number | null;
  program_day_label: string | null;
  started_at: string;
  ended_at: string;
  timezone: string | null;
  utc_offset_min: number;
  bodyweight_kg: number | null;
  source: WorkoutSource;
  exercises: ExerciseRow[];
}

export interface BuiltWorkout {
  payload: WorkoutPayload;
  /** The exercises that are saved: sets with a weight or reps entered, exercises with at least one. */
  saved: ActiveExercise[];
  totalVolume: number;
  totalSets: number;
}

/** A set counts once it has a weight or reps entered (ticked or not). */
export function hasSetValues(s: { kg: string; reps: string }): boolean {
  return s.kg.trim() !== '' || s.reps.trim() !== '';
}

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Superset partners share a group number (0, 1, ...) in saved order; a lone half gets none. */
function supersetGroups(exercises: ActiveExercise[], keptIndexes: number[]): (number | null)[] {
  const keptPos = new Map<number, number>();
  keptIndexes.forEach((orig, pos) => keptPos.set(orig, pos));

  const groupOf = new Map<number, number>(); // saved position -> group
  let next = 0;
  keptIndexes.forEach((orig, pos) => {
    const partner = exercises[orig].supersetWith;
    if (partner == null) return;
    const partnerPos = keptPos.get(partner);
    if (partnerPos === undefined) return; // partner had no sets
    const existing = groupOf.get(pos) ?? groupOf.get(partnerPos);
    const group = existing ?? next++;
    groupOf.set(pos, group);
    groupOf.set(partnerPos, group);
  });
  return keptIndexes.map((_, pos) => groupOf.get(pos) ?? null);
}

export function buildWorkoutPayload(exercises: ActiveExercise[], ctx: WorkoutPayloadContext): BuiltWorkout {
  const keptIndexes: number[] = [];
  const saved: ActiveExercise[] = [];
  exercises.forEach((ex, i) => {
    const sets = ex.sets.filter(hasSetValues);
    if (sets.length === 0) return;
    keptIndexes.push(i);
    saved.push({ ...ex, sets });
  });

  // Rest before a set: time since the previous set (in any exercise) was ticked off.
  const completedTimes = saved
    .flatMap((ex) => ex.sets.map((s) => (s.completed && s.completedAt ? s.completedAt : null)))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const restBefore = (t: number): number | null => {
    const i = completedTimes.indexOf(t);
    if (i <= 0) return null;
    const seconds = Math.round((t - completedTimes[i - 1]) / 1000);
    return seconds >= 0 && seconds <= MAX_REST_SECONDS ? seconds : null;
  };

  const groups = supersetGroups(exercises, keptIndexes);
  let totalVolume = 0;
  let totalSets = 0;

  const exerciseRows: ExerciseRow[] = saved.map((ex, pos) => {
    const original = exercises[keptIndexes[pos]].sets;
    // Drop sets point at their parent's 1-based position; empty sets are dropped, so renumber.
    const newNumber = new Map<number, number>();
    let n = 0;
    original.forEach((s, j) => {
      if (hasSetValues(s)) newNumber.set(j + 1, ++n);
    });

    const sets: SetRow[] = ex.sets.map((s, j) => {
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps, 10) || 0;
      totalSets++;
      totalVolume += kg * reps;

      const completedAt = s.completed && s.completedAt ? s.completedAt : null;
      return {
        set_number: j + 1,
        kg,
        reps,
        completed: s.completed,
        set_type: s.set_type,
        parent_set_number: s.parent_set_number != null ? newNumber.get(s.parent_set_number) ?? null : null,
        completed_at: completedAt ? new Date(completedAt).toISOString() : null,
        rest_seconds: completedAt ? restBefore(completedAt) : null,
        target_kg: s.completed && s.target ? s.target.kg : null,
        target_reps: s.completed && s.target ? s.target.reps : null,
        target_source: s.completed && s.target ? s.target.source : null,
      };
    });

    return {
      name: ex.name,
      exercise_type: ex.exercise_type,
      notes: ex.notes?.trim() || null,
      note_color: ex.notes?.trim() ? ex.noteColor ?? null : null,
      superset_group: groups[pos],
      sets,
    };
  });

  const source: WorkoutSource = ctx.ghostUserName
    ? 'ghost'
    : ctx.programId
      ? 'program'
      : ctx.routineId
        ? 'routine'
        : 'empty';

  const bodyweight = ctx.bodyweightKg != null && ctx.bodyweightKg > 0 && ctx.bodyweightKg < 500 ? ctx.bodyweightKg : null;
  const offset = -new Date(ctx.startTime).getTimezoneOffset();

  const payload: WorkoutPayload = {
    id: ctx.workoutId,
    mode: ctx.mode,
    duration: Math.max(0, Math.round(ctx.duration)),
    total_exercises: exerciseRows.length,
    total_sets: totalSets,
    ghost_username: ctx.ghostUserName,
    routine_id: ctx.routineId,
    program_id: ctx.programId,
    program_week: ctx.programId ? ctx.programWeek : null,
    program_day_of_week: ctx.programId ? ctx.programDayOfWeek : null,
    program_day_label: ctx.programId ? ctx.programDayLabel : null,
    started_at: new Date(Math.min(ctx.startTime, ctx.endTime)).toISOString(),
    ended_at: new Date(ctx.endTime).toISOString(),
    timezone: deviceTimezone(),
    utc_offset_min: Math.max(-840, Math.min(840, offset)),
    bodyweight_kg: bodyweight,
    source,
    exercises: exerciseRows,
  };

  return { payload, saved, totalVolume, totalSets };
}
