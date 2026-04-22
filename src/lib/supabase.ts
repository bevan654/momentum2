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

const autoRetryFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await fetch(input, init);

  // Only retry non-auth endpoints to avoid recursion
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (res.status === 401 && !url.includes('/auth/')) {
    const newToken = await refreshTokenOnce();
    if (newToken) {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${newToken}`);
      headers.set('apikey', supabaseAnonKey);
      return fetch(input, { ...init, headers });
    }
  }

  return res;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: autoRetryFetch,
  },
});

// Manage auth refresh around app lifecycle.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
    // Force a refresh immediately so the next user action doesn't hit
    // an expired JWT and get wedged waiting on autoRetryFetch's lazy retry.
    refreshTokenOnce();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
