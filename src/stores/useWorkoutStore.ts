import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const CATALOG_CACHE_KEY = 'exercise_catalog_cache_v3';
const CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface SetData {
  id: string;
  set_number: number;
  kg: number;
  reps: number;
  completed: boolean;
  set_type: string | null;
  parent_set_number: number | null;
  isPR: boolean;
}

export interface ExerciseWithSets {
  id: string;
  name: string;
  exercise_order: number;
  exercise_type: string;
  sets: SetData[];
  hasPR: boolean;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}

export interface WorkoutWithDetails {
  id: string;
  created_at: string;
  duration: number;
  total_exercises: number;
  total_sets: number;
  completedSets: number;
  exercises: ExerciseWithSets[];
  totalReps: number;
  totalVolume: number;
  prCount: number;
  muscleGroups: string[];
  ghostUsername: string | null;
  programName: string | null;
  coachHeadline: string | null;
  coachSummary: string | null;
}

export interface CatalogEntry {
  category: string;
  exercise_type: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  is_main_lift: boolean;
  ranking_weight: number;
  is_bodyweight: boolean;
  allows_external_weight: boolean;
}

interface CreateUserExerciseParams {
  userId: string;
  name: string;
  category: string;
  exerciseType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
}

interface WorkoutState {
  workouts: WorkoutWithDetails[];
  loading: boolean;
  catalogMap: Record<string, CatalogEntry>;
  aliasMap: Record<string, string>; // alias → canonical_name
  prevMap: Record<string, { kg: number; reps: number }[]>;
  /** Note history per exercise name, newest first (best-effort; empty until `notes` column exists) */
  prevNoteMap: Record<string, { note: string; date: string; color?: string }[]>;
  fetchWorkoutHistory: (userId: string) => Promise<void>;
  fetchExerciseCatalog: (userId: string, forceRefresh?: boolean) => Promise<void>;
  fetchPrevData: (userId: string) => Promise<void>;
  fetchWorkoutById: (workoutId: string, userId: string) => Promise<WorkoutWithDetails | null>;
  createUserExercise: (params: CreateUserExerciseParams) => Promise<boolean>;
  deleteWorkout: (workoutId: string) => Promise<boolean>;
  /** Release heavy caches (call on signOut to free memory) */
  clearCaches: () => void;
}

// TODO(sample): temporary 30-entry note history for the dumbbell row so the
// "View all N notes" modal is demonstrable. Remove once real data exists.
const SAMPLE_PREV_NOTES: { note: string; date: string; color?: string }[] = (() => {
  const entries = [
    { note: 'Felt strong — go up to 32.5kg next time. Keep elbow tucked, no shrugging.', color: 'green' },
    { note: '30kg x8/8/7 — last set was a grind. Form held up well.', color: 'orange' },
    { note: 'Right side lagging, focus on the squeeze at the top.', color: 'orange' },
    { note: 'First time back after the layoff. 27.5kg felt easy, ramp up.', color: 'green' },
    { note: 'Slowed the eccentric — much better lat connection.', color: 'green' },
    { note: 'Grip gave out before the back did. Try straps next week.', color: 'orange' },
    { note: 'Felt a tweak in the lower back, kept it light and strict.', color: 'red' },
    { note: 'New PR for reps at 30kg. Stoked.', color: 'green' },
  ];
  const base = new Date('2026-05-24T00:00:00Z').getTime();
  const DAY = 86_400_000;
  return Array.from({ length: 30 }, (_, i) => ({
    note: entries[i % entries.length].note,
    color: entries[i % entries.length].color,
    date: new Date(base - i * 7 * DAY).toISOString().slice(0, 10),
  }));
})();

