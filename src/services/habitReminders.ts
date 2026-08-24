import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Goal, GoalDailyProgress } from '../types';
import {
  formatImplementationIntention,
  isGoalScheduled,
  isHabitLoggedToday,
  trackingMode,
} from '../habits/habitDomain';
import { isNativeApp } from '../platform';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export type NotificationBackend = 'web' | 'native' | 'none';

export const getNotificationBackend = (): NotificationBackend => {
  if (isNativeApp) return 'native';
  if ('Notification' in window && 'serviceWorker' in navigator) return 'web';
  return 'none';
};

export const getNotificationPermission = (): NotificationPermissionState => {
  if (isNativeApp) {
    return 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
};

export const readNativePermission = async (): Promise<NotificationPermissionState> => {
  if (!isNativeApp) return getNotificationPermission();
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return 'granted';
    if (status.display === 'denied') return 'denied';
    return 'default';
  } catch {
    return 'unsupported';
  }
};

export const requestNotificationPermission = async (): Promise<NotificationPermissionState> => {
  if (isNativeApp) {
    try {
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'unsupported';
    }
  }
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  return result as NotificationPermissionState;
};

/** Normalize stored reminder strings to HH:mm for matching. */
export const normalizeReminderTime = (time: string): string | null => {
  if (!time || !time.includes(':')) return null;
  const [hoursPart, minutesPart = '0'] = time.split(':');
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart.slice(0, 2), 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const notificationId = (goalId: string, slot: number) => {
  let hash = slot + 1;
  for (let i = 0; i < goalId.length; i += 1) {
    hash = ((hash << 5) - hash + goalId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000 || 1;
};

export const shouldRemindGoal = (
  goal: Goal,
  progress: GoalDailyProgress | undefined,
  now = new Date(),
  pauseMode: 'none' | 'vacation' | 'sick' = 'none',
) => {
  if (pauseMode !== 'none') return false;
  if (trackingMode(goal) === 'health') return false;
  if (!isGoalScheduled(goal, now)) return false;
  if (isHabitLoggedToday(goal, progress, now)) return false;
  return (goal.reminderTimes?.length ?? 0) > 0;
};

export const reminderBodyForGoal = (goal: Goal) =>
  formatImplementationIntention(goal) ?? goal.title;

export const showWebReminder = async (goal: Goal) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const body = reminderBodyForGoal(goal);
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Quest Reminder', {
        body,
        icon: '/favicon.ico',
        tag: `quest-${goal.id}`,
        renotify: true,
        data: { goalId: goal.id },
        actions: [
          { action: 'complete', title: 'Complete ✓' },
          { action: 'snooze', title: 'Snooze ⏱' },
        ],
      } as NotificationOptions);
      return true;
    }
    new Notification('Quest Reminder', { body, icon: '/favicon.ico' });
    return true;
  } catch (error) {
    console.error('Web notification error:', error);
    return false;
  }
};

const buildNativeSchedules = (goal: Goal) => {
  const times = (goal.reminderTimes ?? [])
    .map(normalizeReminderTime)
    .filter((value): value is string => Boolean(value));
  if (times.length === 0) return [];

  const isDaily = goal.repeatType === 'daily' || (goal.isRepeatable && goal.repeatType !== 'weekly');
  const isWeekly = goal.repeatType === 'weekly' && (goal.repeatDays?.length ?? 0) > 0;
  const isOneTime = (!goal.repeatType || goal.repeatType === 'none') && !goal.isRepeatable;

  if (!isDaily && !isWeekly && !isOneTime) return [];

  const schedules: Array<{
    id: number;
    title: string;
    body: string;
    schedule: { on: { hour: number; minute: number; weekday?: number }; repeats: boolean; allowWhileIdle?: boolean };
    extra: { goalId: string };
  }> = [];

  times.forEach((time, index) => {
    const [hourPart, minutePart] = time.split(':');
    const hour = Number.parseInt(hourPart, 10);
    const minute = Number.parseInt(minutePart, 10);
    const body = reminderBodyForGoal(goal);

    if (isWeekly) {
      (goal.repeatDays ?? []).forEach((day, weekdayIndex) => {
        schedules.push({
          id: notificationId(goal.id, index * 10 + weekdayIndex),
          title: 'Quest Reminder',
          body,
          schedule: {
            on: { weekday: day + 1, hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
          extra: { goalId: goal.id },
        });
      });
      return;
    }

    schedules.push({
      id: notificationId(goal.id, index),
      title: 'Quest Reminder',
      body,
      schedule: {
        on: { hour, minute },
        repeats: isDaily,
        allowWhileIdle: true,
      },
      extra: { goalId: goal.id },
    });
  });

  return schedules;
};

export const syncNativeHabitReminders = async (
  goals: Goal[],
  pauseMode: 'none' | 'vacation' | 'sick' = 'none',
) => {
  if (!isNativeApp) return { scheduled: 0, skipped: 'web' as const };

  const permission = await readNativePermission();
  if (permission !== 'granted') {
    const existing = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
    if (existing.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: existing.notifications.map(item => ({ id: item.id })),
      }).catch(() => undefined);
    }
    return { scheduled: 0, skipped: 'permission' as const };
  }

  const pending = goals.flatMap(goal => {
    if (pauseMode !== 'none') return [];
    if (trackingMode(goal) === 'health') return [];
    if (goal.completed && (!goal.repeatType || goal.repeatType === 'none') && !goal.isRepeatable) return [];
    return buildNativeSchedules(goal);
  });

  const existing = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
  if (existing.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: existing.notifications.map(item => ({ id: item.id })),
    }).catch(() => undefined);
  }
  if (pending.length === 0) return { scheduled: 0, skipped: null };

  await LocalNotifications.schedule({ notifications: pending });
  return { scheduled: pending.length, skipped: null };
};

export const registerNativeNotificationHandlers = () => {
  if (!isNativeApp) return () => undefined;

  const completeListener = LocalNotifications.addListener('localNotificationActionPerformed', event => {
    const goalId = event.notification.extra?.goalId as string | undefined;
    if (goalId) {
      const channel = new BroadcastChannel('lifequest_channel');
      channel.postMessage({ type: 'COMPLETE_QUEST', goalId });
      channel.close();
    }
  });

  return () => {
    void completeListener.then(listener => listener.remove());
  };
};
