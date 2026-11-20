import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { REST_NOTIF_ID } from './constants';

/**
 * Cancel any pending rest notification, then schedule a new one.
 * Awaits the cancel so Android doesn't race and kill the new one.
 * Uses the high-priority 'rest_timer' channel on Android for exact delivery.
 */
/** Bumped by every schedule and cancel: the latest call wins, whatever order the awaits finish in. */
let _restNotifGen = 0;

export async function _scheduleRestNotification(seconds: number) {
  const gen = ++_restNotifGen;
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID);
  } catch {}
  if (gen !== _restNotifGen) return; // a newer schedule or cancel came in meanwhile
  Notifications.scheduleNotificationAsync({
    identifier: REST_NOTIF_ID,
    content: {
      title: 'Rest Complete!',
      body: 'Time for your next set.',
      sound: 'default',
      data: { type: 'rest_complete' },
      ...(Platform.OS === 'android' ? { channelId: 'rest_timer' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  }).catch(() => {});
}

/** Cancels the rest alert, including one still waiting to be scheduled. */
export function _cancelRestNotification(): void {
  _restNotifGen++;
  Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID).catch(() => {});
}
