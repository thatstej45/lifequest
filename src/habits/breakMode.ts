import type { BreakInversions, Goal } from '../types';
import { questBaseReward } from '../progression';

export const BREAK_LAW_KEYS = ['invisible', 'unattractive', 'difficult', 'unsatisfying'] as const;
export type BreakLawKey = (typeof BREAK_LAW_KEYS)[number];

export interface BreakLawGuide {
  key: BreakLawKey;
  law: string;
  inversion: string;
  prompt: string;
  questTitle: (habitTitle: string) => string;
}

export const BREAK_LAW_GUIDES: BreakLawGuide[] = [
  {
    key: 'invisible',
    law: 'Make it invisible',
    inversion: 'Remove the cue',
    prompt: 'What trigger will you hide, remove, or avoid?',
    questTitle: title => `Remove cue for “${title}”`,
  },
  {
    key: 'unattractive',
    law: 'Make it unattractive',
    inversion: 'Reframe the craving',
    prompt: 'What truth makes this habit less appealing?',
    questTitle: title => `Reframe craving: “${title}”`,
  },
  {
    key: 'difficult',
    law: 'Make it difficult',
    inversion: 'Add friction',
    prompt: 'What extra step blocks the bad habit?',
    questTitle: title => `Add friction to “${title}”`,
  },
  {
    key: 'unsatisfying',
    law: 'Make it unsatisfying',
    inversion: 'Attach a cost',
    prompt: 'What immediate consequence follows the slip?',
    questTitle: title => `Cost for slipping on “${title}”`,
  },
];

export const defaultBreakInversions = (habitTitle: string): BreakInversions => ({
  invisible: `Hide or remove the cue that starts “${habitTitle}”.`,
  unattractive: `Remember why “${habitTitle}” conflicts with who I want to become.`,
  difficult: `Add one friction step before I can do “${habitTitle}”.`,
  unsatisfying: `Log the slip immediately — no hiding, no reward.`,
});

export const breakInversionProgress = (inversions?: BreakInversions) => {
  const configured = BREAK_LAW_KEYS.filter(key => inversions?.[key]?.trim()).length;
  return { configured, total: BREAK_LAW_KEYS.length };
};

export const isBreakModeHabit = (goal: Goal) =>
  goal.habitKind === 'break' || goal.habitKind === 'replace';

export const enableBreakMode = (goal: Goal, sourceTitle?: string): Goal => {
  const title = sourceTitle ?? goal.title.replace(/^Break:\s*/i, '');
  return {
    ...goal,
    habitKind: goal.habitKind === 'replace' ? 'replace' : 'break',
    title: goal.title.startsWith('Break:') ? goal.title : `Break: ${title}`,
    breakInversions: goal.breakInversions ?? defaultBreakInversions(title),
    trackingMode: 'checkbox',
    targetValue: 1,
    isRepeatable: true,
    repeatType: 'daily',
    scorecardRating: goal.scorecardRating ?? '-',
  };
};

export const inversionQuestFromLaw = (
  parent: Goal,
  law: BreakLawGuide,
): Goal => ({
  id: `inversion-${parent.id}-${law.key}-${Date.now()}`,
  skillId: parent.skillId,
  title: law.questTitle(parent.title.replace(/^Break:\s*/i, '')),
  completed: false,
  xpReward: questBaseReward('trivial', { repeatType: 'daily', isRepeatable: true }),
  difficulty: 'trivial',
  isRepeatable: true,
  repeatType: 'daily',
  trackingMode: 'checkbox',
  targetValue: 1,
  unit: 'times',
  icon: 'Shield',
  note: `${law.inversion}: ${parent.breakInversions?.[law.key] ?? law.prompt}`,
  habitKind: 'build',
  routineId: parent.routineId,
  identityStatementIndex: parent.identityStatementIndex,
  sortOrder: (parent.sortOrder ?? 0) + 1,
});

export const generateInversionQuests = (parent: Goal): Goal[] =>
  BREAK_LAW_GUIDES
    .filter(law => parent.breakInversions?.[law.key]?.trim())
    .map(law => inversionQuestFromLaw(parent, law));

export const breakResistanceMessage = (goal: Goal) => {
  const { configured, total } = breakInversionProgress(goal.breakInversions);
  if (goal.habitKind === 'replace') {
    return `Replacement day logged · ${configured}/${total} inversions armed`;
  }
  return `Resistance logged · ${configured}/${total} inversions active`;
};

export const formatBreakPlan = (goal: Goal) =>
  BREAK_LAW_GUIDES
    .map(law => {
      const plan = goal.breakInversions?.[law.key]?.trim();
      if (!plan) return null;
      return `${law.law}: ${plan}`;
    })
    .filter(Boolean)
    .join('\n');
