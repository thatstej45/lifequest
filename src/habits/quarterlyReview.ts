import { perHabitSummary } from '../analytics/habits';
import type { AnalyticsWindow } from '../analytics/types';
import { trajectorySnapshot } from '../analytics/trajectory';
import type {
  Goal,
  GoalDailyProgress,
  HistoryRecord,
  QuarterlyReviewDecision,
  UserStats,
} from '../types';
import { trackingMode } from './habitDomain';

export const QUARTERLY_REVIEW_DAYS = 90;

export interface IdentityVoteTally {
  index: number;
  statement: string;
  completions: number;
}

export interface QuarterlyHabitItem {
  goalId: string;
  title: string;
  habitKind?: Goal['habitKind'];
  scorecardRating?: Goal['scorecardRating'];
  identityStatement?: string;
  completionRatio90d: number;
  decision?: QuarterlyReviewDecision;
}

export interface QuarterlyReviewSnapshot {
  due: boolean;
  daysSinceLastReview: number;
  nextReviewLabel: string;
  identityStatements: string[];
  trajectory: ReturnType<typeof trajectorySnapshot>;
  identityVotes: IdentityVoteTally[];
  habits: QuarterlyHabitItem[];
  breakHabits: QuarterlyHabitItem[];
  keepCount: number;
  changeCount: number;
  dropCount: number;
  undecidedCount: number;
}

const daysBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000);

export const isQuarterlyReviewDue = (
  lastReviewAt?: string,
  now = new Date(),
) => {
  if (!lastReviewAt) return true;
  const last = new Date(lastReviewAt);
  if (Number.isNaN(last.getTime())) return true;
  return daysBetween(last, now) >= QUARTERLY_REVIEW_DAYS;
};

export const identityVoteTallies = (
  goals: Goal[],
  progress: GoalDailyProgress[],
  statements: string[] = [],
  windowDays: AnalyticsWindow = 90,
): IdentityVoteTally[] => {
  const summaries = perHabitSummary(goals, progress, windowDays);
  const byGoal = new Map(summaries.map(item => [item.goalId, item]));

  const tallies = statements.map((statement, index) => ({
    index,
    statement,
    completions: 0,
  }));

  goals.forEach(goal => {
    if (goal.identityStatementIndex == null) return;
    const tally = tallies[goal.identityStatementIndex];
    if (!tally) return;
    tally.completions += byGoal.get(goal.id)?.completedDays ?? 0;
  });

  return tallies.filter(item => item.statement.trim());
};

export const buildQuarterlyReview = (
  userStats: UserStats,
  goals: Goal[],
  progress: GoalDailyProgress[],
  history: HistoryRecord[],
  now = new Date(),
): QuarterlyReviewSnapshot => {
  const lastReviewAt = userStats.lastQuarterlyReviewAt ?? userStats.scorecardReviewedAt;
  const due = isQuarterlyReviewDue(lastReviewAt, now);
  const daysSinceLastReview = lastReviewAt
    ? daysBetween(new Date(lastReviewAt), now)
    : QUARTERLY_REVIEW_DAYS;

  const nextReviewDate = lastReviewAt
    ? new Date(new Date(lastReviewAt).getTime() + QUARTERLY_REVIEW_DAYS * 86_400_000)
    : now;
  const nextReviewLabel = due
    ? 'due now'
    : nextReviewDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const statements = userStats.identityStatements ?? [];
  const trajectory = trajectorySnapshot(history, now);
  const identityVotes = identityVoteTallies(goals, progress, statements, QUARTERLY_REVIEW_DAYS);
  const summaries = perHabitSummary(
    goals.filter(goal => trackingMode(goal) !== 'health'),
    progress,
    QUARTERLY_REVIEW_DAYS,
    now,
  );
  const summaryByGoal = new Map(summaries.map(item => [item.goalId, item]));
  const decisions = userStats.quarterlyReviewDecisions ?? {};

  const habits: QuarterlyHabitItem[] = goals
    .filter(goal => trackingMode(goal) !== 'health' && (goal.habitKind ?? 'build') !== 'break')
    .map(goal => ({
      goalId: goal.id,
      title: goal.title,
      habitKind: goal.habitKind,
      scorecardRating: goal.scorecardRating,
      identityStatement: goal.identityStatementIndex != null
        ? statements[goal.identityStatementIndex]
        : undefined,
      completionRatio90d: summaryByGoal.get(goal.id)?.ratio ?? 0,
      decision: decisions[goal.id],
    }))
    .sort((a, b) => a.completionRatio90d - b.completionRatio90d);

  const breakHabits: QuarterlyHabitItem[] = goals
    .filter(goal => (goal.habitKind === 'break' || goal.habitKind === 'replace'))
    .map(goal => ({
      goalId: goal.id,
      title: goal.title,
      habitKind: goal.habitKind,
      scorecardRating: goal.scorecardRating,
      identityStatement: goal.identityStatementIndex != null
        ? statements[goal.identityStatementIndex]
        : undefined,
      completionRatio90d: summaryByGoal.get(goal.id)?.ratio ?? 0,
      decision: decisions[goal.id],
    }));

  const allDecisions = [...habits, ...breakHabits].map(item => item.decision).filter(Boolean);

  return {
    due,
    daysSinceLastReview,
    nextReviewLabel,
    identityStatements: statements,
    trajectory,
    identityVotes,
    habits,
    breakHabits,
    keepCount: allDecisions.filter(item => item === 'keep').length,
    changeCount: allDecisions.filter(item => item === 'change').length,
    dropCount: allDecisions.filter(item => item === 'drop').length,
    undecidedCount: habits.length + breakHabits.length - allDecisions.length,
  };
};

export const suggestedQuarterlyDecision = (
  item: Pick<QuarterlyHabitItem, 'completionRatio90d' | 'scorecardRating'>,
): QuarterlyReviewDecision => {
  if (item.scorecardRating === '-') return 'drop';
  if (item.completionRatio90d >= 0.7) return 'keep';
  if (item.completionRatio90d >= 0.4) return 'change';
  return 'change';
};

export const completeQuarterlyReview = (
  stats: UserStats,
  decisions: Record<string, QuarterlyReviewDecision>,
  now = new Date(),
): UserStats => ({
  ...stats,
  lastQuarterlyReviewAt: now.toISOString(),
  quarterlyReviewDecisions: decisions,
});
