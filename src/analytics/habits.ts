import { isGoalScheduled, isHabitComplete, trackingMode } from '../habits/habitDomain';
import type { Goal, GoalDailyProgress, HistoryRecord } from '../types';
import { addDays, eachDateInRange, getWindowRange, parseISODate, startOfWeek, toISODate } from './dateUtils';
import type {
  AnalyticsWindow,
  HabitCellState,
  HabitSummary,
  HabitWeekCell,
  WeeklyHabitMatrixData,
} from './types';

const progressByGoalDate = (progress: GoalDailyProgress[]) => {
  const map = new Map<string, GoalDailyProgress>();
  progress.forEach(entry => map.set(`${entry.goalId}:${entry.date}`, entry));
  return map;
};

const historyByDate = (records: HistoryRecord[]) =>
  new Map(records.map(record => [record.date, record]));

const isTrackableGoal = (goal: Goal) => trackingMode(goal) !== 'health';

const datesForWindow = (window: AnalyticsWindow, referenceDate = new Date()) =>
  eachDateInRange(getWindowRange(window, referenceDate));

const longestConsecutiveRun = (dates: string[]) => {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;

  sorted.forEach(date => {
    const day = parseISODate(date);
    if (previous) {
      const gap = Math.round((day.getTime() - previous.getTime()) / 86_400_000);
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = day;
  });

  return best;
};

const currentConsecutiveRun = (completedSet: Set<string>, anchorDate: string) => {
  let run = 0;
  let cursor = parseISODate(anchorDate);

  while (completedSet.has(toISODate(cursor))) {
    run += 1;
    cursor = addDays(cursor, -1);
  }

  return run;
};

export const perHabitSummary = (
  goals: Goal[],
  progress: GoalDailyProgress[],
  window: AnalyticsWindow,
  referenceDate = new Date(),
): HabitSummary[] => {
  const byProgress = progressByGoalDate(progress);
  const dates = datesForWindow(window, referenceDate);
  const today = toISODate(referenceDate);

  return goals
    .filter(isTrackableGoal)
    .map(goal => {
      let scheduledDays = 0;
      let completedDays = 0;
      const completedDates: string[] = [];

      dates.forEach(date => {
        if (date > today) return;
        const day = parseISODate(date);
        if (!isGoalScheduled(goal, day)) return;
        scheduledDays += 1;
        const entry = byProgress.get(`${goal.id}:${date}`);
        if (isHabitComplete(goal, entry, day)) {
          completedDays += 1;
          completedDates.push(date);
        }
      });

      const completedSet = new Set(completedDates);
      const latestCompleted = completedDates.sort().at(-1) ?? today;

      return {
        goalId: goal.id,
        title: goal.title,
        scheduledDays,
        completedDays,
        ratio: scheduledDays > 0 ? completedDays / scheduledDays : 0,
        currentStreak: currentConsecutiveRun(completedSet, latestCompleted),
        bestStreak: longestConsecutiveRun(completedDates),
      };
    })
    .sort((a, b) => b.ratio - a.ratio || b.completedDays - a.completedDays);
};

export const resolveHabitCellState = (
  goal: Goal,
  date: string,
  progress: GoalDailyProgress | undefined,
  historyRecord: HistoryRecord | undefined,
  today: string,
): HabitCellState => {
  if (historyRecord?.paused) return 'paused';
  const day = parseISODate(date);
  if (!isGoalScheduled(goal, day)) return 'unscheduled';
  if (date > today) return 'unscheduled';
  if (isHabitComplete(goal, progress, day)) return 'completed';
  return 'missed';
};

export const buildWeeklyHabitMatrix = (
  goals: Goal[],
  progress: GoalDailyProgress[],
  history: HistoryRecord[] = [],
  referenceDate = new Date(),
  weekOffset = 0,
): WeeklyHabitMatrixData => {
  const weekStartDate = startOfWeek(referenceDate, weekOffset);
  const dates = Array.from({ length: 7 }, (_, index) => toISODate(addDays(weekStartDate, index)));
  const dayLabels = dates.map(date =>
    parseISODate(date).toLocaleDateString(undefined, { weekday: 'short' }),
  );
  const byProgress = progressByGoalDate(progress);
  const byHistory = historyByDate(history);
  const today = toISODate(referenceDate);
  const trackable = goals.filter(isTrackableGoal);

  const cells: HabitWeekCell[] = trackable.flatMap(goal =>
    dates.map(date => ({
      goalId: goal.id,
      date,
      state: resolveHabitCellState(
        goal,
        date,
        byProgress.get(`${goal.id}:${date}`),
        byHistory.get(date),
        today,
      ),
    })),
  );

  return {
    weekStart: dates[0],
    weekEnd: dates[6],
    dayLabels,
    dates,
    goals: trackable.map(goal => ({ id: goal.id, title: goal.title })),
    cells,
  };
};

export const habitCellLookup = (matrix: WeeklyHabitMatrixData) => {
  const map = new Map<string, HabitWeekCell>();
  matrix.cells.forEach(cell => map.set(`${cell.goalId}:${cell.date}`, cell));
  return map;
};
