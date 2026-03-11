import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/* ─── Types ──────────────────────────────────────────── */

export interface ProgramDayExercise {
  name: string;
  exercise_order: number;
  default_sets: number;
  default_reps: number;
  default_rest_seconds: number;
  set_reps: number[];
  set_weights: number[];
  exercise_type: string;
}

export interface ProgramDay {
  id?: string;
  day_of_week: number;       // 0=Mon, 1=Tue, ..., 6=Sun
  label: string;             // "Push", "Pull", etc.
  exercises: ProgramDayExercise[];
}

export interface Program {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'active' | 'completed' | 'abandoned';
  started_at: string | null;
  completed_at: string | null;
  days: ProgramDay[];
  created_at: string;
  updated_at: string;
}

export interface ProgramProgressEntry {
  week: number;
  day_of_week: number;
  workout_id: string;
  created_at: string;
  duration: number;
  total_volume: number;
  total_sets: number;
  exercises: { name: string; sets: { kg: number; reps: number }[] }[];
}

/* ─── Day-editor bridge (module-level, avoids route-param serialisation) ── */

interface DayEditInput {
  dayIndex: number;
  dayName: string;
  label: string;
  exercises: ProgramDayExercise[];
}

let _dayEditInput: DayEditInput | null = null;
let _dayEditResult: { dayIndex: number; label: string; exercises: ProgramDayExercise[] } | null = null;

export function startDayEdit(input: DayEditInput) {
  _dayEditInput = input;
  _dayEditResult = null;
}
export function getDayEditInput() {
  return _dayEditInput;
}
export function saveDayEdit(label: string, exercises: ProgramDayExercise[]) {
  if (_dayEditInput) _dayEditResult = { dayIndex: _dayEditInput.dayIndex, label, exercises };
}
export function consumeDayEditResult() {
  const r = _dayEditResult;
  _dayEditResult = null;
  _dayEditInput = null;
  return r;
}

/* ─── Store ──────────────────────────────────────────── */

interface ProgramState {
  programs: Program[];
  activeProgram: Program | null;
  progressData: ProgramProgressEntry[];
  loading: boolean;

  // CRUD
  fetchPrograms: (userId: string) => Promise<void>;
  createProgram: (
    userId: string,
    name: string,
    startDate: string | null,
    endDate: string | null,
    days: ProgramDay[],
  ) => Promise<{ error: string | null }>;
  updateProgram: (
    programId: string,
    name: string,
    startDate: string | null,
    endDate: string | null,
    days: ProgramDay[],
  ) => Promise<{ error: string | null }>;
  deleteProgram: (programId: string) => Promise<{ error: string | null }>;

  // Lifecycle
  startProgram: (programId: string) => Promise<{ error: string | null }>;
  completeProgram: (programId: string) => Promise<{ error: string | null }>;
  abandonProgram: (programId: string) => Promise<{ error: string | null }>;

  // Progress
  fetchProgress: (programId: string, userId: string) => Promise<void>;
  getTodaysRoutine: () => { label: string; day_of_week: number; exercises: ProgramDayExercise[] } | null;
  getCurrentWeek: () => number;
  getDurationWeeks: (program?: Program | null) => number;
}

