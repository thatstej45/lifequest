import type { Goal, GoalDailyProgress } from '../types';
import { countsForDailyGoal, isGoalScheduled, trackingMode } from './habitDomain';
import { addDays, toISODate } from '../analytics/dateUtils';

export type GoldilocksKind = 'easier' | 'harder';

export interface GoldilocksSuggestion {
  goalId: string;
  title: string;
  kind: GoldilocksKind;
  ratio: number;
  windowDays: number;
  suggestion: string;
}

const habitRatioOverDays = (
  goal: Goal,
  progress: GoalDailyProgress[],
  days: number,
  referenceDate = new Date(),
) => {
  if (trackingMode(goal) === 'health') return null;
  const end = toISODate(referenceDate);
  let scheduled = 0;
  let logged = 0;
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(referenceDate, -offset);
    const key = toISODate(day);
    if (key > end) continue;
    if (!isGoalScheduled(goal, day)) continue;
    scheduled += 1;
    const entry = progress.find(item => item.goalId === goal.id && item.date === key);
    if (countsForDailyGoal(goal, entry, day)) logged += 1;
  }
  if (scheduled < 5) return null;
  return logged / scheduled;
};

const dismissedRecently = (goal: Goal, withinDays = 14) => {
  if (!goal.goldilocksDismissedAt) return false;
  const dismissed = new Date(goal.goldilocksDismissedAt);
  const cutoff = addDays(new Date(), -withinDays);
  return dismissed >= cutoff;
};

/** User-approved suggestions only; nothing auto-applies. */
export const goldilocksSuggestions = (
  goals: Goal[],
  progress: GoalDailyProgress[],
  referenceDate = new Date(),
): GoldilocksSuggestion[] => {
  const suggestions: GoldilocksSuggestion[] = [];

  goals.forEach(goal => {
    if (trackingMode(goal) === 'health' || dismissedRecently(goal)) return;

    const ratio14 = habitRatioOverDays(goal, progress, 14, referenceDate);
    if (ratio14 != null && ratio14 < 0.5) {
      suggestions.push({
        goalId: goal.id,
        title: goal.title,
        kind: 'easier',
        ratio: ratio14,
        windowDays: 14,
        suggestion: goal.twoMinuteTarget
          ? 'Consider lowering the main target or leaning on two-minute mode.'
          : 'Consider adding a two-minute starter target or lowering the main target.',
      });
      return;
    }

    const ratio30 = habitRatioOverDays(goal, progress, 30, referenceDate);
    if (ratio30 != null && ratio30 > 0.95 && trackingMode(goal) !== 'checkbox') {
      const target = goal.targetValue ?? 1;
      suggestions.push({
        goalId: goal.id,
        title: goal.title,
        kind: 'harder',
        ratio: ratio30,
        windowDays: 30,
        suggestion: `Consider raising target from ${target} to ${target + 1}${goal.unit ? ` ${goal.unit}` : ''}.`,
      });
    }
  });

  return suggestions;
};

export const applyEasierSuggestion = (goal: Goal): Goal => {
  const mode = trackingMode(goal);
  const next: Goal = { ...goal, goldilocksDismissedAt: new Date().toISOString() };
  if (mode === 'checkbox') {
    next.twoMinuteTarget = 1;
    return next;
  }
  const target = Math.max(1, goal.targetValue ?? 1);
  if (!goal.twoMinuteTarget) {
    next.twoMinuteTarget = mode === 'timer' ? Math.max(1, Math.floor(target / 2)) : 1;
  } else if (target > 1) {
    next.targetValue = Math.max(1, target - 1);
  }
  return next;
};

export const applyHarderSuggestion = (goal: Goal): Goal => ({
  ...goal,
  targetValue: Math.max(1, (goal.targetValue ?? 1) + 1),
  goldilocksDismissedAt: new Date().toISOString(),
});
