import { completionDayKey, dateKey, isGoalScheduled } from './habitDomain';
import { DAY_START_HOUR, habitDayDate, msUntilNextDayStart } from '../dayBoundary';
import type { Goal } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

// Friday 25 Sep 2026, local time.
const at = (hour: number, minute = 0, day = 25) => new Date(2026, 8, day, hour, minute);

assert(DAY_START_HOUR === 3, 'day starts at 03:00');

// Late-night logging still belongs to the day the user is finishing.
assert(dateKey(at(23, 30)) === '2026-09-25', 'before midnight stays on the same day');
assert(dateKey(at(0, 5, 26)) === '2026-09-25', 'after midnight still counts as the previous day');
assert(dateKey(at(2, 59, 26)) === '2026-09-25', 'just before the cutoff is still the previous day');
assert(dateKey(at(3, 0, 26)) === '2026-09-26', 'the cutoff opens the new day');
assert(dateKey(at(9, 0, 26)) === '2026-09-26', 'daytime is the current day');

// Noon anchors used across the habit code must keep their own date.
assert(dateKey(new Date('2026-09-25T12:00:00')) === '2026-09-25', 'noon anchor keeps its date');

// Weekly scheduling follows the habit day, not the wall-clock date.
const saturdayHabit: Goal = {
  id: 'g1',
  skillId: 's1',
  title: 'Saturday long run',
  completed: false,
  xpReward: 40,
  repeatType: 'weekly',
  repeatDays: [6],
};
assert(isGoalScheduled(saturdayHabit, at(20, 0, 26)) === true, 'scheduled on Saturday evening');
assert(isGoalScheduled(saturdayHabit, at(1, 0, 27)) === true, 'still Saturday at 01:00 Sunday');
assert(isGoalScheduled(saturdayHabit, at(4, 0, 27)) === false, 'no longer Saturday after the cutoff');

// lastCompletedAt exists as a day key and as a legacy ISO timestamp.
assert(completionDayKey('2026-09-25') === '2026-09-25', 'day key passes through');
assert(
  completionDayKey(at(1, 30, 26).toISOString()) === '2026-09-25',
  'a 01:30 timestamp resolves to the previous habit day',
);

// The reset timer always lands on the next 03:00.
const fromEvening = msUntilNextDayStart(at(22, 0));
const evening = new Date(at(22, 0).getTime() + fromEvening);
assert(evening.getHours() === 3 && evening.getDate() === 26, 'evening waits until tomorrow 03:00');

const fromLateNight = msUntilNextDayStart(at(1, 0, 26));
const lateNight = new Date(at(1, 0, 26).getTime() + fromLateNight);
assert(lateNight.getHours() === 3 && lateNight.getDate() === 26, 'after midnight waits for today 03:00');

assert(habitDayDate(at(1, 0, 26)).getDate() === 25, 'habitDayDate shifts back across midnight');

console.log('day boundary checks passed');
