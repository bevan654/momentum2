import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toLocalDateString } from '../utils/localDate';
import { computeEma, type EmaPoint } from '../utils/ema';

export type BodyFatMethod = 'tape' | 'calipers' | 'bia' | 'bod_pod' | 'dexa';

export interface BodyFatEntry {
  id: string;
  date: string;
  value: number;
  method: BodyFatMethod;
}

interface BodyFatState {
  current: number | null;
  change: number | null;
  entries: BodyFatEntry[];
  emaPoints: EmaPoint[];
  loading: boolean;
  fetchBodyFatData: (userId: string, method: BodyFatMethod, days?: number) => Promise<void>;
  logBodyFat: (userId: string, value: number, method: BodyFatMethod, days?: number) => Promise<{ error: string | null }>;
  deleteBodyFat: (userId: string, entryId: string, method: BodyFatMethod, days?: number) => Promise<void>;
}

export const useBodyFatStore = create<BodyFatState>((set, get) => ({
  current: null,
  change: null,
  entries: [],
  emaPoints: [],
  loading: false,

  fetchBodyFatData: async (userId: string, method: BodyFatMethod, days = 365) => {
    set({ loading: true });
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const fromDate = toLocalDateString(cutoff); // entries are stored under the local date

      const { data } = await supabase
        .from('body_fat_entries')
        .select('id, value, method, date')
        .eq('user_id', userId)
        .eq('method', method)
        .gte('date', fromDate)
        .order('date', { ascending: true });

      if (data && data.length > 0) {
        const entries: BodyFatEntry[] = data.map((e) => ({
          id: e.id,
          date: e.date,
          value: Number(e.value),
          method: e.method as BodyFatMethod,
        }));

        const emaPoints = computeEma(entries, (e) => e.value);
        const current = entries[entries.length - 1].value;
        const firstValue = entries[0].value;
        const change = Math.round((current - firstValue) * 10) / 10;

        set({ current, change, entries, emaPoints });
      } else {
        set({ current: null, change: null, entries: [], emaPoints: [] });
      }
    } finally {
      set({ loading: false });
    }
  },

  logBodyFat: async (userId: string, value: number, method: BodyFatMethod, days = 365) => {
    const date = toLocalDateString();

    const { error } = await supabase.from('body_fat_entries').insert({
      user_id: userId,
      value,
      method,
      date,
    });

    if (error) return { error: error.message };

    await get().fetchBodyFatData(userId, method, days);
    return { error: null };
  },

  deleteBodyFat: async (userId: string, entryId: string, method: BodyFatMethod, days = 365) => {
    const prev = get().entries;
    set({ entries: prev.filter((e) => e.id !== entryId) });

    const { error } = await supabase
      .from('body_fat_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) {
      set({ entries: prev });
      return;
    }

    await get().fetchBodyFatData(userId, method, days);
  },
}));
