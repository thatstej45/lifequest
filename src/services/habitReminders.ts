import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications';
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

export const QUEST_REMINDER_CHANNEL_ID = 'lifequest-reminders-v2';
export const QUEST_REMINDER_ACTION_TYPE = 'lifequest-quest-reminder';
export const QUEST_REMINDER_DISMISS_ACTION = 'dismiss';
export const QUEST_REMINDER_DONE_ACTION = 'done';

let nativeInfrastructurePromise: Promise<void> | null = null;

/**
 * Register the OS-visible notification channel and action buttons before any
 * reminders are scheduled. Android channels are user-configurable and are what
 * make LifeQuest appear in the system notification settings.
 */
export const ensureNativeNotificationInfrastructure = async () => {
  if (!isNativeApp) return;
  if (nativeInfrastructurePromise) return nativeInfrastructurePromise;

  nativeInfrastructurePromise = (async () => {
    await LocalNotifications.registerActionTypes({
      types: [{
        id: QUEST_REMINDER_ACTION_TYPE,
        iosCustomDismissAction: true,
        actions: [
          {
            id: QUEST_REMINDER_DISMISS_ACTION,
            title: 'Dismiss',
            destructive: true,
            foreground: false,
          },
          {
            id: QUEST_REMINDER_DONE_ACTION,
            title: 'Done',
            foreground: false,
          },
        ],
      }],
    });

    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: QUEST_REMINDER_CHANNEL_ID,
        name: 'Quest reminders',
        description: 'Scheduled reminders for your LifeQuest habits and quests',
        sound: 'lifequest_reminder.wav',
        importance: 4,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#2563EB',
      });
    }
  })().catch(error => {
    nativeInfrastructurePromise = null;
    throw error;
  });

  return nativeInfrastructurePromise;
};

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
      await ensureNativeNotificationInfrastructure();
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') {
        if (Capacitor.getPlatform() === 'android') {
          const exact = await LocalNotifications.checkExactNotificationSetting().catch(() => null);
          if (exact?.exact_alarm !== 'granted') {
            await LocalNotifications.changeExactNotificationSetting().catch(() => undefined);
          }
        }
        return 'granted';
      }
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

export const reminderTitleForGoal = (goal: Goal) => `Quest: ${goal.title}`;

/** The cue/intention line, omitted when it would just repeat the title. */
export const reminderDetailForGoal = (goal: Goal) => {
  const detail = formatImplementationIntention(goal);
  return detail && detail !== goal.title ? detail : '';
};

export const REMINDER_TAP_HINT = 'Tap to mark done · Swipe to dismiss';

export const dueReminderTimes = (goal: Goal, now = new Date()) => {
  const currentHHmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  return (goal.reminderTimes ?? [])
    .map(normalizeReminderTime)
    .filter((value): value is string => value === currentHHmm);
};

export const showWebReminder = async (goal: Goal) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const isWebKit = /AppleWebKit/i.test(navigator.userAgent);
  const title = reminderTitleForGoal(goal);
  const detail = reminderDetailForGoal(goal);
  const body = [detail, isWebKit ? REMINDER_TAP_HINT : '']
    .filter(Boolean)
    .join('\n') || 'Your quest is ready.';
  const icon = new URL('icon-lightning-192.png', document.baseURI).href;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon,
          tag: `quest-${goal.id}`,
          renotify: true,
          silent: false,
          data: { goalId: goal.id, tapCompletes: isWebKit },
          actions: [
            { action: 'dismiss', title: 'Dismiss' },
            { action: 'done', title: 'Done' },
          ],
        } as NotificationOptions);
        return true;
      }
    }
    new Notification(title, { body, icon });
    return true;
  } catch (error) {
    console.error('Web notification error:', error);
    return false;
  }
};

