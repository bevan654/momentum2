import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { readUserScoped, writeUserScoped } from '../lib/userScopedStorage';
import { toLocalDateString } from '../utils/localDate';
import { useFoodLogStore } from './useFoodLogStore';

/**
 * Protein powder as a supplement: the user's powders (per-serving macros, `protein_powders`)
 * and each add (`protein_powder_log`), which also writes a snack to the food diary.
 *
 * A log row points at its diary row (`food_entry_id`, ON DELETE SET NULL), and only linked
 * rows are counted, so deleting the snack from the diary takes it off the serving count too.
 * The supplement itself (shown on Home, its goal in servings) is a `user_supplements` row with
 * the key below.
 */
export const PROTEIN_POWDER_KEY = 'protein_powder_servings';

export interface ProteinPowder {
  id: string;
  name: string;
  /** Per serving. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sort_order: number;
}

export type PowderInput = Pick<ProteinPowder, 'name' | 'calories' | 'protein' | 'carbs' | 'fat'>;

export interface PowderLog {
  id: string;
  powder_id: string | null;
  food_entry_id: string;
  /** Servings. */
  amount: number;
  date: string;
  created_at: string;
  /** The diary row's name (kept even if the powder has since been deleted). */
  name: string;
}

const LAST_POWDER_KEY = '@momentum_last_protein_powder';

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Total servings, rounded so 0.1 + 0.2 shows as 0.3. */
const sumServings = (logs: PowderLog[]) => Math.round(logs.reduce((n, l) => n + l.amount, 0) * 100) / 100;

function toPowder(row: any): ProteinPowder {
  return {
    id: row.id,
    name: row.name,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    sort_order: Number(row.sort_order) || 0,
  };
}

/**
 * Servings counted for an add: the diary snack's own servings while it is still in servings
 * (an edit in the diary changes those, not the log row), else the amount logged.
 */
function servingsOf(row: any, entry: any): number {
  if (entry && entry.serving_unit === 'serving' && entry.quantity != null) {
    const n = Number(entry.quantity) * (Number(entry.serving_size) || 1);
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
  }
  return Number(row.amount) || 0;
}

function toLog(row: any): PowderLog {
  const entry = Array.isArray(row.food_entries) ? row.food_entries[0] : row.food_entries;
  return {
    id: row.id,
    powder_id: row.powder_id,
    food_entry_id: row.food_entry_id,
    amount: servingsOf(row, entry),
    date: row.date,
    created_at: row.created_at,
    name: entry?.name || 'Protein powder',
  };
}

interface ProteinPowderState {
  powders: ProteinPowder[];
  powdersLoaded: boolean;
  /** The powder used last on this phone (preselected in the picker). */
  lastPowderId: string | null;
  /** Today's servings (linked log rows only). */
  todayServings: number;
  /** The adds of `logsDate` (the day the Nutrition tab shows), oldest first. */
  dateLogs: PowderLog[];
  logsDate: string | null;

  loadPowders: (userId: string) => Promise<void>;
  /** Returns the new powder, or null if it couldn't be saved. */
  addPowder: (userId: string, input: PowderInput) => Promise<ProteinPowder | null>;
  updatePowder: (userId: string, id: string, input: PowderInput) => Promise<boolean>;
  deletePowder: (userId: string, id: string) => Promise<boolean>;

  fetchToday: (userId: string) => Promise<void>;
  fetchDate: (userId: string, date: string) => Promise<void>;
  /** Reloads today and the day on the Nutrition tab (after the diary changed). */
  refresh: (userId: string) => void;
  /** Logs servings of a powder now: a snack in the diary plus a log row. False if it failed. */
  logServings: (userId: string, powder: ProteinPowder, servings: number, mealSlot: string) => Promise<boolean>;
  /** Removes one add and its diary snack. */
  deleteLog: (userId: string, log: PowderLog) => Promise<boolean>;
  /** Removes today's most recent add (a second tap while one runs is ignored). */
  undoLast: (userId: string) => Promise<void>;
  /** Re-links adds to their snacks after the diary's Undo put the snacks back (same ids). */
  relink: (userId: string, links: { logId: string; foodEntryId: string }[]) => Promise<void>;
  resetForSignOut: () => void;
}

/** Bumped on sign-out (and per load), so a response for an older request is ignored. */
let _gen = 0;
let _todayReq = 0;
let _dateReq = 0;
/** Bumped by every add or delete, so a count load that started before it doesn't overwrite it. */
let _writeSeq = 0;
/** Adds and deletes still saving. A load landing meanwhile may miss them: it reloads after. */
let _pending = 0;
let _reloadFor: string | null = null;
let _undoing = false;

/** Runs a write while counting it as pending, then reloads once if a load landed meanwhile. */
async function trackedWrite<T>(get: () => ProteinPowderState, run: () => Promise<T>): Promise<T> {
  const gen = _gen;
  _pending++;
  _writeSeq++;
  try {
    return await run();
  } finally {
    // Signed out meanwhile: the counters were reset, and a reload would run for the next account.
    if (gen === _gen) finishWrite(get);
  }
}

