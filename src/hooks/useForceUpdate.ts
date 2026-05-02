import { useEffect, useState, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from '../lib/supabase';

/**
 * Compare two semver-style strings ("1.0.37" vs "1.0.40").
 * Returns true if `installed` is strictly lower than `minimum`.
 * Fails closed (returns false) on any parse error so we don't gate users
 * because of a typo in the remote config.
 */
function isBelow(installed: string, minimum: string): boolean {
  try {
    const a = installed.replace(/^v/, '').split('.').map((n) => parseInt(n, 10));
    const b = minimum.replace(/^v/, '').split('.').map((n) => parseInt(n, 10));
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      if (Number.isNaN(ai) || Number.isNaN(bi)) return false;
      if (ai < bi) return true;
      if (ai > bi) return false;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Force-update gate. Reads `min_supported_version` from the public `app_config`
 * row in Supabase and blocks the app when the installed version is below it.
 *
 * Fail-open: any network or parse error returns `false` so a server outage or
 * misconfiguration can't lock everyone out of the app.
 */
export function useForceUpdate() {
  const [forceUpdate, setForceUpdate] = useState(false);
  // Reads CFBundleShortVersionString (iOS) / versionName (Android) directly
  // from the native binary — can never drift via OTA.
  const installedVersion = Application.nativeApplicationVersion;

  const check = useCallback(async () => {
    if (__DEV__) return;
    if (!installedVersion) return;

    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('min_supported_version, ios_min_supported_version, android_min_supported_version')
        .eq('id', 1)
        .single();

      if (error || !data) return;

      const platformMin =
        Platform.OS === 'ios'
          ? data.ios_min_supported_version
          : data.android_min_supported_version;

      const minVersion = platformMin || data.min_supported_version;
      if (!minVersion) return;

      setForceUpdate(isBelow(installedVersion, minVersion));
    } catch {
      // Fail-open
    }
  }, [installedVersion]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  return { forceUpdate, installedVersion };
}
