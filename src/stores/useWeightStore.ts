import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { enqueue } from '../lib/syncQueue';

const CACHE_KEY = '@momentum_weight_cache';

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface EmaPoint {
  date: string;
  value: number;
}

interface WeightState {
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

function computeEma(entries: WeightEntry[], alpha = 0.2): EmaPoint[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const emaPoints: EmaPoint[] = [];

  let ema = sorted[0].weight;
  emaPoints.push({ date: sorted[0].date, value: Math.round(ema * 10) / 10 });

  for (let i = 1; i < sorted.length; i++) {
    ema = alpha * sorted[i].weight + (1 - alpha) * ema;
    emaPoints.push({ date: sorted[i].date, value: Math.round(ema * 10) / 10 });
  }

  return emaPoints;
}

export const useWeightStore = create<WeightState>((set, get) => ({
  current: null,
  trend: null,
  change: null,
  entries: [],
  emaPoints: [],
  loading: false,

  fetchWeightData: async (userId: string, days = 365) => {
    set({ loading: true });
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const fromDate = cutoff.toISOString().split('T')[0];

      const { data } = await supabase
        .from('weight_entries')
        .select('weight, date')
        .eq('user_id', userId)
        .gte('date', fromDate)
        .order('date', { ascending: true });

      if (data && data.length > 0) {
        const entries: WeightEntry[] = data.map((e) => ({
          date: e.date,
          weight: Number(e.weight),
        }));

        const emaPoints = computeEma(entries);
        const current = entries[entries.length - 1].weight;
        const trend = emaPoints[emaPoints.length - 1].value;
        const firstWeight = entries[0].weight;
        const change = Math.round((current - firstWeight) * 10) / 10;

        set({ current, trend, change, entries, emaPoints });
        // Always cache the widest dataset we've fetched
        if (days >= 365) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entries)).catch(() => {});
      } else if (data) {
        set({ current: null, trend: null, change: null, entries: [], emaPoints: [] });
      } else {
        // Network error — load from cache and filter to requested range
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const all: WeightEntry[] = JSON.parse(raw);
            const entries = all.filter((e) => e.date >= fromDate);
            if (entries.length > 0) {
              const emaPoints = computeEma(entries);
              const current = entries[entries.length - 1].weight;
              const trend = emaPoints[emaPoints.length - 1].value;
              const change = Math.round((current - entries[0].weight) * 10) / 10;
              set({ current, trend, change, entries, emaPoints });
            } else {
              set({ current: null, trend: null, change: null, entries: [], emaPoints: [] });
            }
          }
        } catch {}
      }
    } finally {
      set({ loading: false });
    }
  },

  logWeight: async (userId: string, weight: number, days = 365) => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Optimistic local update
    const newEntry: WeightEntry = { date, weight };
    const prev = get().entries;
    const updated = [...prev.filter((e) => e.date !== date), newEntry].sort((a, b) => a.date.localeCompare(b.date));
    const emaPoints = computeEma(updated);
    set({
      current: weight,
      trend: emaPoints.length > 0 ? emaPoints[emaPoints.length - 1].value : weight,
      change: updated.length > 0 ? Math.round((weight - updated[0].weight) * 10) / 10 : 0,
      entries: updated,
      emaPoints,
    });
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated)).catch(() => {});

    const row = { user_id: userId, weight, date };
    const { error } = await supabase.from('weight_entries').insert(row);

    if (error) {
      enqueue({ table: 'weight_entries', type: 'insert', data: row });
    } else {
      await get().fetchWeightData(userId, days);
    }
    return { error: null };
  },

  deleteWeight: async (userId: string, date: string, days = 365) => {
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
