import type { Goal, ScorecardRating } from '../types';
import { questBaseReward } from '../progression';
import { defaultBreakInversions } from './breakMode';

export const SCORECARD_RATINGS: ScorecardRating[] = ['+', '-', '='];

export const scorecardSummary = (goals: Goal[]) => {
  const rated = goals.filter(goal => goal.scorecardRating);
  return {
    plus: rated.filter(goal => goal.scorecardRating === '+').length,
    minus: rated.filter(goal => goal.scorecardRating === '-').length,
    neutral: rated.filter(goal => goal.scorecardRating === '=').length,
    unrated: goals.length - rated.length,
  };
};

export const breakQuestFromMinus = (goal: Goal, skillId?: string): Goal => {
  const label = goal.title.replace(/^Break:\s*/i, '');
  return {
    id: `break-${goal.id}-${Date.now()}`,
    skillId: skillId ?? goal.skillId,
    title: `Break: ${label}`,
    completed: false,
    xpReward: questBaseReward('easy', { repeatType: 'daily', isRepeatable: true }),
    difficulty: 'easy',
    isRepeatable: true,
    repeatType: 'daily',
    trackingMode: 'checkbox',
    targetValue: 1,
    unit: 'times',
    icon: goal.icon ?? 'Ban',
    note: `Scorecard − habit derived from “${goal.title}”.`,
    habitKind: 'break',
    breakInversions: defaultBreakInversions(label),
    identityStatementIndex: goal.identityStatementIndex,
    sortOrder: (goal.sortOrder ?? 0) + 1,
  };
};

export const replacementQuestFromMinus = (minusGoal: Goal, plusGoal: Goal): Goal => ({
  id: `replace-${minusGoal.id}-${Date.now()}`,
  skillId: plusGoal.skillId,
  title: `Instead of “${minusGoal.title}”, ${plusGoal.title}`,
  completed: false,
  xpReward: questBaseReward('easy', { repeatType: 'daily', isRepeatable: true }),
  difficulty: 'easy',
  isRepeatable: true,
  repeatType: 'daily',
  trackingMode: plusGoal.trackingMode ?? 'checkbox',
  targetValue: plusGoal.targetValue ?? 1,
  unit: plusGoal.unit ?? 'times',
  icon: plusGoal.icon ?? 'RefreshCw',
  note: `Replacement for scorecard − “${minusGoal.title}”.`,
  habitKind: 'replace',
  replacementGoalId: plusGoal.id,
  identityStatementIndex: plusGoal.identityStatementIndex,
  cueLocation: plusGoal.cueLocation,
  sortOrder: (minusGoal.sortOrder ?? 0) + 1,
});

export const convertMinusHabits = (goals: Goal[]) => {
  const minus = goals.filter(goal => goal.scorecardRating === '-');
  const plus = goals.filter(goal => goal.scorecardRating === '+');
  const created: Goal[] = [];

  minus.forEach(minusGoal => {
    const partner = plus.find(
      item => item.identityStatementIndex != null
        && item.identityStatementIndex === minusGoal.identityStatementIndex,
    ) ?? plus[0];

    if (partner) {
      created.push(replacementQuestFromMinus(minusGoal, partner));
    } else {
      created.push(breakQuestFromMinus(minusGoal));
    }
  });

  return created;
};

export const isVagueHabit = (goal: Goal) =>
  !goal.cueLocation?.trim()
  && !goal.note?.trim()
  && goal.identityStatementIndex == null
  && !(goal.reminderTimes?.length);
