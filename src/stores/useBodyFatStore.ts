import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const CACHE_KEY = '@momentum_bodyfat_cache';

export type BodyFatMethod = 'tape' | 'calipers' | 'bia' | 'bod_pod' | 'dexa';

export interface BodyFatEntry {
  id: string;
  date: string;
  value: number;
  method: BodyFatMethod;
}

export interface EmaPoint {
  date: string;
  value: number;
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

function computeEma(entries: BodyFatEntry[], alpha = 0.2): EmaPoint[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const emaPoints: EmaPoint[] = [];

  let ema = sorted[0].value;
  emaPoints.push({ date: sorted[0].date, value: Math.round(ema * 10) / 10 });

  for (let i = 1; i < sorted.length; i++) {
    ema = alpha * sorted[i].value + (1 - alpha) * ema;
    emaPoints.push({ date: sorted[i].date, value: Math.round(ema * 10) / 10 });
  }

  return emaPoints;
}

async function loadCache(): Promise<Record<string, BodyFatEntry[]>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveToCache(method: string, entries: BodyFatEntry[]) {
  try {
    const cache = await loadCache();
    cache[method] = entries;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
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
      const fromDate = cutoff.toISOString().split('T')[0];

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

        const emaPoints = computeEma(entries);
        const current = entries[entries.length - 1].value;
        const firstValue = entries[0].value;
        const change = Math.round((current - firstValue) * 10) / 10;

        set({ current, change, entries, emaPoints });
        if (days >= 365) saveToCache(method, entries);
      } else if (data) {
        set({ current: null, change: null, entries: [], emaPoints: [] });
      } else {
        // Network error — load from cache and filter to requested range
        const cache = await loadCache();
        const cached = cache[method];
        if (cached && cached.length > 0) {
          const entries = cached.filter((e) => e.date >= fromDate);
          if (entries.length > 0) {
            const emaPoints = computeEma(entries);
            const current = entries[entries.length - 1].value;
            const change = Math.round((current - entries[0].value) * 10) / 10;
            set({ current, change, entries, emaPoints });
          } else {
            set({ current: null, change: null, entries: [], emaPoints: [] });
          }
        }
      }
    } finally {
      set({ loading: false });
    }
  },

  logBodyFat: async (userId: string, value: number, method: BodyFatMethod, days = 365) => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