export const useProgramStore = create<ProgramState>((set, get) => ({
  programs: [],
  activeProgram: null,
  progressData: [],
  loading: false,

  /* ─── Fetch all programs ───────────────────────────── */

  fetchPrograms: async (userId: string) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('programs')
        .select('*, program_days(*, program_day_exercises(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        const programs: Program[] = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          start_date: p.start_date,
          end_date: p.end_date,
          status: p.status,
          started_at: p.started_at,
          completed_at: p.completed_at,
          days: (p.program_days || [])
            .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
            .map((d: any) => ({
              id: d.id,
              day_of_week: d.day_of_week,
              label: d.label || 'Workout',
              exercises: (d.program_day_exercises || [])
                .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                .map((e: any) => ({
                  name: e.name,
                  exercise_order: e.exercise_order,
                  default_sets: e.default_sets ?? 3,
                  default_reps: e.default_reps ?? 10,
                  default_rest_seconds: e.default_rest_seconds ?? 90,
                  set_reps: Array.isArray(e.set_reps) ? e.set_reps : [],
                  set_weights: Array.isArray(e.set_weights) ? e.set_weights : [],
                  exercise_type: e.exercise_type || 'weighted',
                })),
            })),
          created_at: p.created_at,
          updated_at: p.updated_at,
        }));

        const activeProgram = programs.find((p) => p.status === 'active') || null;
        set({ programs, activeProgram });
      }
    } finally {
      set({ loading: false });
    }
  },

  /* ─── Create program ───────────────────────────────── */

  createProgram: async (userId, name, startDate, endDate, days) => {
    try {
      const { data: program, error } = await supabase
        .from('programs')
        .insert({ user_id: userId, name, start_date: startDate, end_date: endDate })
        .select('id')
        .single();

      if (error || !program) {
        console.error('Create program error:', error);
        return { error: error?.message || 'Failed to create program' };
      }

      for (const day of days) {
        const { data: dayRow, error: dayErr } = await supabase
          .from('program_days')
          .insert({
            program_id: program.id,
            day_of_week: day.day_of_week,
            label: day.label,
          })
          .select('id')
          .single();

        if (dayErr || !dayRow) {
          console.error('Insert program_day error:', dayErr);
          continue;
        }

        if (day.exercises.length > 0) {
          const rows = day.exercises.map((e) => ({
            program_day_id: dayRow.id,
            name: e.name,
            exercise_order: e.exercise_order,
            default_sets: e.default_sets,
            default_reps: e.default_reps,
            default_rest_seconds: e.default_rest_seconds,
            set_reps: e.set_reps,
            set_weights: e.set_weights,
            exercise_type: e.exercise_type,
          }));
          const { error: exErr } = await supabase.from('program_day_exercises').insert(rows);
          if (exErr) console.error('Insert program_day_exercises error:', exErr);
        }
      }

      await get().fetchPrograms(userId);
      return { error: null };
    } catch (e: any) {
      console.error('createProgram exception:', e);
      return { error: e?.message || 'Unexpected error' };
    }
  },

  /* ─── Update program ───────────────────────────────── */

  updateProgram: async (programId, name, startDate, endDate, days) => {
    const { error } = await supabase
      .from('programs')
      .update({ name, start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
      .eq('id', programId);

    if (error) return { error: error.message };

    // Delete all days (cascade deletes exercises)
    await supabase.from('program_days').delete().eq('program_id', programId);

    for (const day of days) {
      const { data: dayRow, error: dayErr } = await supabase
        .from('program_days')
        .insert({
          program_id: programId,
          day_of_week: day.day_of_week,
          label: day.label,
        })
        .select('id')
        .single();

      if (dayErr || !dayRow) continue;

      if (day.exercises.length > 0) {
        const rows = day.exercises.map((e) => ({
          program_day_id: dayRow.id,
          name: e.name,
          exercise_order: e.exercise_order,
          default_sets: e.default_sets,
          default_reps: e.default_reps,
          default_rest_seconds: e.default_rest_seconds,
          set_reps: e.set_reps,
          set_weights: e.set_weights,
          exercise_type: e.exercise_type,
        }));
        await supabase.from('program_day_exercises').insert(rows);
      }
    }

    return { error: null };
  },

  /* ─── Delete program ───────────────────────────────── */

  deleteProgram: async (programId: string) => {
    const prev = get().programs;
    set({ programs: prev.filter((p) => p.id !== programId) });

    const { error } = await supabase.from('programs').delete().eq('id', programId);
    if (error) {
      set({ programs: prev });
      return { error: error.message };
    }

    if (get().activeProgram?.id === programId) set({ activeProgram: null });
    return { error: null };
  },

  /* ─── Start program ────────────────────────────────── */

  startProgram: async (programId: string) => {
    const current = get().activeProgram;
    if (current && current.id !== programId) {
      return { error: 'Another program is already active. Abandon or complete it first.' };
    }

    const { error } = await supabase
      .from('programs')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', programId);

    if (error) return { error: error.message };

    const programs = get().programs.map((p) =>
      p.id === programId ? { ...p, status: 'active' as const, started_at: new Date().toISOString() } : p,
    );
    set({ programs, activeProgram: programs.find((p) => p.id === programId) || null });
    return { error: null };
  },

  /* ─── Complete program ─────────────────────────────── */

  completeProgram: async (programId: string) => {
    const { error } = await supabase
      .from('programs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', programId);

    if (error) return { error: error.message };

    const programs = get().programs.map((p) =>
      p.id === programId ? { ...p, status: 'completed' as const, completed_at: new Date().toISOString() } : p,
    );
    set({ programs, activeProgram: null });
    return { error: null };
  },

  /* ─── Abandon program ──────────────────────────────── */

  abandonProgram: async (programId: string) => {
    const { error } = await supabase
      .from('programs')
      .update({ status: 'draft', started_at: null })
      .eq('id', programId);

    if (error) return { error: error.message };

    const programs = get().programs.map((p) =>
      p.id === programId ? { ...p, status: 'draft' as const, started_at: null } : p,
    );
    set({ programs, activeProgram: null });
    return { error: null };
  },

  /* ─── Fetch progress for a program ─────────────────── */

  fetchProgress: async (programId: string, userId: string) => {
    const { data } = await supabase
      .from('workouts')
      .select('id, created_at, duration, total_sets, program_week, exercises(name, sets(kg, reps))')
      .eq('program_id', programId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!data) {
      set({ progressData: [] });
      return;
    }

    const entries: ProgramProgressEntry[] = data.map((w: any) => {
      const jsDay = new Date(w.created_at).getDay();
      const dow = jsDay === 0 ? 6 : jsDay - 1;

      return {
        week: w.program_week || 1,
        day_of_week: dow,
        workout_id: w.id,
        created_at: w.created_at,
        duration: w.duration,
        total_volume: (w.exercises || []).reduce((sum: number, ex: any) =>
          sum + (ex.sets || []).reduce((s: number, st: any) => s + (st.kg || 0) * (st.reps || 0), 0), 0),
        total_sets: w.total_sets,
        exercises: (w.exercises || []).map((ex: any) => ({
          name: ex.name,
          sets: (ex.sets || []).map((s: any) => ({ kg: s.kg || 0, reps: s.reps || 0 })),
        })),
      };
    });

    set({ progressData: entries });
  },

  /* ─── Get today's routine from active program ──────── */

  getTodaysRoutine: () => {
    const { activeProgram } = get();
    if (!activeProgram) return null;

    const jsDay = new Date().getDay();
    const dow = jsDay === 0 ? 6 : jsDay - 1;

    const todayEntry = activeProgram.days.find((d) => d.day_of_week === dow);
    if (!todayEntry || todayEntry.exercises.length === 0) return null;

    return {
      label: todayEntry.label,
      day_of_week: todayEntry.day_of_week,
      exercises: todayEntry.exercises,
    };
  },

  /* ─── Get current week number (1-based) ────────────── */

  getCurrentWeek: () => {
    const { activeProgram } = get();
    if (!activeProgram || !activeProgram.start_date) return 0;

    const started = new Date(activeProgram.start_date).getTime();
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const week = Math.ceil((now - started) / weekMs);
    const totalWeeks = get().getDurationWeeks(activeProgram);
    return Math.min(Math.max(week, 1), totalWeeks || 999);
  },

  /* ─── Compute duration in weeks from date range ────── */

  getDurationWeeks: (program?: Program | null) => {
    const p = program ?? get().activeProgram;
    if (!p || !p.start_date || !p.end_date) return 0;
    const start = new Date(p.start_date).getTime();
    const end = new Date(p.end_date).getTime();
    return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
  },
}));