export const buildNativeSchedules = (
  goal: Goal,
  now = new Date(),
  exactAlarmGranted = true,
) => {
  const normalizedTimes = (goal.reminderTimes ?? [])
    .map(normalizeReminderTime)
    .filter((value): value is string => Boolean(value))
    .sort();
  const times = goal.reminderFrequency === 'once'
    ? normalizedTimes.slice(0, 1)
    : normalizedTimes;
  if (times.length === 0) return [];

  const isDaily = goal.repeatType === 'daily' || (goal.isRepeatable && goal.repeatType !== 'weekly');
  const isWeekly = goal.repeatType === 'weekly' && (goal.repeatDays?.length ?? 0) > 0;
  const isOneTime = (!goal.repeatType || goal.repeatType === 'none') && !goal.isRepeatable;

  if (!isDaily && !isWeekly && !isOneTime) return [];

  const schedules: LocalNotificationSchema[] = [];

  times.forEach((time, index) => {
    const [hourPart, minutePart] = time.split(':');
    const hour = Number.parseInt(hourPart, 10);
    const minute = Number.parseInt(minutePart, 10);
    const title = reminderTitleForGoal(goal);
    const body = reminderDetailForGoal(goal) || 'Your quest is ready.';

    if (isWeekly) {
      (goal.repeatDays ?? []).forEach((day, weekdayIndex) => {
        schedules.push({
          id: notificationId(goal.id, index * 10 + weekdayIndex),
          title,
          body,
          sound: 'default',
          foreground: true,
          interruptionLevel: 'active',
          actionTypeId: QUEST_REMINDER_ACTION_TYPE,
          channelId: QUEST_REMINDER_CHANNEL_ID,
          autoCancel: true,
          isExactNotification: exactAlarmGranted,
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

    if (isOneTime) {
      const at = new Date(now);
      at.setHours(hour, minute, 0, 0);
      if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
      schedules.push({
        id: notificationId(goal.id, index),
        title,
        body,
        sound: 'default',
        foreground: true,
        interruptionLevel: 'active',
        actionTypeId: QUEST_REMINDER_ACTION_TYPE,
        channelId: QUEST_REMINDER_CHANNEL_ID,
        autoCancel: true,
        isExactNotification: exactAlarmGranted,
        schedule: {
          at,
          repeats: false,
          allowWhileIdle: true,
        },
        extra: { goalId: goal.id },
      });
      return;
    }

    schedules.push({
      id: notificationId(goal.id, index),
      title,
      body,
      sound: 'default',
      foreground: true,
      interruptionLevel: 'active',
      actionTypeId: QUEST_REMINDER_ACTION_TYPE,
      channelId: QUEST_REMINDER_CHANNEL_ID,
      autoCancel: true,
      isExactNotification: exactAlarmGranted,
      schedule: {
        on: { hour, minute },
        repeats: true,
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

  try {
    await ensureNativeNotificationInfrastructure();
  } catch (error) {
    console.error('Native notification setup error:', error);
    return { scheduled: 0, skipped: 'setup-error' as const };
  }

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

  const exactAlarmGranted = Capacitor.getPlatform() !== 'android'
    || (await LocalNotifications.checkExactNotificationSetting().catch(() => ({ exact_alarm: 'denied' as const }))).exact_alarm === 'granted';
  const pending = goals.flatMap(goal => {
    if (pauseMode !== 'none') return [];
    if (trackingMode(goal) === 'health') return [];
    if (goal.completed && (!goal.repeatType || goal.repeatType === 'none') && !goal.isRepeatable) return [];
    return buildNativeSchedules(goal, new Date(), exactAlarmGranted);
  });
  // iOS accepts at most 64 pending local notifications per app.
  const platformPending = Capacitor.getPlatform() === 'ios' ? pending.slice(0, 64) : pending;

  const existing = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
  if (existing.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: existing.notifications.map(item => ({ id: item.id })),
    }).catch(() => undefined);
  }
  if (platformPending.length === 0) return { scheduled: 0, skipped: null };

  try {
    const result = await LocalNotifications.schedule({ notifications: platformPending });
    return {
      scheduled: platformPending.length,
      skipped: null,
      exactAlarmGranted,
      warning: result.warning?.message,
    };
  } catch (error) {
    console.error('Native notification scheduling error:', error);
    return { scheduled: 0, skipped: 'error' as const, exactAlarmGranted };
  }
};

export const scheduleNativeTestNotification = async (goal?: Goal) => {
  if (!isNativeApp) return { scheduled: false, reason: 'web' as const };
  await ensureNativeNotificationInfrastructure();

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') {
    return { scheduled: false, reason: 'permission' as const };
  }

  const at = new Date(Date.now() + 5000);
  await LocalNotifications.schedule({
    notifications: [{
      id: notificationId('lifequest-system-test', 0),
      title: 'LifeQuest notification test',
      body: goal ? `Ready to complete: ${goal.title}` : 'System notifications are working.',
      sound: 'default',
      foreground: true,
      interruptionLevel: 'active',
      actionTypeId: QUEST_REMINDER_ACTION_TYPE,
      channelId: QUEST_REMINDER_CHANNEL_ID,
      autoCancel: true,
      isExactNotification: false,
      schedule: { at, repeats: false, allowWhileIdle: true },
      extra: goal ? { goalId: goal.id } : {},
    }],
  });
  return { scheduled: true, reason: null };
};

export const registerNativeNotificationHandlers = (
  onDone: (goalId: string) => void,
) => {
  if (!isNativeApp) return () => undefined;

  void ensureNativeNotificationInfrastructure().catch(error => {
    console.error('Native notification setup error:', error);
  });

  const actionListener = LocalNotifications.addListener('localNotificationActionPerformed', event => {
    const goalId = event.notification.extra?.goalId as string | undefined;
    if (event.actionId === QUEST_REMINDER_DONE_ACTION && goalId) {
      onDone(goalId);
    }
    if (
      event.actionId === QUEST_REMINDER_DONE_ACTION
      || event.actionId === QUEST_REMINDER_DISMISS_ACTION
    ) {
      void LocalNotifications.removeDeliveredNotificationsById({
        ids: [event.notification.id],
      }).catch(() => undefined);
    }
  });

  return () => {
    void actionListener.then(listener => listener.remove());
  };
};
