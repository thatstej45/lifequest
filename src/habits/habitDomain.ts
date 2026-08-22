import { Goal, GoalDailyProgress, HistoryRecord, Routine, UserStats } from '../types';

export const HABIT_DATA_VERSION = 1;

export type HabitAction =
  | { type: 'toggle' }
  | { type: 'increment'; amount?: number }
  | { type: 'decrement'; amount?: number }
  | { type: 'set'; value: number }
  | { type: 'timer-start' }
  | { type: 'timer-pause' }
  | { type: 'reset' };

export const dateKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export const progressId = (goalId: string, date: string) => `${goalId}:${date}`;

export const trackingMode = (goal: Goal) => goal.trackingMode ?? 'checkbox';

export const targetForGoal = (goal: Goal) => {
  const target = Math.max(1, goal.targetValue ?? 1);
  return trackingMode(goal) === 'timer' ? target * 60 : target;
};

export const effectiveProgressValue = (progress: GoalDailyProgress, now = new Date()) => {
  if (!progress.timerStartedAt) return progress.elapsedSeconds;
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(progress.timerStartedAt).getTime()) / 1000));
  return progress.elapsedSeconds + elapsed;
};

export const isHabitComplete = (goal: Goal, progress?: GoalDailyProgress, now = new Date()) => {
  if (trackingMode(goal) === 'health') return false;
  if (!progress) return Boolean(goal.completed);
  if (trackingMode(goal) === 'timer') return effectiveProgressValue(progress, now) >= targetForGoal(goal);
  return progress.value >= targetForGoal(goal);
};

export const habitProgressPercent = (goal: Goal, progress?: GoalDailyProgress, now = new Date()) => {
  if (trackingMode(goal) === 'health') return 0;
  const value = trackingMode(goal) === 'timer'
    ? progress ? effectiveProgressValue(progress, now) : 0
    : progress?.value ?? (goal.completed ? targetForGoal(goal) : 0);
  return Math.min(100, Math.max(0, Math.round((value / targetForGoal(goal)) * 100)));
};

export const emptyProgress = (goalId: string, date = dateKey()): GoalDailyProgress => ({
  id: progressId(goalId, date),
  goalId,
  date,
  value: 0,
  elapsedSeconds: 0,
  completed: false,
});

export const applyHabitAction = (
  goal: Goal,
  current: GoalDailyProgress | undefined,
  action: HabitAction,
  now = new Date(),
) => {
  const mode = trackingMode(goal);
  const base = current ?? {
    ...emptyProgress(goal.id, dateKey(now)),
    value: goal.completed ? targetForGoal(goal) : 0,
    elapsedSeconds: goal.completed && mode === 'timer' ? targetForGoal(goal) : 0,
    completed: goal.completed,
  };
  const next: GoalDailyProgress = { ...base };

  if (mode === 'health') return next;
  if (action.type === 'reset') {
    next.value = 0;
    next.elapsedSeconds = 0;
    delete next.timerStartedAt;
  } else if (mode === 'timer') {
    const elapsed = effectiveProgressValue(next, now);
    if (action.type === 'timer-start' && !next.timerStartedAt) next.timerStartedAt = now.toISOString();
    if (action.type === 'timer-pause' && next.timerStartedAt) {
      next.elapsedSeconds = elapsed;
      delete next.timerStartedAt;
    }
    if (action.type === 'set') {
      next.elapsedSeconds = Math.max(0, action.value);
      delete next.timerStartedAt;
    }
  } else if (mode === 'checkbox' && action.type === 'toggle') {
    next.value = next.completed ? 0 : 1;
  } else if (action.type === 'increment') {
    next.value = Math.max(0, next.value + (action.amount ?? 1));
  } else if (action.type === 'decrement') {
    next.value = Math.max(0, next.value - (action.amount ?? 1));
  } else if (action.type === 'set') {
    next.value = Math.max(0, action.value);
  } else if (action.type === 'toggle') {
    next.value = next.completed ? 0 : targetForGoal(goal);
  }

  next.completed = isHabitComplete(goal, next, now);
  if (next.completed && !base.completed) next.completedAt = now.toISOString();
  if (!next.completed) {
    delete next.completedAt;
    delete next.appliedXp;
    delete next.historyEntryId;
  }
  return next;
};

export const isGoalScheduled = (goal: Goal, date = new Date()) => {
  if (goal.repeatType === 'weekly') return Boolean(goal.repeatDays?.includes(date.getDay()));
  if (goal.repeatType === 'daily' || goal.isRepeatable) return true;
  return !goal.completed;
};

export const dailyGoalSummary = (
  goals: Goal[],
  progress: GoalDailyProgress[],
  targetPercent = 60,
  date = new Date(),
) => {
  const key = dateKey(date);
  const byGoal = new Map(progress.filter(item => item.date === key).map(item => [item.goalId, item]));
  const scheduled = goals.filter(goal => trackingMode(goal) !== 'health' && isGoalScheduled(goal, date));
  const completed = scheduled.filter(goal => isHabitComplete(goal, byGoal.get(goal.id), date)).length;
  const percent = scheduled.length ? Math.round((completed / scheduled.length) * 100) : 0;
  return {
    completed,
    total: scheduled.length,
    percent,
    met: scheduled.length > 0 && percent >= targetPercent,
  };
};

export const resolveDailyStreak = (
  stats: UserStats,
  record: Pick<HistoryRecord, 'goalMet' | 'paused'>,
) => {
  if (record.paused) return stats;
  if (record.goalMet) {
    const shieldProgress = (stats.shieldProgress ?? 0) + 1;
    const earnedShield = shieldProgress >= 5 && (stats.streakShields ?? 0) < 3;
    return {
      ...stats,
      streak: stats.streak + 1,
      shieldProgress: earnedShield ? 0 : shieldProgress,
      streakShields: Math.min(3, (stats.streakShields ?? 0) + (earnedShield ? 1 : 0)),
    };
  }
  if ((stats.streakShields ?? 0) > 0) {
    return { ...stats, streakShields: (stats.streakShields ?? 0) - 1 };
  }
  return { ...stats, streak: 0, shieldProgress: 0 };
};

export interface HabitRoutineGroup {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  goals: Goal[];
}

export const groupHabitsByRoutine = (
  goals: Goal[],
  routines: Routine[],
  fallbackName = 'Unsorted',
): HabitRoutineGroup[] => {
  const groups = [...routines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(routine => ({
      ...routine,
      goals: goals
        .filter(goal => goal.routineId === routine.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    }));
  const unassigned = goals.filter(goal => !goal.routineId || !routines.some(routine => routine.id === goal.routineId));
  if (unassigned.length) {
    groups.push({
      id: 'unsorted',
      name: fallbackName,
      icon: 'ListChecks',
      color: '#94a3b8',
      sortOrder: Number.MAX_SAFE_INTEGER,
      goals: unassigned.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    });
  }
  return groups;
};
