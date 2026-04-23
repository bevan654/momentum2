import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ── Auto-retry on expired JWT ──────────────────────────────
// After the app resumes from background, JS timers are suspended
// so autoRefreshToken can't renew an expired access token on its own.
// Instead of requiring every call-site to opt-in, we intercept fetch
// globally: if a non-auth request returns 401, refresh the session
// once and replay with the new token.

const REFRESH_TIMEOUT_MS = 8_000;

let _refreshing: Promise<string | null> | null = null;

function refreshTokenOnce(): Promise<string | null> {
  if (_refreshing) return _refreshing;

  const refresh = supabase.auth
    .refreshSession()
    .then(({ data }) => data.session?.access_token ?? null);

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), REFRESH_TIMEOUT_MS),
  );

  _refreshing = Promise.race([refresh, timeout])
    .catch(() => null)
    .finally(() => {
      _refreshing = null;
    });

  return _refreshing;
}

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Wraps the native fetch with a hard abort timeout. Critical: without this,
 * a stale TCP socket after device wake can keep supabase-js's internal
 * refresh hanging indefinitely, which holds the SDK's auth mutex and
 * wedges every subsequent SDK call. Aborting fetch releases the mutex.
 */
function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
  ms: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

const autoRetryFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await fetchWithTimeout(input, init);

  // Only retry non-auth endpoints to avoid recursion
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (res.status === 401 && !url.includes('/auth/')) {
    const newToken = await refreshTokenOnce();
    if (newToken) {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${newToken}`);
      headers.set('apikey', supabaseAnonKey);
      return fetchWithTimeout(input, { ...init, headers });
    }
  }

  return res;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    // IMPORTANT: we manage refresh ourselves via refreshTokenOnce.
    // Supabase-js's built-in autoRefreshToken can deadlock after the app
    // resumes from a long background — the internal refresh promise gets
    // stuck waiting on a stale SecureStore write or dead network socket,
    // and every subsequent auth-using call blocks on its mutex forever.
    // Disabling it removes that foot-gun; autoRetryFetch handles 401s by
    // calling refreshTokenOnce (which has an 8s cap).
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: autoRetryFetch,
  },
});

// Manage session refresh around app lifecycle ourselves — with bounded
// timeouts — so the SDK never has an unbounded in-flight refresh.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    // Fire a refresh right away so the user's first action after resume
    // has a fresh token. refreshTokenOnce has an 8s internal cap.
    refreshTokenOnce();
  }
});

// ── Module-level session cache (mutex-free read path) ─────────────────
// supabase-js serialises auth operations through an internal mutex. After
// the app wakes from a long background, that mutex can get stuck waiting
// on stale SecureStore/network — and every call that needs the current
// token (e.g. from().insert()) blocks behind it. This cache lets critical
// paths read the access token synchronously, without entering the mutex.

let _cachedSession: { access_token: string; expires_at?: number } | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedSession = session
    ? { access_token: session.access_token, expires_at: session.expires_at }
    : null;
});

// Prime the cache on module load
supabase.auth
  .getSession()
  .then(({ data }) => {
    if (data.session) {
      _cachedSession = {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at,
      };
    }
  })
  .catch(() => {});

export function getCachedAccessToken(): string | null {
  return _cachedSession?.access_token ?? null;
}

/**
 * Direct REST insert bypassing supabase-js. Use for critical writes where
 * the SDK's auth mutex might be wedged after a long app background.
 * Does its own 401-refresh-retry using refreshTokenOnce.
 */
export async function rawSupabaseInsert<T = any>(
  table: string,
  rows: object | object[],
  options: { select?: string; single?: boolean; timeoutMs?: number } = {},
): Promise<{ data: T | null; error: { message: string; status?: number } | null }> {
  const timeoutMs = options.timeoutMs ?? 10_000;

  const doFetch = async (token: string): Promise<Response> => {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    if (options.select) url.searchParams.set('select', options.select);

    const ctl = new AbortController();
    const tid = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          Prefer: options.select ? 'return=representation' : 'return=minimal',
        },
        body: JSON.stringify(rows),
        signal: ctl.signal,
      });
    } finally {
      clearTimeout(tid);
    }
  };

  let token = getCachedAccessToken();
  if (!token) {
    const refreshed = await refreshTokenOnce();
    if (!refreshed) return { data: null, error: { message: 'No session' } };
    token = refreshed;
  }

  try {
    let res: Response;
    try {
      res = await doFetch(token);
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'Network error' } };
    }

    if (res.status === 401) {
      const newToken = await refreshTokenOnce();
      if (!newToken) {
        return { data: null, error: { message: 'Unauthorized', status: 401 } };
      }
      try {
        res = await doFetch(newToken);
      } catch (e: any) {
        return { data: null, error: { message: e?.message || 'Network error' } };
      }
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      // Mark 4xx errors with `code` so withRetry treats them as application-
      // level and doesn't retry (retrying a bad payload is useless).
      const code = res.status >= 400 && res.status < 500 ? `http-${res.status}` : undefined;
      return {
        data: null,
        error: {
          message: txt.slice(0, 300) || res.statusText,
          status: res.status,
          ...(code ? { code } : {}),
        } as any,
      };
    }

    if (options.select) {
      const json = (await res.json()) as any[];
      return {
        data: (options.single ? json[0] ?? null : json) as T,
        error: null,
      };
    }
    return { data: null as any, error: null };
  } catch (e: any) {
    return { data: null, error: { message: e?.message || 'Internal error' } };
  }
}
