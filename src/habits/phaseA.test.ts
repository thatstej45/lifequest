import {
  computeAppliedXpForProgress,
  countsForDailyGoal,
  formatHabitStackPhrase,
  formatImplementationIntention,
  fullXpFromTwoMinute,
  orderRoutineGoals,
  twoMinuteXpFromFull,
  TWO_MINUTE_XP_RATIO,
  validStackAnchors,
  wouldCreateStackCycle,
  cleanupGoalsAfterDelete,
} from './habitDomain';
import type { Goal, GoalDailyProgress } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const goal = (partial: Partial<Goal> & Pick<Goal, 'id' | 'title'>): Goal => ({
  skillId: 's1',
  completed: false,
  xpReward: 40,
  ...partial,
});

const progress = (partial: Partial<GoalDailyProgress> & Pick<GoalDailyProgress, 'goalId' | 'date'>): GoalDailyProgress => ({
  id: `${partial.goalId}:${partial.date}`,
  value: 0,
  elapsedSeconds: 0,
  completed: false,
  ...partial,
});

// Two-minute XP is ~25% and maps back within rounding tolerance
const full = 40;
const twoMin = twoMinuteXpFromFull(full);
assert(twoMin === Math.max(1, Math.round(full * TWO_MINUTE_XP_RATIO)), 'two-minute xp ratio');
assert(Math.abs(fullXpFromTwoMinute(twoMin) - full) <= 1, 'two-minute xp reversible');

const g1 = goal({ id: 'a', title: 'meditate', routineId: 'r1', sortOrder: 0 });
const g2 = goal({ id: 'b', title: 'journal', routineId: 'r1', sortOrder: 1, stackAfterGoalId: 'a' });
assert(orderRoutineGoals([g2, g1], 'r1').map(item => item.id).join(',') === 'a,b', 'routine stack order');

assert(formatHabitStackPhrase(g2, [g1, g2]) === 'After meditate, I will journal.', 'habit stack phrase');
assert(validStackAnchors([g1, g2], 'r1', 'b').map(item => item.id).join(',') === 'a', 'valid stack anchors');
assert(validStackAnchors([g1, g2], 'r1', 'a').length === 0, 'cannot anchor to a dependent habit');
assert(wouldCreateStackCycle([g1, g2], 'a', 'b'), 'stack cycle blocked');
assert(
  cleanupGoalsAfterDelete([g1, g2], 'a').find(item => item.id === 'b')?.stackAfterGoalId == null,
  'dependents cleared when anchor deleted',
);

const intention = formatImplementationIntention(goal({
  id: 'c',
  title: 'stretch',
  reminderTimes: ['07:00'],
  cueLocation: 'bedroom',
}));
assert(intention === 'I will stretch at 07:00 in bedroom', 'implementation intention');

const dailyGoal = goal({ id: 'd', title: 'read', trackingMode: 'numeric', targetValue: 10 });
const partial = progress({ goalId: 'd', date: '2026-01-01', twoMinuteLogged: true, value: 1 });
assert(countsForDailyGoal(dailyGoal, partial), 'two-minute counts for daily goal');
assert(!partial.completed, 'two-minute does not mark numeric complete');
assert(
  computeAppliedXpForProgress(40, { ...partial, completionMode: 'twoMinute' }) === twoMinuteXpFromFull(40),
  'applied xp for two-minute',
);

console.log('habitDomain phase A checks passed');
