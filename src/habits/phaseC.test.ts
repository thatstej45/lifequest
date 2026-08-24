import { buildQuarterlyReview, isQuarterlyReviewDue, suggestedQuarterlyDecision } from './quarterlyReview';
import { buildCommitmentShareCard, buildProgressShareCard, exportShareCardAsText } from './accountability';
import {
  breakInversionProgress,
  defaultBreakInversions,
  enableBreakMode,
  generateInversionQuests,
  isBreakModeHabit,
} from './breakMode';
import { breakQuestFromMinus } from './scorecard';
import type { Goal, GoalDailyProgress, HistoryRecord, UserStats } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const goal = (partial: Partial<Goal> & Pick<Goal, 'id' | 'title'>): Goal => ({
  skillId: 's1',
  completed: false,
  xpReward: 10,
  isRepeatable: true,
  repeatType: 'daily',
  trackingMode: 'checkbox',
  targetValue: 1,
  ...partial,
});

assert(isQuarterlyReviewDue(undefined), 'review due without prior date');
assert(!isQuarterlyReviewDue(new Date().toISOString()), 'review not due immediately after');

const stats: UserStats = {
  level: 1,
  xp: 0,
  maxXp: 100,
  consistency: 0,
  maxConsistency: 100,
  stamina: 100,
  maxStamina: 100,
  streak: 3,
  lastLoginDate: '2026-01-01',
  xpMultiplier: 1,
  skillPoints: 0,
  identityStatements: ['I am an athlete'],
};

const goals = [
  goal({ id: 'g1', title: 'run', identityStatementIndex: 0 }),
  goal({ id: 'b1', title: 'Break: scroll', habitKind: 'break', breakInversions: defaultBreakInversions('scroll') }),
];

const progress: GoalDailyProgress[] = [
  { id: 'g1:2026-01-01', goalId: 'g1', date: '2026-01-01', value: 1, elapsedSeconds: 0, completed: true },
];

const history: HistoryRecord[] = [
  { date: '2026-01-01', completedCount: 1, totalCount: 1, goalMet: true },
];

const review = buildQuarterlyReview(stats, goals, progress, history);
assert(review.due, 'quarterly snapshot marks due');
assert(review.identityVotes.length === 1, 'identity vote tally');
assert(review.breakHabits.length === 1, 'break habits listed separately');
assert(suggestedQuarterlyDecision({ completionRatio90d: 0.8, scorecardRating: '+' }) === 'keep', 'suggest keep');

const progressCard = buildProgressShareCard(stats, goals, history);
assert(progressCard.text.includes('Level 1'), 'progress card content');
assert(exportShareCardAsText(progressCard).includes('LifeQuest'), 'export card text');

const commitmentCard = buildCommitmentShareCard(stats, 'Log daily', 'Alex');
assert(commitmentCard.text.includes('Alex'), 'commitment card partner');

const breakGoal = enableBreakMode(goal({ id: 'x', title: 'snack' }), 'snack');
assert(isBreakModeHabit(breakGoal), 'break mode enabled');
assert(breakInversionProgress(breakGoal.breakInversions).configured === 4, 'default inversions');

const fromMinus = breakQuestFromMinus(goal({ id: 'm', title: 'scroll', scorecardRating: '-' }));
assert(fromMinus.habitKind === 'break' && Boolean(fromMinus.breakInversions?.invisible), 'minus break quest has inversions');

const quests = generateInversionQuests(breakGoal);
assert(quests.length === 4, 'inversion quests for 4 laws');

console.log('habitDomain phase C checks passed');
