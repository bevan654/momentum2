import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import type { CatalogEntry } from './pickerData';
import {
  WGER_SEARCH_URL, WGER_MUSCLE_MAP, WGER_CATEGORY_MAP, WGER_BW_EQUIPMENT,
  type WgerSearchResult, type WgerExerciseInfo,
} from './wgerApi';

/** The picker's "Deep Search" (wger.de): results, loading flag and whether the list shows them.
 *  Results are dropped whenever the debounced search text changes. */
export function useWgerSearch(search: string, debouncedSearch: string) {
  const [apiResults, setApiResults] = useState<CatalogEntry[]>([]);
  const [apiSearching, setApiSearching] = useState(false);
  const [showApiResults, setShowApiResults] = useState(false);

  // Reset API results when search text changes
  useEffect(() => {
    setShowApiResults(false);
    setApiResults([]);
  }, [debouncedSearch]);

  /** Back to the local list (also used when the picker closes). */
  const clearApiResults = useCallback(() => {
    setApiResults([]);
    setShowApiResults(false);
  }, []);

  const searchApi = useCallback(async () => {
    const q = search.trim();
    if (!q || apiSearching) return;
    setApiSearching(true);
    try {
      // 1. Search for exercise names
      const res = await fetch(`${WGER_SEARCH_URL}&term=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const suggestions: WgerSearchResult[] = json.suggestions || [];

      // Deduplicate by name, keep first occurrence (with base_id for muscle lookup)
      const seen = new Set<string>();
      const unique = suggestions.filter((s) => {
        const key = s.value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // 2. Fetch muscle data for each unique exercise (parallel, capped at 10)
      const toFetch = unique.slice(0, 10);
      const infoResults = await Promise.allSettled(
        toFetch.map(async (s) => {
          const infoRes = await fetch(
            `https://wger.de/api/v2/exerciseinfo/${s.data.base_id}/?format=json`,
          );
          if (!infoRes.ok) return null;
          return infoRes.json() as Promise<WgerExerciseInfo>;
        }),
      );

      // 3. Merge search results with muscle data
      const mapped: CatalogEntry[] = toFetch.map((s, i) => {
        const info = infoResults[i].status === 'fulfilled' ? infoResults[i].value : null;
        const primary = info?.muscles?.map((m) => WGER_MUSCLE_MAP[m.id] || '').filter(Boolean) || [];
        const secondary = info?.muscles_secondary?.map((m) => WGER_MUSCLE_MAP[m.id] || '').filter(Boolean) || [];
        const catId = info?.category?.id;
        const category = catId ? (WGER_CATEGORY_MAP[catId] || info?.category?.name || s.data.category || 'Custom') : (s.data.category || 'Custom');
        const isBw = info?.equipment?.length === 1 && info.equipment.some((e) => WGER_BW_EQUIPMENT.has(e.id));
        return {
          name: s.value,
          category,
          exercise_type: isBw ? 'bodyweight' : 'weighted',
          primary_muscles: primary,
          secondary_muscles: secondary,
          done: false,
        };
      });

      setApiResults(mapped);
      setShowApiResults(true);
    } catch {
      setApiResults([]);
      setShowApiResults(false);
      Alert.alert(
        'Deep Search Unavailable',
        'The exercise database is currently offline. Try again later or use the local search.',
      );
    } finally {
      setApiSearching(false);
    }
  }, [search, apiSearching]);

  return { apiResults, apiSearching, showApiResults, searchApi, clearApiResults };
}
