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

// ── Dev-only: simulate offline ─────────────────────────────
// Toggle via: import { setForceOffline } from '@/lib/supabase'
//             setForceOffline(true)
let _forceOffline = false;
export const setForceOffline = (v: boolean) => { _forceOffline = v; };
export const getForceOffline = () => _forceOffline;

let _refreshing: Promise<string | null> | null = null;

function refreshTokenOnce(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = supabase.auth.refreshSession()
    .then(({ data }) => {
      _refreshing = null;
      return data.session?.access_token ?? null;
    })
    .catch(() => {
      _refreshing = null;
      return null;
    });
  return _refreshing;
}

const autoRetryFetch: typeof globalThis.fetch = async (input, init) => {
  if (_forceOffline) {
    throw new TypeError('Network request failed');
  }

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
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
