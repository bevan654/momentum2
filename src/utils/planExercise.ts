/** An exercise in a routine or a program day, as both editors save it. */
export interface PlanExercise {
  name: string;
  exercise_order: number;
  default_sets: number;
  default_reps: number;
  default_rest_seconds: number;
  set_reps: number[];
  set_weights: number[];
  exercise_type: string;
}

/** The columns `routine_exercises` and `program_day_exercises` share. Add the parent id to get a row. */
export function planExerciseColumns(e: PlanExercise): PlanExercise {
  return {
    name: e.name,
    exercise_order: e.exercise_order,
    default_sets: e.default_sets,
    default_reps: e.default_reps,
    default_rest_seconds: e.default_rest_seconds,
    set_reps: e.set_reps,
    set_weights: e.set_weights,
    exercise_type: e.exercise_type,
  };
}
