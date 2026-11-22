/**
 * Links from the home screen widgets: momentum://nutrition and momentum://workouts open that tab
 * (Nutrition on today's diary); momentum://workout/<id> (Last workout) opens that workout's
 * summary. A link that arrives before the tabs exist (cold start,
 * the splash or sign-in still showing) waits until TabNavigator mounts. Other momentum:// links
 * (the OAuth callback, the Live Activity's momentum://workout without an id) are left alone: they
 * just open the app.
 */

import { Linking } from 'react-native';
import { navigationRef } from './navigationRef';
import { openWorkoutSummary } from '../lib/navigationBridge';
import { useFoodLogStore } from '../stores/useFoodLogStore';

const TABS: Record<string, string> = {
  nutrition: 'Nutrition',
  workouts: 'Workouts',
};

/** Where a link goes: a tab, or one workout's summary. */
type Target = { tab: string } | { workoutId: string };

let _started = false;
let _tabsReady = false;
/** A link waiting for the tabs, and when it came; one older than PENDING_MS is dropped (the user went through sign-in). */
let _pending: { target: Target; at: number } | null = null;
const PENDING_MS = 30_000;

function _targetFor(url: string | null): Target | null {
  const link = url?.trim() ?? '';
  const workoutId = /^momentum:\/\/workout\/([0-9a-f-]{36})\/?$/i.exec(link)?.[1];
  if (workoutId) return { workoutId: workoutId.toLowerCase() };
  const host = /^momentum:\/\/([a-z]+)\/?$/i.exec(link)?.[1];
  const tab = host ? TABS[host.toLowerCase()] : undefined;
  return tab ? { tab } : null;
}

function _open(target: Target): void {
  if ('workoutId' in target) {
    openWorkoutSummary(target.workoutId);
    return;
  }
  if (target.tab === 'Nutrition') useFoodLogStore.getState().goToday();
  (navigationRef as any).navigate(target.tab);
}

function _handle(url: string | null): void {
  const target = _targetFor(url);
  if (!target) return;
  if (_tabsReady && navigationRef.isReady()) _open(target);
  else _pending = { target, at: Date.now() };
}

/** Call once at app start. */
export function startWidgetLinks(): void {
  if (_started) return;
  _started = true;
  Linking.getInitialURL().then(_handle).catch(() => {});
  Linking.addEventListener('url', (e) => _handle(e.url));
}

/** TabNavigator calls this on mount (true) and unmount (false); a waiting link opens on mount. */
export function setWidgetLinkTabsReady(ready: boolean): void {
  _tabsReady = ready;
  if (!ready || !_pending) return;
  const { target, at } = _pending;
  _pending = null;
  if (Date.now() - at > PENDING_MS) return;
  // After this render, so the tab navigator (and LinkedWorkoutSummary) are registered.
  setTimeout(() => { if (navigationRef.isReady()) _open(target); }, 0);
}
