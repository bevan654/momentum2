import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type PumpState = 'no_pump' | 'pumped';

export interface MeasurementEntry {
  id: string;
  date: string;
  value: number;
  body_part: string;
  side: string | null;
  pump_state: PumpState;
}

export interface EmaPoint {
  date: string;
  value: number;
}

interface MeasurementState {
  current: number | null;
  change: number | null;
  entries: MeasurementEntry[];
  emaPoints: EmaPoint[];
  loading: boolean;
  fetchMeasurementData: (
    userId: string,
    bodyPart: string,
    side: string | null,
    pumpState: PumpState,
    days?: number,
  ) => Promise<void>;
  logMeasurement: (
    userId: string,
    value: number,
    bodyPart: string,
    side: string | null,
    pumpState: PumpState,
    days?: number,
  ) => Promise<{ error: string | null }>;
  deleteMeasurement: (
    userId: string,
    entryId: string,
    bodyPart: string,
    side: string | null,
    pumpState: PumpState,
    days?: number,
  ) => Promise<void>;
}

function computeEma(entries: MeasurementEntry[], alpha = 0.2): EmaPoint[] {
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

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  current: null,
  change: null,
  entries: [],
  emaPoints: [],
  loading: false,

  fetchMeasurementData: async (
    userId: string,
    bodyPart: string,
    side: string | null,
    pumpState: PumpState,
    days = 30,
  ) => {
    set({ loading: true });
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const fromDate = cutoff.toISOString().split('T')[0];

      let query = supabase
        .from('measurement_entries')
        .select('id, value, body_part, side, pump_state, date')
        .eq('user_id', userId)
        .eq('body_part', bodyPart)
        .eq('pump_state', pumpState)
        .gte('date', fromDate)
        .order('date', { ascending: true });

      if (side) {
        query = query.eq('side', side);
      } else {
        query = query.is('side', null);
      }

      const { data } = await query;

      if (data && data.length > 0) {
        const entries: MeasurementEntry[] = data.map((e) => ({
          id: e.id,
          date: e.date,
          value: Number(e.value),
          body_part: e.body_part,
          side: e.side,
          pump_state: e.pump_state as PumpState,
        }));

        const emaPoints = computeEma(entries);
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

  logMeasurement: async (
    userId: string,
    value: number,
    bodyPart: string,
    side: string | null,
    pumpState: PumpState,
    days = 30,
  ) => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const { error } = await supabase.from('measurement_entries').insert({
      user_id: userId,
      value,
      body_part: bodyPart,
      side,
      pump_state: pumpState,
      date,
    });

    if (error) return { error: error.message };

    await get().fetchMeasurementData(userId, bodyPart, side, pumpState, days);
    return { error: null };
  },

  deleteMeasurement: async (
    userId: string,
    entryId: string,
    bodyPart: string,
    side: string | null,
    pumpState: PumpState,
    days = 30,
  ) => {
    const prev = get().entries;
    set({ entries: prev.filter((e) => e.id !== entryId) });

    const { error } = await supabase
      .from('measurement_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) {
      set({ entries: prev });
      return;
    }

    await get().fetchMeasurementData(userId, bodyPart, side, pumpState, days);
  },
}));
