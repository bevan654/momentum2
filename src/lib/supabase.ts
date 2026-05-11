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

// Proxy so every consumer always reaches into the *current* client. We swap
// _client out when the probe detects a frozen client (see below) without
// breaking the imported `supabase` reference held across the codebase.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (_client as any)[prop];
  },
});

type ClientSwapHandler = () => void;
const swapHandlers = new Set<ClientSwapHandler>();

export function onClientSwap(handler: ClientSwapHandler): () => void {
  swapHandlers.add(handler);
  return () => {
    swapHandlers.delete(handler);
  };
}

function recreateClient() {
  _client = buildClient();
  // Snapshot before iterating — handlers commonly unsubscribe and re-add
  // themselves, and Set.forEach would otherwise visit the newly-added handler
  // in the same pass.
  const snapshot = [...swapHandlers];
  for (const h of snapshot) {
    try {
      h();
    } catch {}
  }
}

// Deterministic liveness check. supabase-js#36046 manifests as silently-hanging
// promises after the app has been backgrounded — auth and queries never reach
// the network. Race a cheap server round-trip against a short timeout; if it
// doesn't resolve in 3s the client is frozen and must be recreated.
const PROBE_TIMEOUT_MS = 3000;

async function probeAlive(client: SupabaseClient): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.auth.getUser(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('probe-timeout')), PROBE_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (e: any) {
    // A real error from getUser (e.g. AuthSessionMissingError, network 5xx)
    // still means the client responded — it's only `probe-timeout` that
    // indicates the desynced/hung state.
    return e?.message !== 'probe-timeout';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let _resumeInFlight = false;

AppState.addEventListener('change', async (state) => {
  if (state === 'active') {
    if (_resumeInFlight) return;
    _resumeInFlight = true;
    try {
      const alive = await probeAlive(_client);
      if (!alive) {
        recreateClient();
      } else {
        _client.auth.startAutoRefresh();
      }
    } finally {
      _resumeInFlight = false;
    }
  } else {
    // Non-active = inactive | background. stopAutoRefresh is idempotent.
    _client.auth.stopAutoRefresh();
  }
});
