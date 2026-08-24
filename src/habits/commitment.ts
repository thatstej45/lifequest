import type { Goal, GoalDailyProgress } from '../types';
import { countsForDailyGoal, dateKey, isGoalScheduled, trackingMode, wasScheduledAndMissed } from './habitDomain';

export const canCompleteNow = (goal: Goal, now = new Date()) => {
  const earliest = goal.earliestCompleteTime?.trim();
  if (!earliest || !/^\d{2}:\d{2}$/.test(earliest)) return { allowed: true as const };
  const current = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  if (current >= earliest) return { allowed: true as const };
  return { allowed: false as const, earliest };
};

export const consecutiveMissPenaltyDue = (
  goal: Goal,
  progress: GoalDailyProgress[],
  yesterdayKey: string,
) => {
  const penalty = goal.consecutiveMissPenaltyXp ?? 0;
  if (penalty <= 0 || trackingMode(goal) === 'health') return false;

  const dayBefore = new Date(`${yesterdayKey}T12:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayBeforeKey = dateKey(dayBefore);

  const byDate = new Map(progress.map(item => [`${item.goalId}:${item.date}`, item]));
  const missedYesterday = wasScheduledAndMissed(goal, byDate, yesterdayKey);
  const missedDayBefore = wasScheduledAndMissed(goal, byDate, dayBeforeKey);
  return missedYesterday && missedDayBefore;
};

export const shouldApplyMissPenaltyToday = (
  goal: Goal,
  progress: GoalDailyProgress[],
  today = dateKey(),
) => {
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);
  if (!consecutiveMissPenaltyDue(goal, progress, yesterdayKey)) return false;
  const todayProgress = progress.find(item => item.goalId === goal.id && item.date === today);
  return !countsForDailyGoal(goal, todayProgress, new Date(`${today}T12:00:00`));
};

export const isScheduledToday = (goal: Goal, date = new Date()) => isGoalScheduled(goal, date);
