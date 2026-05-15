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

// Realtime channels live inside the supabase client — when we swap the client,
// any open channels go with the old (dead) client and stop receiving events.
// Consumers register a handler here to re-subscribe their channels post-swap.
type ClientSwapHandler = () => void;
const swapHandlers = new Set<ClientSwapHandler>();

export function onClientSwap(handler: ClientSwapHandler): () => void {
  swapHandlers.add(handler);
  return () => { swapHandlers.delete(handler); };
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    const elapsed = _backgroundedAt ? Date.now() - _backgroundedAt : 0;
    _backgroundedAt = null;
    if (elapsed > RECREATE_THRESHOLD_MS) {
      _client = buildClient();
      // Snapshot before iterating — handlers commonly unsubscribe and re-add
      // themselves (e.g. notificationService re-init), and Set.forEach would
      // otherwise visit the newly-added handler in the same pass.
      const snapshot = [...swapHandlers];
      for (const h of snapshot) {
        try { h(); } catch {}
      }
    } else {
      _client.auth.startAutoRefresh();
    }
  } else if (_backgroundedAt === null) {
    // Only record on the *first* transition out of active. iOS goes
    // active → inactive → background on suspend AND background → inactive → active
    // on resume; without this guard the inactive-just-before-active event resets
    // the timestamp to ~now and elapsed always reads as 0, so the recreation
    // never fires. Android has no inactive state, which is why it worked there.
    _backgroundedAt = Date.now();
    _client.auth.stopAutoRefresh();
  }
});
