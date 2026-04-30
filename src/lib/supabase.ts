import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { fetch as expoFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const buildClient = (): SupabaseClient =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    global: {
      fetch: expoFetch as unknown as typeof fetch,
    },
  });

let _client: SupabaseClient = buildClient();

// Proxy so that every consumer always reaches into the *current* client.
// We swap _client out on resume after long backgrounding (see below) without
// breaking the imported `supabase` reference held all over the codebase.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (_client as any)[prop];
  },
});

// Workaround for supabase/supabase#36046: after the app has been backgrounded
// for a while, the supabase-js client's internal state desyncs — auth promises
// freeze, sessions go null, queries hang silently before ever reaching the
// network. The only confirmed fix is to recreate the client. We only do this
// after a meaningful background gap to avoid churning realtime subscriptions
// for brief notification-shade pulls.
const RECREATE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min
let _backgroundedAt: number | null = null;

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    const elapsed = _backgroundedAt ? Date.now() - _backgroundedAt : 0;
    _backgroundedAt = null;
    if (elapsed > RECREATE_THRESHOLD_MS) {
      _client = buildClient();
    } else {
      _client.auth.startAutoRefresh();
    }
  } else {
    _backgroundedAt = Date.now();
    _client.auth.stopAutoRefresh();
  }
});
