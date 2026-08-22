import { Category, Goal, HistoryRecord } from '../types';

export const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const toISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Monday-based week start, shifted by `weekOffset` weeks. */
export const startOfWeek = (reference: Date, weekOffset = 0) => {
  const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayIndex = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayIndex + weekOffset * 7);
  return date;
};

export const formatLongDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const isGoalScheduledToday = (goal: Goal, weekday: number, today: string) => {
  if (goal.repeatType === 'weekly') return Boolean(goal.repeatDays?.includes(weekday));
  if (goal.repeatType === 'daily' || goal.isRepeatable) return true;
  if (!goal.completed) return true;
  return Boolean(goal.lastCompletedAt?.startsWith(today));
};

export interface RoutineGroup {
  id: string;
  name: string;
  color: string;
  icon?: string;
  comment: string;
  goals: Goal[];
  completed: number;
  total: number;
}

export const buildRoutineGroups = (
  categories: Category[],
  goals: Goal[],
  weekday: number,
  today: string,
): RoutineGroup[] => {
  const scheduled = goals.filter(goal => isGoalScheduledToday(goal, weekday, today));
  const skillToCategory = new Map<string, Category>();
  categories.forEach(category => {
    category.skills.forEach(skill => skillToCategory.set(skill.id, category));
  });

  const groups = categories
    .map(category => {
      const groupGoals = scheduled.filter(
        goal => skillToCategory.get(goal.skillId)?.id === category.id,
      );
      return {
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        comment: `${category.skills.filter(skill => skill.isUnlocked).length} skills unlocked`,
        goals: groupGoals,
        completed: groupGoals.filter(goal => goal.completed).length,
        total: groupGoals.length,
      };
    })
    .filter(group => group.total > 0);

  const orphans = scheduled.filter(goal => !skillToCategory.has(goal.skillId));
  if (orphans.length > 0) {
    groups.push({
      id: 'unsorted',
      name: 'Unsorted',
      color: '#8b93a1',
      icon: 'ListChecks',
      comment: 'habits without a skill tree',
      goals: orphans,
      completed: orphans.filter(goal => goal.completed).length,
      total: orphans.length,
    });
  }

  return groups;
};

export const goalCadence = (goal: Goal) => {
  if (goal.repeatType === 'weekly') {
    const days = (goal.repeatDays ?? []).map(day => WEEK_LABELS[(day + 6) % 7]).join(' ');
    return days ? `weekly · ${days.toLowerCase()}` : 'weekly';
  }
  if (goal.repeatType === 'daily' || goal.isRepeatable) return 'every day';
  if (goal.requiredSpecialization) return `${goal.requiredSpecialization.toLowerCase()} unlock`;
  return 'one time';
};

export const completedTimeToday = (goal: Goal, today: string) => {
  if (!goal.completed || !goal.lastCompletedAt) return null;
  const stamp = new Date(goal.lastCompletedAt);
  if (Number.isNaN(stamp.getTime())) return null;
  if (toISODate(stamp) !== today) return null;
  if (!goal.lastCompletedAt.includes('T')) return null;
  return `${String(stamp.getHours()).padStart(2, '0')}:${String(stamp.getMinutes()).padStart(2, '0')}`;
};

export const ratioFor = (record?: HistoryRecord) => {
  if (!record || record.totalCount <= 0) return 0;
  return Math.min(1, record.completedCount / record.totalCount);
};

export const averageRatio = (records: HistoryRecord[]) => {
  const usable = records.filter(record => record.totalCount > 0);
  if (usable.length === 0) return 0;
  const sum = usable.reduce((acc, record) => acc + ratioFor(record), 0);
  return sum / usable.length;
};

export const recordsWithin = (records: HistoryRecord[], days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffISO = toISODate(cutoff);
  return records.filter(record => record.date >= cutoffISO);
};

/** Longest run of consecutive calendar days with at least one completion. */
export const longestLoggedRun = (records: HistoryRecord[]) => {
  const active = records
    .filter(record => record.completedCount > 0)
    .map(record => record.date)
    .sort();

  let best = 0;
  let run = 0;
  let previous: Date | null = null;

  active.forEach(date => {
    const current = new Date(`${date}T00:00:00`);
    if (previous) {
      const gap = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = current;
  });

  return best;
};

export const weekdayBreakdown = (records: HistoryRecord[]) =>
  WEEK_LABELS.map((label, index) => {
    const weekday = (index + 1) % 7;
    const matching = records.filter(
      record => new Date(`${record.date}T00:00:00`).getDay() === weekday,
    );
    return { label, ratio: averageRatio(matching), samples: matching.length };
  });
