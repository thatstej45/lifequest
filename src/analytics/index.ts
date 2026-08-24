export * from './types';
export * from './dateUtils';
export * from './windows';
export * from './ratios';
export * from './deltas';
export * from './weekday';
export * from './trends';
export * from './calendar';
export * from './heatmap';
export * from './habits';
export * from './trajectory';

import type { HistoryRecord } from '../types';
import { comparePeriods } from './deltas';
import { buildHeatmapCells } from './heatmap';
import { buildWeeklyHabitMatrix, perHabitSummary } from './habits';
import { computeWeekdayBreakdown } from './weekday';
import { dailyCompletionRatios, averageCompletionRatio } from './ratios';
import { sixMonthTrend } from './trends';
import { filterHistoryByWindow, splitCurrentAndPrevious } from './windows';
import type { AnalyticsHabitInput, AnalyticsHistoryInput, AnalyticsWindow } from './types';

/** Convenience bundle for history-driven dashboard metrics. */
export const buildHistoryAnalytics = ({
  history,
  window = 30,
  referenceDate = new Date(),
}: AnalyticsHistoryInput) => {
  const scoped = filterHistoryByWindow(history, window, referenceDate);
  const { current, previous } = splitCurrentAndPrevious(history, window, referenceDate);

  return {
    window,
    scoped,
    avgRatio: averageCompletionRatio(scoped),
    dailyRatios: dailyCompletionRatios(scoped),
    weekdayBreakdown: computeWeekdayBreakdown(scoped),
    sixMonthTrend: sixMonthTrend(history, referenceDate),
    heatmap: buildHeatmapCells(history, window, referenceDate),
    periodComparison:
      window === 'all' ? null : comparePeriods(current, previous),
  };
};

/** Convenience bundle for habit-level metrics. */
export const buildHabitAnalytics = ({
  goals,
  progress,
  history = [],
  window = 30,
  referenceDate = new Date(),
}: AnalyticsHabitInput) => ({
  window,
  summaries: perHabitSummary(goals, progress, window, referenceDate),
  weeklyMatrix: buildWeeklyHabitMatrix(goals, progress, history, referenceDate),
});

export type { AnalyticsWindow, HistoryRecord };