// TODO(sample): temporary demo notes for cable face pull. Remove with the rest
// of the sample data once real notes exist.
const SAMPLE_FACE_PULL_NOTES: { note: string; date: string; color?: string }[] = [
  { note: 'Light and controlled — really felt the rear delts. Pause at the face each rep.', date: '2026-05-28', color: 'green' },
  { note: 'Went too heavy and it turned into a row. Drop the weight next time.', date: '2026-05-21', color: 'red' },
  { note: 'Good pump. The external-rotation cue at the end helped a lot.', date: '2026-05-14', color: 'green' },
];

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  workouts: [],
  loading: false,
  catalogMap: {},
  aliasMap: {},
  prevMap: {},
  // TODO(sample): temporary demo note history (see SAMPLE_PREV_NOTES above) so
  // the previous-notes UI is visible before the `notes` column / real data
  // exists. Remove once real data is seeded.
  prevNoteMap: {
    'bent over dumbbell row': SAMPLE_PREV_NOTES,
    'dumbbell row': SAMPLE_PREV_NOTES,
    'cable face pull': SAMPLE_FACE_PULL_NOTES,
    'face pull': SAMPLE_FACE_PULL_NOTES,
  },

  fetchExerciseCatalog: async (userId: string, forceRefresh = false) => {
    const parseArr = (v: any): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch {}
        // PostgreSQL array literal: {shoulders,triceps}
        if (v.startsWith('{') && v.endsWith('}')) {
          return v.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^"|"$/g, ''));
        }
      }
      return [];
    };

    const toBool = (v: any, fallback: boolean) =>
      v === true || v === 'true' ? true : v === false || v === 'false' ? false : fallback;

    const deriveExerciseType = (e: any): string => {
      if (e.exercise_type) return e.exercise_type;
      const bw = toBool(e.is_bodyweight, false);
      const ext = toBool(e.allows_external_weight, true);
      if (bw && ext) return 'weighted+bodyweight';
      if (bw) return 'bodyweight';
      return 'weighted';
    };

    const toEntry = (e: any): CatalogEntry => ({
      category: e.category,
      exercise_type: deriveExerciseType(e),
      primary_muscles: parseArr(e.primary_muscles),
      secondary_muscles: parseArr(e.secondary_muscles),
      is_main_lift: toBool(e.is_main_lift, false),
      ranking_weight: Number(e.ranking_weight) || 0.3,
      is_bodyweight: toBool(e.is_bodyweight, false),
      allows_external_weight: toBool(e.allows_external_weight, true),
    });

    const buildMap = (catalogData: any[] | null, userData: any[] | null) => {
      const map: Record<string, CatalogEntry> = {};
      if (catalogData) {
        for (const e of catalogData) map[e.name] = toEntry(e);
      }
      if (userData) {
        for (const e of userData) map[e.name] = toEntry(e);
      }
      return map;
    };

    // 1. Load from cache immediately so the picker is usable right away (skip if force refresh)
    if (!forceRefresh) {
      try {
        const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.userId === userId && cached.map && Object.keys(cached.map).length > 0) {
            set({ catalogMap: cached.map, aliasMap: cached.aliasMap || {} });
            // If cache is fresh, skip network fetch
            if (Date.now() - (cached.ts || 0) < CATALOG_TTL) return;
          }
        }
      } catch {}
    }

    // 2. Fetch from Supabase
    try {
      const [catalogRes, userRes, aliasRes] = await Promise.all([
        supabase.from('exercises_catalog').select('*'),
        supabase.from('user_exercises').select('*').eq('user_id', userId),
        supabase.from('exercise_aliases').select('alias, canonical_name'),
      ]);

      const map = buildMap(catalogRes.data, userRes.data);

      // Inject aliases into catalogMap so all lookups resolve automatically
      const aMap: Record<string, string> = {};
      if (aliasRes.data) {
        for (const row of aliasRes.data) {
          const canonical = map[row.canonical_name];
          if (canonical) {
            map[row.alias] = canonical;
          }
          aMap[row.alias] = row.canonical_name;
        }
      }

      if (Object.keys(map).length > 0) {
        set({ catalogMap: map, aliasMap: aMap });
        // 3. Persist to cache
        AsyncStorage.setItem(
          CATALOG_CACHE_KEY,
          JSON.stringify({ userId, map, aliasMap: aMap, ts: Date.now() }),
        ).catch(() => {});
      }
    } catch (err) {
      console.error('[catalog] fetch failed:', err);
    }
  },

  fetchPrevData: async (userId: string) => {
    // Fetch recent workouts (newest first) with their exercises + sets
    const { data: workouts } = await supabase
      .from('workouts')
      .select('created_at, exercises(name, sets(kg, reps, set_number, completed))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const map: Record<string, { kg: number; reps: number }[]> = {};
    if (workouts) {
      // Workouts are already newest-first, so first occurrence per name is most recent
      for (const w of workouts) {
        for (const ex of (w.exercises || []) as any[]) {
          if (map[ex.name]) continue;
          const sets = (ex.sets || [])
            .filter((s: any) => s.completed)
            .sort((a: any, b: any) => a.set_number - b.set_number)
            .map((s: any) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }));
          if (sets.length > 0) {
            map[ex.name] = sets;
          }
        }
      }
    }
    set({ prevMap: map });

    // Best-effort: most-recent note per exercise. Separate query so a missing
    // `notes` column can't break the critical prevMap above. No-op until the
    // column exists (the select simply errors and we keep an empty map).
    try {
      const { data: noteWorkouts, error } = await supabase
        .from('workouts')
        .select('created_at, exercises(name, notes, note_color)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && noteWorkouts) {
        // Workouts are newest-first, so notes accumulate in that order.
        const noteMap: Record<string, { note: string; date: string; color?: string }[]> = {};
        for (const w of noteWorkouts as any[]) {
          for (const ex of (w.exercises || []) as any[]) {
            const note = (ex.notes ?? '').trim();
            if (!note) continue;
            (noteMap[ex.name] ||= []).push({ note, date: w.created_at, color: ex.note_color ?? undefined });
          }
        }
        set({ prevNoteMap: noteMap });
      }
    } catch {}
  },

  fetchWorkoutHistory: async (userId: string) => {
    set({ loading: true });
    try {
      const { data: workoutsData } = await supabase
        .from('workouts')
        .select('id, created_at, duration, total_exercises, total_sets, ghost_username, program_id, programs(name), coach_headline, coach_summary')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!workoutsData || workoutsData.length === 0) {
        set({ workouts: [], loading: false });
        return;
      }

      const workoutIds = workoutsData.map((w) => w.id);

      const { data: exercisesData } = await supabase
        .from('exercises')
        .select('id, workout_id, name, exercise_order, exercise_type, sets(id, set_number, kg, reps, completed, set_type, parent_set_number)')
        .in('workout_id', workoutIds)
        .order('exercise_order', { ascending: true });

      // Build exercise map keyed by workout_id
      const exercisesByWorkout: Record<string, any[]> = {};
      if (exercisesData) {
        for (const ex of exercisesData) {
          const wid = (ex as any).workout_id;
          if (!exercisesByWorkout[wid]) exercisesByWorkout[wid] = [];
          exercisesByWorkout[wid].push(ex);
        }
      }

      // Build historical max map for PR detection
      // Process workouts oldest-first
      const sortedWorkouts = [...workoutsData].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const historicalMax: Record<string, number> = {}; // exercise name → max kg
      const prMap: Record<string, Record<string, boolean>> = {}; // workout_id → set_id → isPR

      for (const w of sortedWorkouts) {
        const exercises = exercisesByWorkout[w.id] || [];
        prMap[w.id] = {};
        for (const ex of exercises) {
          const sets = ex.sets || [];
          const prevMax = historicalMax[ex.name] ?? 0;

          // Find the heaviest completed set for this exercise in this workout
          let bestSetId: string | null = null;
          let bestKg = 0;
          for (const s of sets) {
            if (!s.completed) continue;
            const kg = Number(s.kg) || 0;
            if (kg > bestKg) {
              bestKg = kg;
              bestSetId = s.id;
            }
          }

          // Only mark it as a PR if it actually beats the previous best
          if (bestSetId && bestKg > 0 && bestKg > prevMax) {
            prMap[w.id][bestSetId] = true;
          }

          // Update historical max after processing the exercise
          if (bestKg > prevMax) {
            historicalMax[ex.name] = bestKg;
          }
        }
      }

      const { catalogMap } = get();

      // Build final workout list in original order (newest first)
      const workouts: WorkoutWithDetails[] = workoutsData.map((w) => {
        const rawExercises = exercisesByWorkout[w.id] || [];
        let totalReps = 0;
        let totalVolume = 0;
        let prCount = 0;
        let completedSets = 0;
        const muscleGroupSet = new Set<string>();

        const exercises: ExerciseWithSets[] = rawExercises.map((ex) => {
          const catEntry = catalogMap[ex.name];
          const category = catEntry?.category || null;
          const primary_muscles = catEntry?.primary_muscles || [];
          const secondary_muscles = catEntry?.secondary_muscles || [];
          if (category) muscleGroupSet.add(category);

          let exerciseHasPR = false;
          const sets: SetData[] = (ex.sets || []).map((s: any) => {
            const kg = Number(s.kg) || 0;
            const reps = Number(s.reps) || 0;
            if (s.completed) {
              totalReps += reps;
              totalVolume += kg * reps;
              completedSets++;
            }
            const isPR = !!prMap[w.id]?.[s.id];
            if (isPR) {
              prCount++;
              exerciseHasPR = true;
            }
            return {
              id: s.id,
              set_number: s.set_number,
              kg,
              reps,
              completed: s.completed,
              set_type: s.set_type,
              parent_set_number: s.parent_set_number ?? null,
              isPR,
            };
          });

          return {
            id: ex.id,
            name: ex.name,
            exercise_order: ex.exercise_order,
            exercise_type: ex.exercise_type,
            sets,
            hasPR: exerciseHasPR,
            category,
            primary_muscles,
            secondary_muscles,
          };
        });

        return {
          id: w.id,
          created_at: w.created_at,
          duration: w.duration || 0,
          total_exercises: w.total_exercises || exercises.length,
          total_sets: w.total_sets || exercises.reduce((n, e) => n + e.sets.length, 0),
          completedSets,
          exercises,
          totalReps,
          totalVolume: Math.round(totalVolume),
          prCount,
          muscleGroups: Array.from(muscleGroupSet).slice(0, 4),
          ghostUsername: (w as any).ghost_username || null,
          programName: (w as any).programs?.name || null,
          coachHeadline: (w as any).coach_headline || null,
          coachSummary: (w as any).coach_summary || null,
        };
      });

      set({ workouts });
    } finally {
      set({ loading: false });
    }
  },

  fetchWorkoutById: async (workoutId: string, userId: string) => {
    try {
      // Fetch the workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('id, created_at, duration, total_exercises, total_sets, ghost_username, coach_headline, coach_summary, programs(name)')
        .eq('id', workoutId)
        .single();

      if (!workoutData) {
        return null;
      }

      // Fetch exercises for this workout
      const { data: exercisesData } = await supabase
        .from('exercises')
        .select('id, workout_id, name, exercise_order, exercise_type, sets(id, set_number, kg, reps, completed, set_type, parent_set_number)')
        .eq('workout_id', workoutId)
        .order('exercise_order', { ascending: true });

      if (!exercisesData) return null;

      // Build historical max for PR detection (need all workouts before this one from the same user)
      // First get the workout's owner
      const { data: workoutOwnerData } = await supabase
        .from('workouts')
        .select('user_id')
        .eq('id', workoutId)
        .single();

      const workoutOwnerId = workoutOwnerData?.user_id || userId;

      const { data: allWorkoutsData } = await supabase
        .from('workouts')
        .select('id, created_at')
        .eq('user_id', workoutOwnerId)
        .lt('created_at', workoutData.created_at)
        .order('created_at', { ascending: false })
        .limit(200);

      const olderWorkoutIds = (allWorkoutsData || []).map((w) => w.id);

      let historicalMax: Record<string, number> = {};
      if (olderWorkoutIds.length > 0) {
        const { data: olderExercises } = await supabase
          .from('exercises')
          .select('name, sets(kg, completed)')
          .in('workout_id', olderWorkoutIds);

        if (olderExercises) {
          for (const ex of olderExercises) {
            const sets = ex.sets || [];
            for (const s of sets) {
              if (!s.completed) continue;
              const kg = Number(s.kg) || 0;
              const prevMax = historicalMax[ex.name] ?? 0;
              if (kg > prevMax) {
                historicalMax[ex.name] = kg;
              }
            }
          }
        }
      }

      // Detect PRs for this workout
      const prMap: Record<string, boolean> = {};
      for (const ex of exercisesData) {
        const sets = ex.sets || [];
        const prevMax = historicalMax[ex.name] ?? 0;

        let bestSetId: string | null = null;
        let bestKg = 0;
        for (const s of sets) {
          if (!s.completed) continue;
          const kg = Number(s.kg) || 0;
          if (kg > bestKg) {
            bestKg = kg;
            bestSetId = s.id;
          }
        }

        if (bestSetId && bestKg > 0 && bestKg > prevMax) {
          prMap[bestSetId] = true;
        }
      }

      const { catalogMap } = get();

      // Build workout details
      let totalReps = 0;
      let totalVolume = 0;
      let prCount = 0;
      let completedSets = 0;
      const muscleGroupSet = new Set<string>();

      const exercises: ExerciseWithSets[] = exercisesData.map((ex) => {
        const catEntry = catalogMap[ex.name];
        const category = catEntry?.category || null;
        const primary_muscles = catEntry?.primary_muscles || [];
        const secondary_muscles = catEntry?.secondary_muscles || [];
        if (category) muscleGroupSet.add(category);

        let exerciseHasPR = false;
        const sets: SetData[] = (ex.sets || []).map((s: any) => {
          const kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          if (s.completed) {
            totalReps += reps;
            totalVolume += kg * reps;
            completedSets++;
          }
          const isPR = !!prMap[s.id];
          if (isPR) {
            prCount++;
            exerciseHasPR = true;
          }
          return {
            id: s.id,
            set_number: s.set_number,
            kg,
            reps,
            completed: s.completed,
            set_type: s.set_type,
            parent_set_number: s.parent_set_number ?? null,
            isPR,
          };
        });

        return {
          id: ex.id,
          name: ex.name,
          exercise_order: ex.exercise_order,
          exercise_type: ex.exercise_type,
          sets,
          hasPR: exerciseHasPR,
          category,
          primary_muscles,
          secondary_muscles,
        };
      });

      return {
        id: workoutData.id,
        created_at: workoutData.created_at,
        duration: workoutData.duration || 0,
        total_exercises: workoutData.total_exercises || exercises.length,
        total_sets: workoutData.total_sets || exercises.reduce((n, e) => n + e.sets.length, 0),
        completedSets,
        exercises,
        totalReps,
        totalVolume: Math.round(totalVolume),
        prCount,
        muscleGroups: Array.from(muscleGroupSet).slice(0, 4),
        ghostUsername: (workoutData as any).ghost_username || null,
        programName: (workoutData as any).programs?.name || null,
        coachHeadline: (workoutData as any).coach_headline || null,
        coachSummary: (workoutData as any).coach_summary || null,
      };
    } catch {
      return null;
    }
  },

  createUserExercise: async (params: CreateUserExerciseParams) => {
    const { userId, name, category, exerciseType, primaryMuscles, secondaryMuscles, equipment } = params;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const isBw = exerciseType === 'bodyweight' || exerciseType === 'weighted+bodyweight';
    const allowsExt = exerciseType !== 'bodyweight';

    const { error } = await supabase.from('user_exercises').insert({
      user_id: userId,
      name,
      slug,
      category,
      exercise_type: exerciseType,
      primary_muscles: primaryMuscles,
      secondary_muscles: secondaryMuscles,
      equipment,
    });

    if (error) {
      console.error('[createUserExercise] insert failed:', error.message, error.code);
      throw new Error(error.message);
    }

    // Update catalogMap in memory
    const { catalogMap } = get();
    set({
      catalogMap: {
        ...catalogMap,
        [name]: {
          category,
          exercise_type: exerciseType,
          primary_muscles: primaryMuscles,
          secondary_muscles: secondaryMuscles,
          is_main_lift: false,
          ranking_weight: 0.3,
          is_bodyweight: isBw,
          allows_external_weight: allowsExt,
        },
      },
    });

    // Invalidate cache so next fetch pulls fresh data
    AsyncStorage.removeItem(CATALOG_CACHE_KEY).catch(() => {});

    return true;
  },

  clearCaches: () => {
    set({ catalogMap: {}, aliasMap: {}, prevMap: {}, prevNoteMap: {}, workouts: [] });
    AsyncStorage.removeItem(CATALOG_CACHE_KEY).catch(() => {});
  },

  deleteWorkout: async (workoutId: string) => {
    try {
      // Delete from Supabase — exercises & sets cascade via foreign keys
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId);

      if (error) return false;

      // Remove from local state
      const { workouts } = get();
      set({ workouts: workouts.filter((w) => w.id !== workoutId) });
      return true;
    } catch {
      return false;
    }
  },
}));
