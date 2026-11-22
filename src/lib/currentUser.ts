/**
 * The signed-in user's id (and the profile's starting weight), kept here by useAuthStore so other
 * stores and services can read them without importing useAuthStore (which imports them for the
 * sign-out reset: a require cycle).
 */
let _userId: string | null = null;
let _startingWeight: number | null = null;

export function getCurrentUserId(): string | null {
  return _userId;
}

/** The signed-in user's starting weight (kg, from their profile), or null. */
export function getCurrentStartingWeight(): number | null {
  return _startingWeight;
}

/**
 * Called only by useAuthStore when the user changes before the store does (sign-out, account
 * switch); another user's starting weight is cleared with it.
 */
export function setCurrentUserId(id: string | null): void {
  if (id !== _userId) _startingWeight = null;
  _userId = id;
}

/** Called only by useAuthStore whenever the signed-in user or their profile changes. */
export function setCurrentUser(id: string | null, startingWeight: number | null): void {
  _userId = id;
  _startingWeight = startingWeight;
}
