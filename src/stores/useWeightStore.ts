import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { BODYWEIGHT_RANGE_KG } from '../constants/muscleMap';
import { isPlausibleBodyweight } from '../utils/muscleLoad';
import { toLocalDateString } from '../utils/localDate';
import { computeEma, type EmaPoint } from '../utils/ema';

export interface WeightEntry {
  date: string;
  weight: number;
}

interface WeightState {
  /**
   * Latest weigh-in, however old (bodyweight for ranks and muscle load). The rest covers the fetched window.
   * Entries outside BODYWEIGHT_RANGE_KG (typos) are left out of all of it; they stay in the database.
   */
  current: number | null;
  trend: number | null;
  change: number | null;
  entries: WeightEntry[];
  emaPoints: EmaPoint[];
  loading: boolean;
  fetchWeightData: (userId: string, days?: number) => Promise<void>;
  logWeight: (userId: string, weight: number, days?: number) => Promise<{ error: string | null }>;
  deleteWeight: (userId: string, date: string, days?: number) => Promise<void>;
}

export const useWeightStore = create<WeightState>((set, get) => ({
  current: null,
  trend: null,
  change: null,
  entries: [],
  emaPoints: [],
  loading: false,

  fetchWeightData: async (userId: string, days = 30) => {
    set({ loading: true });
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const fromDate = toLocalDateString(cutoff);

      const { data } = await supabase
        .from('weight_entries')
        .select('weight, date')
        .eq('user_id', userId)
        .gte('date', fromDate)
        .order('date', { ascending: true });

      const entries: WeightEntry[] = (data ?? [])
        .map((e) => ({ date: e.date, weight: Number(e.weight) }))
        .filter((e) => isPlausibleBodyweight(e.weight));

      if (entries.length > 0) {
        const emaPoints = computeEma(entries, (e) => e.weight);
        const current = entries[entries.length - 1].weight;
        const trend = emaPoints[emaPoints.length - 1].value;
        const firstWeight = entries[0].weight;
        const change = Math.round((current - firstWeight) * 10) / 10;

        set({ current, trend, change, entries, emaPoints });
      } else {
        // No plausible entry in the window, but an older weigh-in is still the user's latest weight.
        const { data: latest } = await supabase
          .from('weight_entries')
          .select('weight')
          .eq('user_id', userId)
          .gte('weight', BODYWEIGHT_RANGE_KG.min)
          .lte('weight', BODYWEIGHT_RANGE_KG.max)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        const latestKg = latest ? Number(latest.weight) : null;
        const current = isPlausibleBodyweight(latestKg) ? latestKg : null;
        set({ current, trend: null, change: null, entries: [], emaPoints: [] });
      }
    } finally {
      set({ loading: false });
    }
  },

  logWeight: async (userId: string, weight: number, days = 30) => {
    const date = toLocalDateString();

    // One entry per day (unique user_id, date): a second weigh-in today replaces the first.
    const { error } = await supabase.from('weight_entries').upsert(
      { user_id: userId, weight, date },
      { onConflict: 'user_id,date' },
    );

    if (error) return { error: error.message };

    await get().fetchWeightData(userId, days);
    return { error: null };
  },

  deleteWeight: async (userId: string, date: string, days = 30) => {
    // Optimistic update
    const prev = get().entries;
    set({ entries: prev.filter((e) => e.date !== date) });

    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('user_id', userId)
      .eq('date', date);

    if (error) {
      set({ entries: prev });
      return;
    }

    await get().fetchWeightData(userId, days);
  },
}));
