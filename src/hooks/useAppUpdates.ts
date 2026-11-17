import { useEffect, useCallback, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';

/** A downloaded update is waiting to be applied (silent mode held it back during a workout). */
let pendingReload = false;

/** Reloading now would throw away what the user is doing: a workout or its summary. */
function isBusy(): boolean {
  const { isActive, showSummary } = useActiveWorkoutStore.getState();
  return isActive || showSummary;
}

/** Reloads into the downloaded update unless a workout started meanwhile; otherwise keeps it pending. */
function reloadIfIdle() {
  if (isBusy()) {
    pendingReload = true;
    return;
  }
  pendingReload = false;
  Updates.reloadAsync().catch(() => {});
}

/**
 * Checks for EAS updates and either:
 * - Silently downloads and auto-reloads the app, or
 * - Prompts the user with an alert to restart now
 *
 * Silent mode never reloads during a workout or while its summary is showing: the update waits for a
 * later foreground (or applies on the next launch, which expo-updates does on its own).
 *
 * @param mode
 *   'silent'  — download + auto-reload (no user interaction)
 *   'prompt'  — show alert asking user to restart when update is ready
 */
export function useAppUpdates(mode: 'silent' | 'prompt' = 'silent') {
  const [isUpdating, setIsUpdating] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__) return;
    if (!Updates.isEnabled) return;

    // An update was downloaded earlier but held back: apply it now if the user is free
    if (mode === 'silent' && pendingReload) {
      reloadIfIdle();
      return;
    }

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
      } else if (isBusy()) {
        pendingReload = true;
      } else {
        // Silent: auto-reload after a brief delay to let state settle (re-checked then)
        setTimeout(reloadIfIdle, 500);
      }
    } catch {
      // Silently fail
    } finally {
      setIsUpdating(false);
    }
  }, [mode]);

  useEffect(() => {
    checkForUpdate();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForUpdate();
    });

    return () => sub.remove();
  }, [checkForUpdate]);

  return { isUpdating, checkForUpdate };
}