/** A write finished: reload once if a count load landed while it was saving. */
function finishWrite(get: () => ProteinPowderState) {
  _pending = Math.max(0, _pending - 1);
  // Bumped again on finishing, so a load that began during the write and lands after it
  // (seeing nothing pending) still knows to load again.
  _writeSeq++;
  if (_pending === 0 && _reloadFor) {
    const userId = _reloadFor;
    _reloadFor = null;
    get().refresh(userId);
  }
}

const LOG_SELECT = 'id, powder_id, food_entry_id, amount, date, created_at, food_entries(name, quantity, serving_size, serving_unit)';

async function loadDay(userId: string, date: string): Promise<PowderLog[] | null> {
  const { data, error } = await supabase
    .from('protein_powder_log')
    .select(LOG_SELECT)
    .eq('user_id', userId)
    .eq('date', date)
    .not('food_entry_id', 'is', null)
    .order('created_at', { ascending: true });
  if (error || !data) return null;
  return data.map(toLog);
}

export const useProteinPowderStore = create<ProteinPowderState>((set, get) => ({
  powders: [],
  powdersLoaded: false,
  lastPowderId: null,
  todayServings: 0,
  dateLogs: [],
  logsDate: null,

  loadPowders: async (userId) => {
    const gen = _gen;
    const [{ data, error }, last] = await Promise.all([
      supabase
        .from('protein_powders')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      readUserScoped(LAST_POWDER_KEY, userId).catch(() => null),
    ]);
    if (gen !== _gen) return;
    if (error || !data) {
      set({ lastPowderId: last });
      return;
    }
    set({ powders: data.map(toPowder), powdersLoaded: true, lastPowderId: last });
  },

  addPowder: async (userId, input) => {
    const gen = _gen;
    const sortOrder = get().powders.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;
    const { data, error } = await supabase
      .from('protein_powders')
      .insert({ user_id: userId, ...input, sort_order: sortOrder })
      .select('*')
      .single();
    if (error || !data || gen !== _gen) return null;
    const powder = toPowder(data);
    set((s) => ({ powders: [...s.powders, powder] }));
    return powder;
  },

  updatePowder: async (userId, id, input) => {
    const prev = get().powders.find((p) => p.id === id);
    if (!prev) return false;
    set((s) => ({ powders: s.powders.map((p) => (p.id === id ? { ...p, ...input } : p)) }));
    const { error } = await supabase.from('protein_powders').update(input).eq('id', id).eq('user_id', userId);
    if (error) {
      // Put back only this powder's old values.
      set((s) => ({ powders: s.powders.map((p) => (p.id === id ? prev : p)) }));
      return false;
    }
    return true;
  },

  deletePowder: async (userId, id) => {
    const prev = get().powders;
    const index = prev.findIndex((p) => p.id === id);
    if (index < 0) return false;
    const removed = prev[index];
    set((s) => ({ powders: s.powders.filter((p) => p.id !== id) }));
    // Logged snacks keep their name and macros; their log rows just lose the powder link.
    const { error } = await supabase.from('protein_powders').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set((s) => {
        if (s.powders.some((p) => p.id === id)) return s;
        const powders = [...s.powders];
        powders.splice(Math.min(index, powders.length), 0, removed);
        return { powders };
      });
      return false;
    }
    return true;
  },

  fetchToday: async (userId) => {
    const req = ++_todayReq;
    const seq = _writeSeq;
    const logs = await loadDay(userId, toLocalDateString());
    if (req !== _todayReq || !logs) return;
    // An add or delete is still saving: this count may not include it. Load again once it's done.
    if (_pending > 0) {
      _reloadFor = userId;
      return;
    }
    // One started and finished meanwhile: load again now.
    if (seq !== _writeSeq) {
      get().fetchToday(userId);
      return;
    }
    set({ todayServings: sumServings(logs) });
  },

  fetchDate: async (userId, date) => {
    const req = ++_dateReq;
    const seq = _writeSeq;
    // A different day: don't show the previous day's adds while this one loads.
    if (get().logsDate !== date) set({ dateLogs: [], logsDate: date });
    const logs = await loadDay(userId, date);
    if (req !== _dateReq || !logs) return;
    if (_pending > 0) {
      _reloadFor = userId;
      return;
    }
    if (seq !== _writeSeq) {
      get().fetchDate(userId, date);
      return;
    }
    set({ dateLogs: logs, logsDate: date });
    if (date === toLocalDateString()) set({ todayServings: sumServings(logs) });
  },

  refresh: (userId) => {
    const date = get().logsDate;
    // The day on the Nutrition tab; if that's today, its load also sets today's count.
    if (date) get().fetchDate(userId, date);
    if (date !== toLocalDateString()) get().fetchToday(userId);
  },

  logServings: (userId, powder, servings, mealSlot) => trackedWrite(get, async () => {
    if (!(servings > 0)) return false;
    const gen = _gen;
    // One clock reading for both rows, so the snack and the count land on the same day.
    const now = new Date();
    const createdAt = now.toISOString();
    const date = toLocalDateString(now);

    set((s) => ({ todayServings: Math.round((s.todayServings + servings) * 100) / 100, lastPowderId: powder.id }));
    writeUserScoped(LAST_POWDER_KEY, userId, powder.id).catch(() => {});
    // Skipped after a sign-out: it would change the next account's count.
    const rollback = () => {
      if (gen === _gen) set((s) => ({ todayServings: Math.max(0, Math.round((s.todayServings - servings) * 100) / 100) }));
    };

    // Written directly rather than through the diary's addEntry, which would also publish the
    // powder's name to the shared user_created_foods table.
    const { data: food, error: foodError } = await supabase
      .from('food_entries')
      .insert({
        user_id: userId,
        name: powder.name,
        brand: null,
        calories: round1(powder.calories * servings),
        protein: round1(powder.protein * servings),
        carbs: round1(powder.carbs * servings),
        fat: round1(powder.fat * servings),
        meal_type: mealSlot,
        // Per-serving convention: totals for `quantity` servings of "1 serving".
        quantity: servings,
        serving_size: 1,
        serving_unit: 'serving',
        is_planned: false,
        created_at: createdAt,
      })
      .select('id')
      .single();
    if (foodError || !food) {
      rollback();
      return false;
    }

    const { data: log, error: logError } = await supabase
      .from('protein_powder_log')
      .insert({ user_id: userId, powder_id: powder.id, food_entry_id: food.id, amount: servings, date })
      .select(LOG_SELECT)
      .single();
    if (gen !== _gen) return false; // signed out meanwhile
    if (logError || !log) {
      // Don't leave a snack the count doesn't know about. If even that fails (offline), show
      // the snack in the diary so it isn't hidden there while the user tries again.
      const { error: cleanupError } = await supabase.from('food_entries').delete().eq('id', food.id);
      rollback();
      if (cleanupError) useFoodLogStore.getState().syncExternalWrite(userId, createdAt);
      return false;
    }

    if (get().logsDate === date) set((s) => ({ dateLogs: [...s.dateLogs, toLog(log)] }));
    useFoodLogStore.getState().syncExternalWrite(userId, createdAt);
    return true;
  }),

  deleteLog: (userId, log) => trackedWrite(get, async () => {
    const gen = _gen;
    const isToday = log.date === toLocalDateString();
    set((s) => ({
      dateLogs: s.dateLogs.filter((l) => l.id !== log.id),
      todayServings: isToday ? Math.max(0, Math.round((s.todayServings - log.amount) * 100) / 100) : s.todayServings,
    }));
    // Deleting the snack is what takes it off the count (the link clears with it).
    const { error } = await supabase.from('food_entries').delete().eq('id', log.food_entry_id).eq('user_id', userId);
    if (error) {
      if (gen !== _gen) return false; // signed out meanwhile: nothing of this account is shown
      set((s) => ({
        dateLogs: s.logsDate === log.date && !s.dateLogs.some((l) => l.id === log.id)
          ? [...s.dateLogs, log].sort((a, b) => a.created_at.localeCompare(b.created_at))
          : s.dateLogs,
        todayServings: isToday ? Math.round((s.todayServings + log.amount) * 100) / 100 : s.todayServings,
      }));
      return false;
    }
    // Tidy up the now-unlinked log row (it no longer counts either way).
    supabase.from('protein_powder_log').delete().eq('id', log.id).then(() => {}, () => {});
    // The snack's day is the log's (local) date; the log row's own time comes from the server.
    useFoodLogStore.getState().syncExternalWrite(userId, new Date(`${log.date}T12:00:00`).toISOString());
    return true;
  }),

  undoLast: async (userId) => {
    // Two quick taps would otherwise both pick the same last add.
    if (_undoing) return;
    _undoing = true;
    try {
      const logs = await loadDay(userId, toLocalDateString());
      const last = logs?.[logs.length - 1];
      if (last) await get().deleteLog(userId, last);
    } finally {
      _undoing = false;
    }
  },

  relink: async (userId, links) => {
    if (links.length === 0) return;
    const gen = _gen;
    await trackedWrite(get, () => Promise.all(links.map((l) => supabase
      .from('protein_powder_log')
      .update({ food_entry_id: l.foodEntryId })
      .eq('id', l.logId)
      .eq('user_id', userId))));
    if (gen === _gen) get().refresh(userId);
  },

  resetForSignOut: () => {
    _gen++;
    _pending = 0;
    _reloadFor = null;
    _todayReq++;
    _dateReq++;
    set({ powders: [], powdersLoaded: false, lastPowderId: null, todayServings: 0, dateLogs: [], logsDate: null });
  },
}));
