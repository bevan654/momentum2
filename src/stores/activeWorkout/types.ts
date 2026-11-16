

// ── Types ──────────────────────────────────────────────

export interface ActiveSet {
  kg: string;
  reps: string;
  completed: boolean;
  set_type: 'working' | 'warmup' | 'drop' | 'failure';
  parent_set_number: number | null;
  /** When the set was ticked off (ms). Cleared when it's unticked. */
  completedAt?: number | null;
  /** The weight and reps the app suggested when the set was ticked off. */
  target?: { kg: number; reps: number; source: 'progression' | 'previous' } | null;
}

export interface ActiveExercise {
  /** Stable per-session id, used as the React key so cards survive reorder/remove. */
  id: string;
  name: string;
  exercise_type: 'weighted' | 'bodyweight' | 'duration' | 'weighted+bodyweight';
  category: string | null;
  sets: ActiveSet[];
  prevSets: { kg: number; reps: number }[];
  supersetWith: number | null;
  notes?: string;
  /** Color tag for today's note: 'green' | 'orange' | 'red' (undefined = none) */
  noteColor?: string;
  /** Note history from previous sessions, newest first (read-only) */
  prevNotes?: { note: string; date: string; color?: string }[];
}

interface GhostExerciseData {
  name: string;
  sets: { kg: number; reps: number }[];
  /** For each set of the matching summary exercise, its position in the workout as it was logged
   * (before empty sets were dropped). Ghost sets are compared at that position, like the live tally. */
  setPositions?: number[];
}

export interface SummaryExercise {
  name: string;
  category: string | null;
  exercise_type: string;
  sets: { kg: number; reps: number; completed: boolean; set_type: string; parent_set_number: number | null }[];
}

export interface WorkoutSummary {
  workoutId?: string;
  duration: number;
  totalVolume: number;
  totalSets: number;
  totalExercises: number;
  exerciseNames: string[];
  exercises: SummaryExercise[];
  prCount: number;
  ghostUserName?: string | null;
  ghostExercises?: GhostExerciseData[];
  /** Snapshot of prevMap at finish time so background refetches don't overwrite it */
  prevMap?: Record<string, { kg: number; reps: number }[]>;
}

/** The user's preferred rest length (what each new rest starts at). */
export type RestAnchor = { exerciseIndex: number; setIndex: number } | null;

// ── Store interface ────────────────────────────────────

export interface ActiveWorkoutState {
  isActive: boolean;
  sheetVisible: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  exercises: ActiveExercise[];

  /** Seconds from restStartedAt until the current rest ends (restStartedAt + restDuration = end). */
  restDuration: number;
  restRemaining: number;
  restStartedAt: number | null;
  isResting: boolean;
  /** Full length of the current rest incl. ±15s adjustments — for the progress bar only. */
  restTotal: number;
  /** When the last rest ran out on its own (not skipped) — drives the "rest done" moment. */
  restEndedAt: number | null;
  /** Routine / program-day name shown in the header; null = plain workout. */
  workoutTitle: string | null;
  /** The set whose completion started the current/last rest — the inline rest row renders under it. */
  restAnchor: RestAnchor;

  // Summary + share
  showSummary: boolean;
  summaryData: WorkoutSummary | null;
  pendingFeedPayload: Record<string, any> | null;

  startedFromRoutine: string | null;
  startedFromProgram: string | null;
  programWeek: number | null;
  ghostUserName: string | null;
  /** The workout's id in the database, generated when it starts so saving it twice can't duplicate it. */
  workoutId: string | null;
  /** 'replace' after Undo: the workout is already saved, and finishing again overwrites it. */
  saveMode: 'create' | 'replace';

  // Workout lifecycle
  startWorkout: () => void;
  startFromRoutine: (
    routine: { id: string; name?: string; exercises: { name: string; default_sets: number; exercise_type: string }[] },
    catalogMap: Record<string, { category: string; exercise_type: string }>,
    prevMap: Record<string, { kg: number; reps: number }[]>,
    ghostUserName?: string,
  ) => void;
  startFromProgram: (
    routine: { id: string; name?: string; exercises: { name: string; default_sets: number; exercise_type: string }[] },
    catalogMap: Record<string, { category: string; exercise_type: string }>,
    prevMap: Record<string, { kg: number; reps: number }[]>,
    programId: string,
    programWeek: number,
  ) => void;
  discardWorkout: () => void;
  /** True while Finish is saving; starts, discards and edits are ignored until it settles. */
  isSaving: () => boolean;
  finishWorkout: (userId: string, durationOverride?: number) => Promise<{
    error: string | null;
    incompleteCount?: number;
    workoutId?: string;
  }>;
  restoreWorkout: () => Promise<void>;
  /** Signing out: drop the in-memory workout (its saved copy stays for the same account). */
  resetForSignOut: () => void;
  showSheet: () => void;
  hideSheet: () => void;
  dismissSummary: () => void;
  commitFeedPost: (opts?: {
    visibility?: 'public' | 'friends' | 'private';
    title?: string;
    caption?: string;
  }) => Promise<void>;
  undoFinish: () => void;

  // Exercise management
  addExercise: (name: string, exerciseType: string, category: string | null, prevSets?: { kg: number; reps: number }[]) => void;
  removeExercise: (index: number) => void;
  replaceExercise: (index: number, name: string, exerciseType: string, category: string | null, prevSets: { kg: number; reps: number }[]) => void;
  moveExercise: (fromIndex: number, direction: 'up' | 'down') => void;
  cycleExerciseType: (index: number) => void;
  setExerciseNotes: (index: number, notes: string) => void;
  setExerciseNoteColor: (index: number, color: string | undefined) => void;

  // Set management
  addSet: (exerciseIndex: number) => void;
  addDropSet: (exerciseIndex: number, parentSetIndex: number) => void;
  duplicateSet: (exerciseIndex: number, setIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: 'kg' | 'reps', value: string) => void;
  toggleSetComplete: (exerciseIndex: number, setIndex: number) => void;
  cycleSetType: (exerciseIndex: number, setIndex: number) => void;

  // Superset
  linkSuperset: (exerciseIndex: number) => void;
  unlinkSuperset: (exerciseIndex: number) => void;

  // Rest timer
  setRestDuration: (seconds: number) => void;
  startRest: () => void;
  stopRest: () => void;
  /** Add or remove time from the running rest (e.g. ±15s). Ending at ≤0 stops the rest. */
  adjustRest: (deltaSeconds: number) => void;
  tick: () => void;

  // Internal
  _persist: () => void;
}

export type FinishResult = { error: string | null; incompleteCount?: number; workoutId?: string };

/** The workout as it was when finished, so Undo can reopen it exactly (same id, sets, notes, context). */
export type UndoSnapshot = Pick<
  ActiveWorkoutState,
  'exercises' | 'startTime' | 'restDuration' | 'workoutTitle' | 'startedFromRoutine' | 'startedFromProgram' | 'programWeek' | 'ghostUserName'
> & { workoutId: string };
