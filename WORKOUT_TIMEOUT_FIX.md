# Workout Timeout Bug — Fix Plan

## Root Cause (from audit)

1. `supabase.auth.getSession()` on foreground resume doesn't refresh the expired JWT
2. Sequential 15s timeouts × (1 + 2N) Supabase calls = minutes of blocked UI
3. Partial write risk when token expires mid-loop

---

## Fix 1: Refresh the auth session on foreground resume

**File:** `src/lib/supabase.ts`

**Change:** Replace `getSession()` with `startAutoRefresh()` / `stopAutoRefresh()` which is the official Supabase pattern for React Native apps with backgrounding.

```ts
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

`startAutoRefresh()` immediately checks if the current JWT is expired (or close to expiry) and refreshes it using the stored refresh token. It also restarts the internal refresh interval. `stopAutoRefresh()` pauses the interval to avoid wasted background ticks.

This is the recommended pattern from Supabase's React Native docs and handles the core issue: when the app resumes, the JWT is refreshed before any queries run.

---

## Fix 2: Ensure valid session before finishWorkout writes

**File:** `src/stores/useActiveWorkoutStore.ts`

**Change:** Add a session refresh call at the top of `finishWorkout`, before any Supabase writes begin:

```ts
// At the start of finishWorkout, after validation and filtering:
const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
if (sessionError || !sessionData.session) {
  if (!_timerInterval) _timerInterval = setInterval(() => get().tick(), 1000);
  return { error: 'Session expired. Please close and reopen the app, then try again.' };
}
```

This is a belt-and-suspenders safeguard. Even if Fix 1 runs on foreground, there's a race window between the AppState listener and the user tapping "Finish." This explicit refresh guarantees a valid token before the write sequence begins.

**Timeout:** The `refreshSession()` call itself should be wrapped in `withTimeout()` with a shorter 10s timeout so it doesn't hang.

---

## Fix 3: Batch exercises and sets into fewer Supabase calls

**File:** `src/stores/useActiveWorkoutStore.ts`

**Change:** Replace the sequential per-exercise insert loop with bulk inserts:

**Current (N exercises → 2N+1 sequential calls):**
```
workouts.insert → exercises[0].insert → sets[0].insert → exercises[1].insert → sets[1].insert → ...
```

**New (3 total calls):**
```
workouts.insert → exercises.insert (all at once) → sets.insert (all at once)
```

Steps:
1. Insert workout row (unchanged) — get `workout.id`
2. Insert ALL exercises in a single `.insert([...])` call with `.select('id, exercise_order')` — get back all exercise IDs
3. Map exercise IDs to their sets, then insert ALL sets in a single `.insert([...])` call

**Benefits:**
- 3 Supabase calls instead of 2N+1 → worst case 45s instead of 195s for 6 exercises
- All exercises succeed or fail together (no partial writes within a batch)
- Each call still wrapped in `withTimeout(promise, 15_000)`

**If bulk exercises insert fails:** Return error, restart timer (same as current workout fail path). No partial data — the workout row exists but has no exercises, which is effectively orphaned. This is acceptable since the workout row is tiny and can be cleaned up.

**If bulk sets insert fails:** Exercises exist but sets are missing. This is the same partial-write risk as before, but now it only happens at the sets level (one boundary) rather than at every exercise boundary.

---

## Fix 4: Premature success haptic

**File:** `src/components/workout-sheet/WorkoutHeader.tsx`

**Change:** Move the haptic from before the async call to after success confirmation:

```ts
const doFinish = async (durationOverride?: number) => {
  if (!userId) return;
  setFinishing(true);
  try {
    const { error } = await finishWorkout(userId, durationOverride);
    if (error) {
      Alert.alert('Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // ← moved here
    // Refresh caches...
  } catch {
    Alert.alert('Error', 'Something went wrong. Please try again.');
  } finally {
    setFinishing(false);
  }
};
```

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/supabase.ts` | Replace `getSession()` with `startAutoRefresh()` / `stopAutoRefresh()` |
| `src/stores/useActiveWorkoutStore.ts` | Add `refreshSession()` before writes; batch exercises+sets into bulk inserts |
| `src/components/workout-sheet/WorkoutHeader.tsx` | Move success haptic after finishWorkout completes |

---

## Files NOT Touched

- No new Supabase tables or columns
- No changes to useAuthStore, useWorkoutStore, or any other store
- No changes to workoutStorage.ts (local persistence unchanged)
- No changes to liveActivityManager.ts or notificationService.ts
- No new dependencies

---

## Verification

1. Simulate 65+ minutes backgrounding → foreground → finish workout → should succeed without timeout
2. Workout data in Supabase matches local state (all exercises, all sets)
3. Error case: airplane mode → finish → should show error, button resets promptly (max ~45s for 3 calls), workout state preserved
4. Retry after error: turn network back on → finish again → should succeed
5. No TS errors in modified files
6. Normal flow unaffected: fresh app → start workout → finish → works as before
