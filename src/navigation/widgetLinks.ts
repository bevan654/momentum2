/**
 * Links from the home screen widgets: momentum://nutrition, momentum://workouts and
 * momentum://recovery open that tab (Nutrition on today's diary). A link that arrives before the
 * tabs exist (cold start, the splash or sign-in still showing) waits until TabNavigator mounts.
 * Other momentum:// links (the OAuth callback, the Live Activity's momentum://workout) are left
 * alone: they just open the app.
 */

import { Linking } from 'react-native';
import { navigationRef } from './navigationRef';
import { useFoodLogStore } from '../stores/useFoodLogStore';

const TABS: Record<string, string> = {
  nutrition: 'Nutrition',
  workouts: 'Workouts',
  recovery: 'Recovery',
};

let _started = false;
let _tabsReady = false;
/** A link waiting for the tabs, and when it came; one older than PENDING_MS is dropped (the user went through sign-in). */
let _pending: { tab: string; at: number } | null = null;
const PENDING_MS = 30_000;

function _tabFor(url: string | null): string | null {
  const host = url ? /^momentum:\/\/([a-z]+)\/?$/i.exec(url.trim())?.[1] : undefined;
  return host ? TABS[host.toLowerCase()] ?? null : null;
}

function _open(tab: string): void {
  if (tab === 'Nutrition') useFoodLogStore.getState().goToday();
  (navigationRef as any).navigate(tab);
}

function _handle(url: string | null): void {
  const tab = _tabFor(url);
  if (!tab) return;
  if (_tabsReady && navigationRef.isReady()) _open(tab);
  else _pending = { tab, at: Date.now() };
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
  const { tab, at } = _pending;
  _pending = null;
  if (Date.now() - at > PENDING_MS) return;
  // After this render, so the tab navigator is registered with the container.
  setTimeout(() => { if (navigationRef.isReady()) _open(tab); }, 0);
}
