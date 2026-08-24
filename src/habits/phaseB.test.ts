import { goldilocksSuggestions, applyEasierSuggestion } from './goldilocks';
import { convertMinusHabits, isVagueHabit } from './scorecard';
import { canCompleteNow, consecutiveMissPenaltyDue } from './commitment';
import { mentorMessage } from './mentorCopy';
import type { Goal, GoalDailyProgress } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const goal = (partial: Partial<Goal> & Pick<Goal, 'id' | 'title'>): Goal => ({
  skillId: 's1',
  completed: false,
  xpReward: 10,
  isRepeatable: true,
  repeatType: 'daily',
  trackingMode: 'counter',
  targetValue: 10,
  ...partial,
});

assert(isVagueHabit(goal({ id: 'v', title: 'read' })), 'detect vague habit');
assert(!isVagueHabit(goal({ id: 'c', title: 'read', cueLocation: 'desk' })), 'cue clears vague');

const blocked = canCompleteNow(goal({ id: 'e', title: 'late', earliestCompleteTime: '23:59' }), new Date('2026-01-01T08:00:00'));
assert(!blocked.allowed, 'earliest complete blocks early');

const minus = convertMinusHabits([
  goal({ id: 'm', title: 'scroll', scorecardRating: '-' }),
  goal({ id: 'p', title: 'walk', scorecardRating: '+', identityStatementIndex: 0 }),
]);
assert(minus.length === 1 && minus[0].habitKind === 'replace', 'minus converts to replacement');

const easier = applyEasierSuggestion(goal({ id: 't', title: 'run', targetValue: 5 }));
assert(easier.twoMinuteTarget != null || (easier.targetValue ?? 5) <= 5, 'easier suggestion adjusts');

assert(mentorMessage('recovery', 'Stoic', 'meditate').includes('meditate'), 'mentor copy');

const progress: GoalDailyProgress[] = [
  { id: 'g:2026-01-01', goalId: 'g', date: '2026-01-01', value: 0, elapsedSeconds: 0, completed: false },
  { id: 'g:2026-01-02', goalId: 'g', date: '2026-01-02', value: 0, elapsedSeconds: 0, completed: false },
];
assert(
  consecutiveMissPenaltyDue(goal({ id: 'g', title: 'x', consecutiveMissPenaltyXp: 5, repeatType: 'daily', isRepeatable: true }), progress, '2026-01-02'),
  'consecutive miss penalty',
);

assert(goldilocksSuggestions([], []).length === 0, 'no suggestions without habits');

console.log('habitDomain phase B checks passed');
