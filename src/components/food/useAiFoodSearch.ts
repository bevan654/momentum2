import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { FoodCatalogItem } from '../../stores/useFoodLogStore';
import { aiItemsToCacheRows, mapAiRow, sanitizeForOrFilter } from './foodMapping';

/**
 * AI food search for the Add Food sheet:
 * - `searchCache(text)`: looks up earlier AI estimates in the shared ai_food_cache (shown under
 *   catalog results). Out-of-order responses are ignored.
 * - `deepSearch()`: the Deep Search button. Checks the cache for this exact query, otherwise asks
 *   the gemini-food-search edge function (30 s timeout) and caches the answer for everyone.
 * Results reset whenever the query changes.
 */
export function useAiFoodSearch(query: string) {
  const [cachedResults, setCachedResults] = useState<FoodCatalogItem[]>([]);
  const [aiResults, setAiResults] = useState<FoodCatalogItem[]>([]);
  // The query a Deep Search is running for; only counts as "searching" while it's still current.
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const aiSearching = searchingQuery != null && searchingQuery === query.trim();
  const [showAiResults, setShowAiResults] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const cacheRequest = useRef(0);
  const searchingRef = useRef(false);
  // The latest query, so a slow Deep Search answer for an older query is dropped.
  const queryRef = useRef(query);
  queryRef.current = query;

  const searchCache = useCallback((text: string) => {
    const id = ++cacheRequest.current;
    const normalized = sanitizeForOrFilter(text.toLowerCase());
    if (normalized.length < 2) {
      setCachedResults([]);
      return;
    }
    supabase
      .from('ai_food_cache')
      .select('*')
      .or(`name.ilike.%${normalized}%,brand.ilike.%${normalized}%,search_query.ilike.%${normalized}%`)
      .limit(10)
      .then(
        ({ data }) => {
          if (id !== cacheRequest.current) return;
          setCachedResults(data?.length ? data.map(mapAiRow) : []);
        },
        () => {
          if (id === cacheRequest.current) setCachedResults([]);
        },
      );
  }, []);

  const clearCache = useCallback(() => {
    cacheRequest.current++;
    setCachedResults([]);
  }, []);

  // A new query hides the previous AI answer.
  useEffect(() => {
    setShowAiResults(false);
    setAiResults([]);
    setAiError(null);
  }, [query]);

  const deepSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || searchingRef.current) return;
    searchingRef.current = true;
    setSearchingQuery(q);
    setAiError(null);
    const normalized = q.toLowerCase();

    try {
      // 1. Someone already asked this exact question: reuse the cached answer.
      try {
        const { data: cached } = await supabase.from('ai_food_cache').select('*').eq('search_query', normalized);
        if (cached && cached.length > 0) {
          if (queryRef.current.trim() !== q) return;
          setAiResults(cached.map(mapAiRow));
          setShowAiResults(true);
          return;
        }
      } catch {}

      // 2. Ask the edge function. Plain fetch (not functions.invoke) because the custom fetch
      // wrapper in src/lib/supabase.ts can stall while refreshing large sessions.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        if (queryRef.current.trim() === q) setAiError('Please sign in again to use Deep Search.');
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      let items: Record<string, unknown>[] = [];
      try {
        const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/gemini-food-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
          },
          body: JSON.stringify({ query: q }),
          signal: controller.signal,
        });
        if (!res.ok) {
          // The function explains rate limits in `error`; show that instead of failing silently.
          let message = 'Deep Search is unavailable right now. Try again later.';
          try {
            const body = await res.json();
            if (res.status === 429 && typeof body?.error === 'string') message = body.error;
          } catch {}
          if (queryRef.current.trim() === q) setAiError(message);
          return;
        }
        const payload = await res.json();
        items = Array.isArray(payload?.items) ? payload.items : [];
      } catch {
        if (queryRef.current.trim() === q) setAiError('Deep Search timed out. Check your connection and try again.');
        return;
      } finally {
        clearTimeout(timeoutId);
      }

      // Still cache the answer below, but only show it if the query hasn't changed.
      const stillCurrent = queryRef.current.trim() === q;
      if (stillCurrent) {
        setAiResults(items.map(mapAiRow));
        setShowAiResults(true);
      }
      if (stillCurrent && items.length === 0) setAiError('No estimates found for that search.');

      // 3. Share the answer through the cache (fire-and-forget).
      if (items.length > 0) {
        supabase.from('ai_food_cache').insert(aiItemsToCacheRows(items, normalized, q)).then(() => {}, () => {});
      }
    } finally {
      searchingRef.current = false;
      setSearchingQuery(null);
    }
  }, [query]);

  const hideAiResults = useCallback(() => setShowAiResults(false), []);

  return {
    cachedResults,
    searchCache,
    clearCache,
    aiResults,
    aiSearching,
    showAiResults,
    hideAiResults,
    aiError,
    deepSearch,
  };
}
