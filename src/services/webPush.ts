import type { Goal } from '../types';
import { trackingMode } from '../habits/habitDomain';
import { reminderDetailForGoal } from './habitReminders';

const DEVICE_ID_KEY = 'lifequest_push_device_id';
const PUSH_API_URL = (import.meta.env.VITE_PUSH_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export type WebPushSyncResult =
  | { synced: true; reminders: number }
  | { synced: false; reason: 'unsupported' | 'unconfigured' | 'permission' | 'request-failed' };

interface PushReminder {
  goalId: string;
  title: string;
  body: string;
  time: string;
  kind: 'once' | 'daily' | 'weekly';
  weekdays: number[];
  nextAt?: string;
  skipDate?: string;
}

const base64UrlToBytes = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
};

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
};

const buildPushReminders = (goals: Goal[], pauseMode: 'none' | 'vacation' | 'sick'): PushReminder[] => {
  if (pauseMode !== 'none') return [];

  return goals.flatMap(goal => {
    if (trackingMode(goal) === 'health') return [];
    const oneTime = (!goal.repeatType || goal.repeatType === 'none') && !goal.isRepeatable;
    if (oneTime && goal.completed) return [];

    const normalizedTimes = (goal.reminderTimes ?? [])
      .map(normalizeTime)
      .filter((time): time is string => Boolean(time))
      .sort();
    const times = goal.reminderFrequency === 'once' ? normalizedTimes.slice(0, 1) : normalizedTimes;
    if (!times.length) return [];

    const kind: PushReminder['kind'] = goal.repeatType === 'weekly' && (goal.repeatDays?.length ?? 0) > 0
      ? 'weekly'
      : oneTime
        ? 'once'
        : 'daily';

    return times.map(time => {
      let nextAt: string | undefined;
      if (kind === 'once') {
        const [hour, minute] = time.split(':').map(Number);
        const next = new Date();
        next.setHours(hour, minute, 0, 0);
        if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
        nextAt = next.toISOString();
      }

      return {
        goalId: goal.id,
        title: goal.title,
        body: reminderDetailForGoal(goal),
        time,
        kind,
        weekdays: goal.repeatDays ?? [],
        nextAt,
        skipDate: goal.completed ? localDateKey() : undefined,
      };
    });
  });
};

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};

const request = async (path: string, init?: RequestInit) => {
  if (!PUSH_API_URL) throw new Error('Push service is not configured');
  const response = await fetch(`${PUSH_API_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`Push service returned HTTP ${response.status}`);
  }
  return response;
};

export const isWebPushConfigured = () => Boolean(PUSH_API_URL);

export const isIOSDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalonePwa = () => window.matchMedia('(display-mode: standalone)').matches
  || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

export const canUseWebPush = () => 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

export const syncWebPushReminders = async (
  goals: Goal[],
  pauseMode: 'none' | 'vacation' | 'sick' = 'none',
): Promise<WebPushSyncResult> => {
  if (!canUseWebPush()) return { synced: false, reason: 'unsupported' };
  if (!PUSH_API_URL) return { synced: false, reason: 'unconfigured' };
  if (Notification.permission !== 'granted') return { synced: false, reason: 'permission' };

  try {
    const registration = await navigator.serviceWorker.ready;
    const configResponse = await request('/config');
    const config = await configResponse.json() as { vapidPublicKey: string };
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(config.vapidPublicKey),
      });
    }

    const reminders = buildPushReminders(goals, pauseMode);
    await request('/subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        subscription: subscription.toJSON(),
        reminders,
      }),
    });
    return { synced: true, reminders: reminders.length };
  } catch (error) {
    console.error('Web Push sync failed:', error);
    return { synced: false, reason: 'request-failed' };
  }
};

export const sendWebPushTest = async () => {
  if (!PUSH_API_URL) throw new Error('Push service is not configured');
  await request('/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId() }),
  });
};
