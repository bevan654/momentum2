import { useEffect, useCallback, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks for EAS updates and either:
 * - Silently downloads and auto-reloads the app, or
 * - Prompts the user with an alert to restart now
 *
 * @param mode
 *   'silent'  — download + auto-reload (no user interaction)
 *   'prompt'  — show alert asking user to restart when update is ready
 */
export function useAppUpdates(mode: 'silent' | 'prompt' = 'silent', initialDelayMs = 0) {
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__) return;
    if (!Updates.isEnabled) return;

    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) return;

      setIsUpdating(true);
      const result = await Updates.fetchUpdateAsync();

      if (!result.isNew) return;

      if (mode === 'prompt') {
        Alert.alert(
          'Update Available',
          'A new version has been downloaded. Restart to apply?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Restart', onPress: () => Updates.reloadAsync() },
          ],
        );
      } else {
        // Silent: auto-reload after a brief delay to let state settle
        setTimeout(() => Updates.reloadAsync(), 500);
      }
    } catch {
      // Silently fail
    } finally {
      setIsUpdating(false);
    }
  }, [mode]);

  useEffect(() => {
    const timer = initialDelayMs > 0
      ? setTimeout(checkForUpdate, initialDelayMs)
      : (checkForUpdate(), null);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForUpdate();
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [checkForUpdate, initialDelayMs]);

  return { isUpdating, checkForUpdate };
}
