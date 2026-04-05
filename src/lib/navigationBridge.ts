/**
 * Module-level callback bridges for cross-navigator communication.
 *
 * These break circular dependencies between navigators, screens, and
 * components that need to trigger UI in other parts of the tree.
 * Each bridge is a setter/getter pair — the owner registers the callback
 * via the setter, and consumers call the exported function.
 */

/* ─── Profile sheet (set by TabNavigator) ────────────── */

let _openProfileSheet: (() => void) | null = null;
export function openProfileSheet() { _openProfileSheet?.(); }
export function setOpenProfileSheet(fn: (() => void) | null) { _openProfileSheet = fn; }

/* ─── Recovery overlay (set by WorkoutsNavigator) ────── */

let _setRecoveryVisible: ((v: boolean) => void) | null = null;
export function showRecoveryOverlay() { _setRecoveryVisible?.(true); }
export function hideRecoveryOverlay() { _setRecoveryVisible?.(false); }
export function setRecoveryOverlayControl(fn: ((v: boolean) => void) | null) { _setRecoveryVisible = fn; }

/* ─── Workouts stack navigation (set by WorkoutsNavigator) ── */

let _workoutsNavRef: any = null;
export function navigateWorkoutsStack(screen: string, params?: any) {
  _workoutsNavRef?.navigate(screen, params);
  setTimeout(() => hideRecoveryOverlay(), 50);
}
export function setWorkoutsNavRef(ref: any) { _workoutsNavRef = ref; }

/* ─── Share hub (set by WorkoutHistoryScreen) ────────── */

let _openShareHub: (() => void) | null = null;
export function openShareHub() { _openShareHub?.(); }
export function setOpenShareHub(fn: (() => void) | null) { _openShareHub = fn; }
