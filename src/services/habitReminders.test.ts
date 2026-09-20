import type { Goal } from '../types';
import {
  buildNativeSchedules,
  dueReminderTimes,
  normalizeReminderTime,
  notificationId,
} from './habitReminders';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const goal = (partial: Partial<Goal> = {}): Goal => ({
  id: 'reminder-goal',
  skillId: 'skill',
  title: 'Read for ten minutes',
  completed: false,
  xpReward: 10,
  trackingMode: 'checkbox',
  reminderTimes: ['09:30'],
  reminderFrequency: 'multiple',
  ...partial,
});

assert(normalizeReminderTime('9:05') === '09:05', 'normalizes reminder time');
assert(normalizeReminderTime('25:00') === null, 'rejects invalid reminder time');
assert(
  dueReminderTimes(goal(), new Date(2026, 8, 20, 9, 30, 45)).join(',') === '09:30',
  'detects a reminder throughout its scheduled minute',
);
assert(
  dueReminderTimes(goal(), new Date(2026, 8, 20, 9, 31)).length === 0,
  'does not fire outside the scheduled minute',
);

const daily = buildNativeSchedules(goal({ repeatType: 'daily', isRepeatable: true }));
assert(daily.length === 1, 'builds one daily notification');
assert(daily[0].schedule.on?.hour === 9 && daily[0].schedule.repeats, 'daily reminder repeats at its time');
assert(daily[0].sound === 'default' && daily[0].foreground, 'native reminder is audible and foreground-visible');

const weekly = buildNativeSchedules(goal({
  repeatType: 'weekly',
  isRepeatable: true,
  repeatDays: [0, 3],
}));
assert(weekly.length === 2, 'builds one notification per weekly day');
assert(weekly.map(item => item.schedule.on?.weekday).join(',') === '1,4', 'maps Sunday-based weekdays correctly');

const now = new Date(2026, 8, 20, 10, 0);
const oneTime = buildNativeSchedules(goal({ repeatType: 'none', isRepeatable: false }), now, false);
assert(oneTime.length === 1, 'builds one one-time reminder');
assert(oneTime[0].schedule.at instanceof Date, 'one-time reminder uses an absolute date');
assert(oneTime[0].schedule.at?.getDate() === 21, 'past one-time reminder advances to tomorrow');
assert(!oneTime[0].isExactNotification, 'exact-alarm fallback is carried into the schedule');

const once = buildNativeSchedules(goal({
  repeatType: 'daily',
  isRepeatable: true,
  reminderTimes: ['18:00', '08:00'],
  reminderFrequency: 'once',
}));
assert(once.length === 1 && once[0].schedule.on?.hour === 8, 'once mode schedules only the earliest reminder');
assert(notificationId('stable', 0) === notificationId('stable', 0), 'notification ids are stable');

console.log('habit reminder checks passed');
