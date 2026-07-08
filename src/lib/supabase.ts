import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

class LockAcquireTimeoutError extends Error {
  isAcquireTimeout = true;
}

// Per-client exclusive lock. auth-js's exported `processLock` keeps its queue
// in a module-global map keyed by the storage key, so a refresh that dies
// mid-flight (app suspended) wedges the lock for every FUTURE client too —
// recreating the client didn't help because the new one queued behind the
// same stuck operation. Scoping the queue to the client makes a rebuild a
// genuine reset.
const makeClientLock = () => {
  let queue: Promise<unknown> = Promise.resolve();
  return async <R,>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
    const previous = queue;
    const acquired =
      acquireTimeout >= 0
        ? Promise.race([
            previous.catch(() => null),
            new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new LockAcquireTimeoutError(`Acquiring lock "${name}" timed out after ${acquireTimeout}ms`)),
                acquireTimeout
              );
            }),
          ])
        : previous.catch(() => null);
    const run = acquired.then(() => fn());
    queue = run.then(
      () => null,
      async (e) => {
        // An acquire timeout means the previous holder is still running —
        // keep the queue anchored to it, matching auth-js semantics.
        if ((e as any)?.isAcquireTimeout) await previous.catch(() => null);
        return null;
      }
    );
    return run;
  };
};

const buildClient = (): SupabaseClient =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: makeClientLock(),
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
// network. The only confirmed fix is to recreate the client. We recreate
// immediately after a long background gap, and health-check after short ones
// (the wedge can form in any gap where a token refresh was in flight when
// the app suspended).
const RECREATE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min
const HEALTH_CHECK_TIMEOUT_MS = 3000;
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

function swapClient() {
  _client = buildClient();
  // Snapshot before iterating — handlers commonly unsubscribe and re-add
  // themselves (e.g. notificationService re-init), and Set.forEach would
  // otherwise visit the newly-added handler in the same pass.
  const snapshot = [...swapHandlers];
  for (const h of snapshot) {
    try { h(); } catch {}
  }
}

/**
 * Tear down the current client and build a fresh one. Exposed for callers
 * that detect a hung request (e.g. finishWorkout's timeout) so they can
 * recover in-app instead of requiring a force-close.
 */
export function rebuildClient() {
  swapClient();
}

// Guards against overlapping health checks racing an intervening swap.
let _healthCheckSeq = 0;

// A responsive client answers getSession() near-instantly (storage read).
// A wedged one either hangs on initializePromise or rejects with a lock
// acquire timeout. Only stall/rejection counts as unhealthy — an error
// *inside* a resolved response (e.g. offline refresh failure) does not,
// so we don't churn the client just because the network is down.
async function verifyClientResponsive() {
  const seq = ++_healthCheckSeq;
  const responsive = await Promise.race([
    _client.auth.getSession().then(() => true, () => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS)),
  ]);
  if (!responsive && seq === _healthCheckSeq) {
    swapClient();
  }
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    const elapsed = _backgroundedAt ? Date.now() - _backgroundedAt : 0;
    _backgroundedAt = null;
    if (elapsed > RECREATE_THRESHOLD_MS) {
      swapClient();
    } else {
      _client.auth.startAutoRefresh();
      if (elapsed > 0) void verifyClientResponsive();
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
