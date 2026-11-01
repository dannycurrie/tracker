import * as Notifications from 'expo-notifications';
import { logger } from './logger';

// Local notifications are used because JS timers are suspended while the app
// is backgrounded; the OS delivers these regardless of app state.
const REMINDER_INTERVAL_SECONDS = 10 * 60;

const notificationId = (metricId: string) => `timer-reminder:${metricId}`;

export function configureTimerNotifications(): void {
  // Show reminders as banners even when the app is in the foreground.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Schedules a repeating reminder every 10 minutes for a running timer.
 * The repeat interval is anchored to the moment of scheduling, which is the
 * moment the timer starts.
 */
export async function scheduleTimerReminder(metricId: string, metricName: string): Promise<void> {
  try {
    if (!(await ensurePermission())) return;
    await Notifications.cancelScheduledNotificationAsync(notificationId(metricId));
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId(metricId),
      content: {
        title: `${metricName} timer is still running`,
        body: 'Tap to open Tracker and stop it if you are done.',
        data: { metricId },
      },
      trigger: { seconds: REMINDER_INTERVAL_SECONDS, repeats: true },
    });
  } catch (error) {
    logger.error('Failed to schedule timer reminder', error);
  }
}

export async function cancelTimerReminder(metricId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId(metricId));
  } catch (error) {
    logger.error('Failed to cancel timer reminder', error);
  }
}
