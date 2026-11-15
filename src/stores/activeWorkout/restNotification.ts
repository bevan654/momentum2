import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { REST_NOTIF_ID } from './constants';

/**
 * Cancel any pending rest notification, then schedule a new one.
 * Awaits the cancel so Android doesn't race and kill the new one.
 * Uses the high-priority 'rest_timer' channel on Android for exact delivery.
 */
export async function _scheduleRestNotification(seconds: number) {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIF_ID);
  } catch {}
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
