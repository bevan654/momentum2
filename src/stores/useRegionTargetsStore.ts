import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PARTS, NON_MUSCLE_GROUP } from 'momentum-muscle-map/core';
import { fetchRegionTargetRows } from '../lib/catalogDatabase';
import { MUSCLE_MAP_ID } from '../constants/muscleMap';
import type { RegionWeights } from '../utils/muscleVolume';

const CACHE_KEY = `exercise_region_targets_v1:${MUSCLE_MAP_ID}`;
const TTL = 24 * 60 * 60 * 1000; // 24 hours, like the exercise catalog
const RETRY_AFTER_FAILURE = 5 * 60 * 1000;

type TargetsByCatalogId = Record<string, RegionWeights>;

interface RegionTargetsState {
  /**
   * exercise_region_targets of the map the app renders: catalog id → region weights. Empty until
   * loaded, and while the table isn't in the database; exercises without rows fall back to their
   * legacy muscles (see makeRegionWeightLookup).
   */
  byCatalogId: TargetsByCatalogId;
  /** Loads from cache, then from Supabase when the cache is missing or stale. Safe to call often. */
  load: () => Promise<void>;
}

/** Only regions the map knows and can light: a typo or a renamed slug would be silently ignored. */
function isMuscleRegion(region: string): boolean {
  const entry = PARTS[region];
  return !!entry && entry[1] !== NON_MUSCLE_GROUP;
}

let inFlight: Promise<void> | null = null;
let loadedAt = 0;
let failedAt = 0;

async function loadTargets(set: (state: Partial<RegionTargetsState>) => void): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { ts: number; byCatalogId: TargetsByCatalogId };
      if (cached.byCatalogId) set({ byCatalogId: cached.byCatalogId });
      if (Date.now() - (cached.ts || 0) < TTL) {
        loadedAt = cached.ts;
        return;
      }
    }
  } catch {}

  const rows = await fetchRegionTargetRows(MUSCLE_MAP_ID);
  if (!rows) {
    failedAt = Date.now(); // network or server error: keep what we have, retry a little later
    return;
  }
  const byCatalogId: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const weight = Number(row.weight);
    if (!isMuscleRegion(row.region) || !(weight > 0 && weight <= 1)) continue;
    (byCatalogId[row.catalog_id] ??= {})[row.region] = weight;
  }
  loadedAt = Date.now();
  set({ byCatalogId });
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: loadedAt, byCatalogId })).catch(() => {});
}

export const useRegionTargetsStore = create<RegionTargetsState>((set) => ({
  byCatalogId: {},

  load: () => {
    if (inFlight) return inFlight;
    const now = Date.now();
    if ((loadedAt && now - loadedAt < TTL) || now - failedAt < RETRY_AFTER_FAILURE) return Promise.resolve();
    inFlight = loadTargets(set)
      .catch(() => {
        failedAt = Date.now();
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },
}));
