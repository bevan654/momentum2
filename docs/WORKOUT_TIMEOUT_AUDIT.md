# Workout Timeout Bug — Audit Findings

## Bug Description

Finishing a workout fails with "request timed out" if the app has been backgrounded or the phone locked for an extended period. The finish button shows a loading spinner that appears to hang indefinitely.

---

## Question 1: Where is the Supabase auth session refreshed after app foreground resume?

**File:** `src/lib/supabase.ts:27-31`

```ts
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.getSession();
  }
});
```

**Problem:** `getSession()` only reads the cached session from SecureStore — it does **NOT** refresh an expired JWT. The method signature is `getSession(): Promise<{ data: { session }, error }>` and it returns whatever is stored, expired or not.

The correct method for forcing a token refresh is `supabase.auth.refreshSession()`, which sends the refresh token to Supabase Auth and returns a new JWT.

`autoRefreshToken: true` (line 18) relies on a `setInterval` inside the Supabase JS client that fires ~10 seconds before JWT expiry. However, **JS timers are suspended when the app is backgrounded**, so this interval never fires during a long sleep. When the app resumes, the interval may or may not fire promptly — it's unreliable after >60 minutes of backgrounding.

**Other locations checked (no session refresh found):**
- `src/stores/useAuthStore.ts` — no `refreshSession()` call
- `src/services/notificationService.ts` — has AppState listener but only syncs unread count
- `src/services/liveActivityManager.ts` — iOS notification management only
- `App.tsx` — no session management beyond auth init

**Verdict:** No reliable token refresh happens after foreground resume. The expired JWT is used as-is for subsequent Supabase calls.

---

## Question 2: What is the exact write sequence and timeout wrapping in finishWorkout?

**File:** `src/stores/useActiveWorkoutStore.ts:296-470`

### Write sequence (all sequential, not parallel):

| Step | Table | Timeout | Error handling | Blocking? |
|---|---|---|---|---|
| 1 | `workouts` insert | 15s | Returns `{ error }`, restarts timer | YES — aborts on failure |
| 2..N | `exercises` insert (per exercise) | 15s each | `catch {}` — silently skips | YES — continues loop |
| 2..N | `sets` insert (per exercise) | 15s each | `catch {}` — silently skips | YES — continues loop |
| Final | `activity_feed` insert | None | Fire-and-forget `.catch(() => {})` | NO |
| Final | `refreshStreak` | None | Fire-and-forget | NO |
| Final | `updateFromWorkout` | None | `try/catch {}` | NO |

### Timeout mechanism (`withTimeout`, lines 17-23):

```ts
function withTimeout<T>(promise: Promise<T>, ms: number = 15_000): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const timer = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(id));
}
```

### Worst-case total wait time:

For a workout with **N exercises**, each having sets:
- 1 workouts insert: 15s
- N exercises inserts: N × 15s
- N sets inserts: N × 15s
- **Total: 15 + (30 × N) seconds**

For 6 exercises: **195 seconds (3+ minutes)** of loading spinner if every call times out. For 10 exercises: **315 seconds (5+ minutes).**

**This is why the button appears to hang indefinitely** — it's actually working through a cascade of sequential 15-second timeouts.

---

## Question 3: What happens to the in-progress workout state on failure?

### On workouts insert failure (lines 354-362):
- Timer interval is restarted: `_timerInterval = setInterval(() => get().tick(), 1000)`
- Returns `{ error }` immediately — workout state is **preserved** in Zustand
- Workout data remains in AsyncStorage from the last `_persist()` call

### On exercises/sets insert failure (line 396):
- Silently caught with empty `catch {}`
- Loop continues to next exercise
- **Partial write possible**: the workout row exists in DB but some exercises/sets may be missing
- No rollback of the workout row

### On caller (WorkoutHeader.tsx) side (lines 86-107):
- `setFinishing(true)` before calling finishWorkout
- Error → `Alert.alert('Error', error)`, then `return` from try block
- **`finally { setFinishing(false) }` always runs** — button does reset after the full cascade

### Local persistence:
- Workout data is saved to AsyncStorage via `_persist()` with 500ms debounce
- `restoreWorkout()` recovers the full state on app restart
- `clearWorkout()` only runs on successful finish — data survives failed attempts

---

## Question 4: Is the workout data persisted locally (survives app kill)?

**Yes.** `_persist()` (lines 784-792) saves to AsyncStorage via `saveWorkout()` from `src/utils/workoutStorage.ts`:

```ts
_persist: () => {
  if (!_workoutRestored) return;
  if (_persistTimeout) clearTimeout(_persistTimeout);
  _persistTimeout = setTimeout(() => {
    const { isActive, startTime, exercises, ... } = get();
    if (!isActive || !startTime) return;
    saveWorkout({ startTime, exercises, restDuration, restStartedAt, startedFromRoutine });
  }, 500);
},
```

- Called after every exercise add/remove, set update, set toggle, rest change
- Debounced 500ms to batch rapid changes
- `restoreWorkout()` reads it back on app restart
- `clearWorkout()` only called on successful finish or explicit discard

**Data is safe even if the app is killed during the timeout cascade.**

---

## Question 5: What does the caller (WorkoutHeader) do with the error?

**File:** `src/components/workout-sheet/WorkoutHeader.tsx:86-107`

```ts
const doFinish = async (durationOverride?: number) => {
  if (!userId) return;
  setFinishing(true);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  try {
    const { error } = await finishWorkout(userId, durationOverride);
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    // Refresh caches...
  } catch {
    Alert.alert('Error', 'Something went wrong. Please try again.');
  } finally {
    setFinishing(false);
  }
};
```

**Observations:**
1. `setFinishing(true)` immediately — button shows ActivityIndicator
2. Success haptic fires **before** the async call completes (premature)
3. The `finally` block correctly resets `finishing` to false — button unblocks
4. Error is shown via Alert.alert with the error message from finishWorkout
5. On error, finishWorkout restarts the timer interval — workout continues
6. The user can retry by pressing Finish again

**The button does eventually reset**, but only after ALL sequential timeouts complete. The user perceives this as "stuck on loading" because they wait 15s+ for the first timeout, see an error alert, but the total elapsed time for a multi-exercise workout can be minutes.

---

## Root Cause Summary

**Two compounding issues:**

1. **Expired JWT not refreshed:** `supabase.auth.getSession()` on foreground resume reads the cached (expired) session instead of calling `supabase.auth.refreshSession()`. All subsequent Supabase requests fail with 401/JWT expired.

2. **Sequential timeout cascade:** Each of the (1 + 2N) Supabase calls in `finishWorkout` has its own 15s timeout. They execute sequentially, so a workout with 6 exercises can block the UI for up to 3+ minutes of compounding timeouts before the button resets. The user experiences this as "stuck on loading indefinitely."

**Secondary issue:**
3. **Partial write risk:** If the workouts row inserts successfully but the session expires mid-loop, some exercises/sets are silently dropped. No cleanup of the partial workout row occurs. The user may see an incomplete workout in their history.
