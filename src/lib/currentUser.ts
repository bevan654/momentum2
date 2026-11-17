/**
 * The signed-in user's id, kept here by useAuthStore so other stores can read it without
 * importing useAuthStore (which imports them for the sign-out reset: a require cycle).
 */
let _userId: string | null = null;

export function getCurrentUserId(): string | null {
  return _userId;
}

/** Called only by useAuthStore whenever the signed-in user changes. */
export function setCurrentUserId(id: string | null): void {
  _userId = id;
}
