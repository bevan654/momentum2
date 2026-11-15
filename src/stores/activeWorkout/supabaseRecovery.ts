import { rebuildClient } from '../../lib/supabase';

const SUPABASE_TIMEOUT = 20_000; // 20s per request

/** Race a promise against a timeout — rejects with an error if it takes too long */
function withTimeout<T>(promise: PromiseLike<T>, ms: number = SUPABASE_TIMEOUT): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([Promise.resolve(promise), timer]).finally(() => clearTimeout(id));
}

/**
 * Run a Supabase query with a timeout; on timeout, rebuild the wedged client
 * and retry once. After backgrounding, the client's auth lock can be stuck so
 * requests hang before ever reaching the network (supabase/supabase#36046) —
 * a rebuild + retry recovers without the user force-closing the app. Takes a
 * factory because a PostgrestBuilder can't be re-executed after it settles.
 */
export async function runWithRecovery<T>(makeQuery: () => PromiseLike<T>): Promise<T> {
  try {
    return await withTimeout(makeQuery());
  } catch (e: any) {
    if (e?.message !== 'Request timed out') throw e;
    console.warn('[runWithRecovery] request hung — rebuilding supabase client and retrying');
    rebuildClient();
    return await withTimeout(makeQuery());
  }
}
