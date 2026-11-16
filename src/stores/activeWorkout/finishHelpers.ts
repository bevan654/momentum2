/**
 * Pure-ish pieces of finishing a workout: what goes into the feed post, the summary and the rank
 * update. They only read other stores; the save itself and the session state stay in
 * useActiveWorkoutStore.
 */
import { useProgramStore } from '../useProgramStore';
import { useRoutineStore } from '../useRoutineStore';
import { useWorkoutStore } from '../useWorkoutStore';
import { buildFeedExerciseDetails } from '../../utils/feedExerciseDetails';
import { hasSetValues } from '../../utils/workoutPayload';
import { compareGhostSet } from '../../utils/ghostCompare';
import type { ActiveExercise, SummaryExercise, WorkoutSummary } from './types';

/** The program day a workout belongs to: the weekday it was started on (0 = Monday) and that day's label. */
export function programDayOf(start: number, programId: string | null): { programDayOfWeek: number | null; programDayLabel: string | null } {
  if (!programId) return { programDayOfWeek: null, programDayLabel: null };
  const jsDay = new Date(start).getDay();
  const programDayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
  const prog = useProgramStore.getState().programs.find((p) => p.id === programId);
  const programDayLabel = prog?.days.find((d) => d.day_of_week === programDayOfWeek)?.label || null;
  return { programDayOfWeek, programDayLabel };
}

/**
 * For each saved exercise, where each of its sets was in the workout as logged (before
 * buildWorkoutPayload dropped the empty ones), so a set is compared with the ghost's set at
 * that position. undefined when the logged exercise can't be matched.
 */
function ghostSetPositions(saved: ActiveExercise[], liveExercises: ActiveExercise[]): (number[] | undefined)[] {
  // saved holds the logged exercises that have a set with values, in order, each with those sets
  const liveKept = liveExercises.filter((ex) => ex.sets.some(hasSetValues));
  return saved.map((_, k) => {
    const live = liveKept[k];
    return live ? live.sets.flatMap((s, i) => (hasSetValues(s) ? [i] : [])) : undefined;
  });
}

/**
 * Ghost challenge result: each completed set against last time's set at the same position in
 * the workout as logged. The same rule as the live tally (GhostTally) and GhostFinishScreen.
 */
function ghostVerdict(saved: ActiveExercise[], positions: (number[] | undefined)[]): 'victory' | 'defeated' | 'draw' {
  let w = 0, l = 0;
  saved.forEach((ex, k) => {
    ex.sets.forEach((s, j) => {
      if (!s.completed) return;
      const g = ex.prevSets[positions[k]?.[j] ?? j];
      if (!g) return;
      const result = compareGhostSet(parseFloat(s.kg) || 0, parseInt(s.reps, 10) || 0, g.kg, g.reps);
      if (result === 'win') w++;
      else if (result === 'loss') l++;
    });
  });
  return w > l ? 'victory' : l > w ? 'defeated' : 'draw';
}

interface FeedContext {
  userId: string;
  workoutId: string;
  duration: number;
  totalVolume: number;
  totalSets: number;
  ghostUserName: string | null;
  routineId: string | null;
  programId: string | null;
  programWeek: number | null;
  programDayOfWeek: number | null;
  /** The workout as logged, before buildWorkoutPayload dropped empty sets (for the ghost set positions). */
  liveExercises: ActiveExercise[];
}

/** The activity_feed row for a finished workout. Posted later, if the user shares it (commitFeedPost). */
export function buildFeedPayload(saved: ActiveExercise[], ctx: FeedContext): Record<string, any> {
  const { userId, workoutId, duration, totalVolume, totalSets, ghostUserName } = ctx;

  // Routine context
  let routineFeedData: Record<string, any> = {};
  if (ctx.routineId) {
    const routine = useRoutineStore.getState().routines.find((r) => r.id === ctx.routineId);
    if (routine) routineFeedData = { routine_name: routine.name };
  }

  // Program context
  let programFeedData: Record<string, any> = {};
  if (ctx.programId) {
    const { programs, getDurationWeeks } = useProgramStore.getState();
    const prog = programs.find((p) => p.id === ctx.programId);
    if (prog) {
      // The day the workout was started on, as saved on the workout row
      const dayEntry = prog.days.find((d) => d.day_of_week === ctx.programDayOfWeek);
      programFeedData = {
        program_id: prog.id,
        program_name: prog.name,
        program_week: ctx.programWeek,
        program_total_weeks: getDurationWeeks(prog) || null,
        program_day_label: dayEntry?.label || null,
      };
    }
  }

  return {
    user_id: userId,
    workout_id: workoutId,
    duration,
    total_volume: Math.round(totalVolume),
    exercise_names: saved.map((ex) => ex.name),
    total_exercises: saved.length,
    total_sets: totalSets,
    // Per-exercise snapshot, so the feed never needs to read the workout's rows
    exercise_details: buildFeedExerciseDetails(saved, useWorkoutStore.getState().catalogMap),
    ...routineFeedData,
    ...programFeedData,
    ...(ghostUserName ? {
      ghost_username: ghostUserName,
      ghost_result: ghostVerdict(saved, ghostSetPositions(saved, ctx.liveExercises)),
      ghost_exercises: saved.map((ex) => ({
        name: ex.name,
        sets: ex.prevSets.map((ps: any) => ({ kg: ps.kg, reps: ps.reps })),
      })),
    } : {}),
  };
}

/** The saved exercises in the shape useRankStore.updateFromWorkout reads. */
export function toRankExercises(saved: ActiveExercise[]) {
  return saved.map((ex) => ({
    name: ex.name,
    exercise_type: ex.exercise_type,
    sets: ex.sets.map((s) => ({
      kg: parseFloat(s.kg) || 0,
      reps: parseInt(s.reps, 10) || 0,
      completed: s.completed,
      set_type: s.set_type,
    })),
  }));
}

/** The just-finished summary sheet's data. */
export function buildSummary(
  saved: ActiveExercise[],
  ctx: {
    workoutId: string; duration: number; totalVolume: number; totalSets: number; ghostUserName: string | null;
    /** The workout as logged, before buildWorkoutPayload dropped empty sets (for the ghost set positions). */
    liveExercises: ActiveExercise[];
  },
): WorkoutSummary {
  const positions = ctx.ghostUserName ? ghostSetPositions(saved, ctx.liveExercises) : [];
  const exercises: SummaryExercise[] = saved.map((ex) => ({
    name: ex.name,
    category: ex.category,
    exercise_type: ex.exercise_type,
    sets: ex.sets.map((s) => ({
      kg: parseFloat(s.kg) || 0,
      reps: parseInt(s.reps, 10) || 0,
      completed: s.completed,
      set_type: s.set_type,
      parent_set_number: s.parent_set_number,
    })),
  }));
  return {
    workoutId: ctx.workoutId,
    duration: ctx.duration,
    totalVolume: Math.round(ctx.totalVolume),
    totalSets: ctx.totalSets,
    totalExercises: saved.length,
    exerciseNames: saved.map((ex) => ex.name),
    exercises,
    prCount: 0,
    ghostUserName: ctx.ghostUserName || null,
    ghostExercises: ctx.ghostUserName ? saved.map((ex, k) => ({
      name: ex.name,
      sets: ex.prevSets.map((s) => ({ kg: s.kg, reps: s.reps })),
      setPositions: positions[k],
    })) : undefined,
    prevMap: { ...useWorkoutStore.getState().prevMap },
  };
}
