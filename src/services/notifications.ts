import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { i18n } from '@/locales';
import type { Task } from '@/types';
import {
  balancedReminderPlan,
  REMINDER_LIMIT,
  reminderSlots,
  type ReminderSlot,
} from './reminderPlan';

const CHANNEL = 'daily-habits';
const OWNER = 'daily-plus';
export const notificationsAvailable =
  Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';
let queue: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

if (notificationsAvailable) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function prepareChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: i18n.t('notifications.channel', { defaultValue: 'Habit reminders' }),
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
  });
}

async function ownRequests(): Promise<Notifications.NotificationRequest[]> {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  return requests.filter((request) => request.content.data?.owner === OWNER);
}

async function cancelRequests(taskId?: string): Promise<void> {
  for (const request of await ownRequests()) {
    if (taskId === undefined || request.content.data?.taskId === taskId) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}

/** Permission is requested exclusively when the user enables notifications. */
export function setNotificationsEnabled(enabled: boolean): Promise<boolean> {
  return serialize(async () => {
    if (!notificationsAvailable) return false;
    if (!enabled) {
      await cancelRequests();
      return false;
    }
    await prepareChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return (
      requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  });
}

async function permitted(): Promise<boolean> {
  if (!notificationsAvailable) return false;
  const result = await Notifications.getPermissionsAsync();
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function schedule(task: Task, slot: ReminderSlot): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `daily-${task.id}-${slot.weekday}-${slot.hour}-${slot.minute}`,
    content: {
      title: i18n.t('notifications.title', { defaultValue: 'A small step for today' }),
      body: i18n.t('notifications.body', { name: task.name, defaultValue: 'Time for {{name}}.' }),
      sound: false,
      data: {
        owner: OWNER,
        taskId: task.id,
        url: `dailyplus://task/${encodeURIComponent(task.id)}`,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      ...slot,
      channelId: CHANNEL,
    },
  });
}

export function cancelTaskReminder(id: string): Promise<void> {
  return serialize(async () => {
    if (notificationsAvailable) await cancelRequests(id);
  });
}

export function syncTaskReminder(task: Task, enabled: boolean): Promise<void> {
  return serialize(async () => {
    if (!notificationsAvailable) return;
    await cancelRequests(task.id);
    if (!enabled || !(await permitted())) return;
    await prepareChannel();
    const remaining = Math.max(0, REMINDER_LIMIT - (await ownRequests()).length);
    for (const slot of reminderSlots(task).slice(0, remaining)) await schedule(task, slot);
  });
}

/** Reconcile after startup, language changes, task edits, archive, and settings changes. */
export function syncAllReminders(tasks: Task[], enabled: boolean): Promise<void> {
  return serialize(async () => {
    if (!notificationsAvailable) return;
    await cancelRequests();
    if (!enabled || !(await permitted())) return;
    await prepareChannel();
    for (const { task, slot } of balancedReminderPlan(tasks)) await schedule(task, slot);
  });
}
